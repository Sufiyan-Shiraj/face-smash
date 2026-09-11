// Tripo image-to-3D, proxied so the API key never reaches the browser.
//
// WHY A PROXY AND NOT A DIRECT CALL
//
// The obvious shortcut is to put the key in a VITE_-prefixed variable and call
// Tripo from the page. That ships the key to every visitor in a JS bundle — it
// is not obfuscated, it is published. Anything with billing attached has to be
// called from somewhere the user cannot read, so the key stays in .env.local
// (deliberately WITHOUT a VITE_ prefix, which is what stops Vite exposing it)
// and the browser talks to this instead.
//
// THE THREE ENDPOINTS, and why the third one exists
//
//   POST /api/tripo/generate     image bytes in, { taskId } out
//   GET  /api/tripo/status/:id   { status, progress, ready, error }
//   GET  /api/tripo/model/:id    the finished GLB, streamed
//
// The model route looks redundant — the status response already carries a
// download URL — and is not. Tripo's model_url is a signed URL that EXPIRES
// AFTER FIVE MINUTES. Handing it to the browser means the head loads fine on a
// fast connection and 403s for anyone who was still on the loading screen when
// the clock ran out, which is the worst kind of bug: intermittent, machine
// dependent, and invisible on the developer's machine. Re-resolving it here at
// the moment of download removes the race entirely, and incidentally dodges
// Tripo's CORS headers.
//
// THE API, as measured rather than as documented. Both of these were found by
// probing the live service, because the published docs describe two different
// API generations and the v2 examples do not work against v3:
//
//   upload  POST https://openapi.tripo3d.ai/v3/files
//           multipart, field name "file"      -> data.file_token
//   create  POST https://openapi.tripo3d.ai/v3/generation/image-to-model
//           { file: { type, file_token }, model }   -> data.task_id
//           NOTE: a bare top-level file_token is rejected; it wants the object.
//   poll    GET  https://openapi.tripo3d.ai/v3/tasks/{task_id}
//           -> status, progress, output.model_url

const TRIPO = 'https://openapi.tripo3d.ai/v3'

/**
 * Model version. The API rejects a request with no `model` and lists the
 * accepted values in the error, which is how this list is known to be current:
 * P1-20260311, P2-20260801, v2.5-20250123, v3.0-20250812, v3.1-20260211.
 */
const MODEL = 'v3.1-20260211'

/** Terminal states, from Tripo's own documentation. */
const DONE = new Set(['success'])
const FAILED = new Set(['failed', 'cancelled', 'banned', 'expired', 'unknown'])

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req, limit = MAX_UPLOAD_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (c) => {
      total += c.length
      if (total > limit) {
        reject(new Error(`image is larger than ${Math.round(limit / 1048576)} MB`))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** Tripo answers errors with a useful message; surface it rather than "500". */
async function tripoFetch(path, init, key) {
  const res = await fetch(`${TRIPO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, ...(init?.headers ?? {}) },
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { message: text.slice(0, 300) }
  }
  if (!res.ok || (body.code !== undefined && body.code !== 0)) {
    const err = new Error(body.message || `Tripo returned ${res.status}`)
    err.status = res.status
    err.code = body.code
    err.suggestion = body.suggestion
    throw err
  }
  return body
}

async function createTask(bytes, contentType, key) {
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpeg'

  const form = new FormData()
  form.append('file', new Blob([bytes], { type: contentType }), `face.${ext}`)
  const uploaded = await tripoFetch('/files', { method: 'POST', body: form }, key)

  const fileToken = uploaded?.data?.file_token
  if (!fileToken) throw new Error('Tripo accepted the upload but returned no file token')

  const created = await tripoFetch(
    '/generation/image-to-model',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `file` must be an OBJECT. Passing file_token at the top level is
      // rejected with "file is required for image_to_model".
      body: JSON.stringify({ file: { type: ext, file_token: fileToken }, model: MODEL }),
    },
    key
  )

  const taskId = created?.data?.task_id ?? created?.data?.taskId
  if (!taskId) throw new Error('Tripo created no task')
  return taskId
}

async function pollTask(id, key) {
  const body = await tripoFetch(`/tasks/${encodeURIComponent(id)}`, { method: 'GET' }, key)
  const d = body?.data ?? body
  const status = String(d?.status ?? 'unknown').toLowerCase()
  return {
    status,
    // Tripo reports 0-100; normalise so the UI never has to care.
    progress: Math.max(0, Math.min(1, Number(d?.progress ?? 0) / 100)),
    ready: DONE.has(status),
    failed: FAILED.has(status),
    modelUrl: d?.output?.model_url ?? d?.output?.pbr_model ?? d?.output?.model ?? null,
  }
}

/**
 * Vite plugin. Dev only — `vite build` produces static files with no server, so
 * a deployed build needs these three routes reimplemented on whatever actually
 * serves it. The client treats their absence as "no generation available" and
 * keeps the stand-in head, so a static build degrades instead of breaking.
 */
export function tripoProxy() {
  return {
    name: 'tripo-proxy',
    configureServer(server) {
      const key = process.env.TRIPO_API_KEY

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/tripo/')) return next()

        if (!key) {
          return json(res, 501, {
            error: 'TRIPO_API_KEY is not set. Put it in .env.local and restart the dev server.',
          })
        }

        try {
          const url = new URL(req.url, 'http://localhost')
          const path = url.pathname.replace('/api/tripo/', '')

          if (path === 'generate' && req.method === 'POST') {
            const contentType = req.headers['content-type'] || 'image/jpeg'
            const bytes = await readBody(req)
            if (!bytes.length) return json(res, 400, { error: 'no image was sent' })
            const taskId = await createTask(bytes, contentType, key)
            return json(res, 200, { taskId })
          }

          if (path.startsWith('status/') && req.method === 'GET') {
            const state = await pollTask(path.slice('status/'.length), key)
            return json(res, 200, {
              status: state.status,
              progress: state.progress,
              ready: state.ready,
              failed: state.failed,
            })
          }

          if (path.startsWith('model/') && req.method === 'GET') {
            const state = await pollTask(path.slice('model/'.length), key)
            if (!state.ready || !state.modelUrl) {
              return json(res, 409, { error: `model is not ready (${state.status})` })
            }
            const upstream = await fetch(state.modelUrl)
            if (!upstream.ok) {
              return json(res, 502, { error: `could not fetch the model (${upstream.status})` })
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'model/gltf-binary')
            res.setHeader('Cache-Control', 'no-store')
            const len = upstream.headers.get('content-length')
            if (len) res.setHeader('Content-Length', len)
            const buf = Buffer.from(await upstream.arrayBuffer())
            return res.end(buf)
          }

          return json(res, 404, { error: `unknown route ${path}` })
        } catch (err) {
          // 402-ish: out of credit is the single most likely failure here and
          // deserves to say so rather than reading as a bug in the app.
          const outOfCredit = err.code === 2010
          return json(res, outOfCredit ? 402 : (err.status ?? 500), {
            error: err.message || 'Tripo request failed',
            suggestion: err.suggestion,
            outOfCredit,
          })
        }
      })
    },
  }
}
