// The generated head: one image in, a GLB URL out, with everything in between
// exposed as state the UI can render.
//
// This is a module-level store rather than React state on purpose. Generation
// takes minutes and SPANS A ROUTE CHANGE — it is kicked off on the upload
// screen and consumed in the Smash Lab — so it cannot live in either
// component's state without one of them owning the other. It also must not
// restart when a component remounts, which is exactly what a useEffect would do
// under StrictMode.
//
// The whole design rests on one rule: THE GAME IS PLAYABLE THE ENTIRE TIME.
// Nothing here ever blocks. The lab opens immediately with the stand-in head
// and swaps in the real one the moment it exists, so a slow generation costs
// the player nothing but a late reveal, and a failed one costs them nothing at
// all.

/** How often to ask the proxy for progress. Tripo jobs run in minutes. */
const POLL_MS = 2500

/** Give up rather than poll forever if a job wedges. */
const TIMEOUT_MS = 6 * 60 * 1000

export const HEAD_STATUS = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  GENERATING: 'generating',
  READY: 'ready',
  FAILED: 'failed',
}

const state = {
  status: HEAD_STATUS.IDLE,
  progress: 0,
  url: null,
  error: null,
  outOfCredit: false,
  taskId: null,
  /** Data URL of the photo that was sent, for the UI to show while it works. */
  preview: null,
}

const listeners = new Set()

export function subscribeHeadModel(fn) {
  listeners.add(fn)
  fn(state)
  return () => listeners.delete(fn)
}

export function getHeadModel() {
  return state
}

function emit(patch) {
  Object.assign(state, patch)
  for (const fn of listeners) fn(state)
}

let timer = null
let abort = null
/**
 * True between clicking and Tripo accepting the job.
 *
 * A generation costs real money, so a double-click must not buy two of them.
 * The guard covers only the submit window: once a job is queued, a further call
 * is a deliberate "use a different photo" and is allowed to replace it.
 */
let submitting = false

function stopPolling() {
  if (timer) clearTimeout(timer)
  timer = null
}

/** Throw away any in-flight job and go back to the stand-in head. */
export function resetHeadModel() {
  stopPolling()
  abort?.abort()
  abort = null
  if (state.preview) URL.revokeObjectURL(state.preview)
  emit({
    status: HEAD_STATUS.IDLE,
    progress: 0,
    url: null,
    error: null,
    outOfCredit: false,
    taskId: null,
    preview: null,
  })
}

/**
 * Send one photo off to be turned into a head.
 *
 * ONE image, not the four-view set the capture pipeline was originally built
 * for. Multi-view reconstruction is better, but it needs the player to pose
 * three times before they get to play, and the whole point of this screen is to
 * get them into the lab in one action.
 *
 * @param {Blob} blob  A square JPEG/PNG of the face.
 * @returns {Promise<void>} Resolves once the job is ACCEPTED, not once it is
 *   finished — the caller is expected to navigate away and let it run.
 */
export async function generateHead(blob) {
  if (submitting) return
  submitting = true
  resetHeadModel()

  abort = new AbortController()
  emit({
    status: HEAD_STATUS.UPLOADING,
    progress: 0,
    preview: URL.createObjectURL(blob),
  })

  let taskId
  try {
    const res = await fetch('/api/tripo/generate', {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
      body: blob,
      signal: abort.signal,
    })
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      submitting = false
      emit({
        status: HEAD_STATUS.FAILED,
        error: body.error || `the 3D service returned ${res.status}`,
        outOfCredit: Boolean(body.outOfCredit),
      })
      return
    }
    taskId = body.taskId
  } catch (err) {
    submitting = false
    if (err.name === 'AbortError') return
    // A static build has no proxy behind /api, so this is the expected path
    // there rather than a bug. Either way the lab still opens.
    emit({ status: HEAD_STATUS.FAILED, error: 'the 3D service is not reachable' })
    return
  }

  submitting = false

  if (!taskId) {
    emit({ status: HEAD_STATUS.FAILED, error: 'the 3D service accepted no job' })
    return
  }

  emit({ status: HEAD_STATUS.GENERATING, taskId, progress: 0 })
  poll(taskId, Date.now())
}

function poll(taskId, startedAt) {
  stopPolling()
  timer = setTimeout(async () => {
    if (state.taskId !== taskId) return // superseded by a newer job

    if (Date.now() - startedAt > TIMEOUT_MS) {
      emit({ status: HEAD_STATUS.FAILED, error: 'the 3D job took too long' })
      return
    }

    try {
      const res = await fetch(`/api/tripo/status/${encodeURIComponent(taskId)}`, {
        signal: abort?.signal,
      })
      const body = await res.json().catch(() => ({}))
      if (state.taskId !== taskId) return

      if (!res.ok) {
        emit({ status: HEAD_STATUS.FAILED, error: body.error || 'lost track of the 3D job' })
        return
      }

      if (body.ready) {
        // Point at OUR route, not at Tripo's signed URL — that one expires
        // after five minutes and would 403 for a slow loader.
        emit({
          status: HEAD_STATUS.READY,
          progress: 1,
          url: `/api/tripo/model/${encodeURIComponent(taskId)}`,
        })
        return
      }

      if (body.failed) {
        emit({ status: HEAD_STATUS.FAILED, error: `the 3D job ${body.status}` })
        return
      }

      emit({ progress: body.progress ?? state.progress })
      poll(taskId, startedAt)
    } catch (err) {
      if (err.name === 'AbortError') return
      // A dropped poll is not a dead job; keep trying until the timeout.
      poll(taskId, startedAt)
    }
  }, POLL_MS)
}

/**
 * Called by the scene when a model that reached READY then failed to LOAD.
 *
 * The job succeeding and the file arriving are two different things — a signed
 * URL can expire, a download can be cut off, a GLB can come back malformed — so
 * the store has to be told, or the HUD keeps claiming "YOUR HEAD" while the
 * stand-in is on screen.
 */
export function reportHeadModelFailure(message) {
  stopPolling()
  emit({
    status: HEAD_STATUS.FAILED,
    url: null,
    error: message || 'the generated head could not be loaded',
  })
}
