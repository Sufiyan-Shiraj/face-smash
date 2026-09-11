// Holds the captured views between routes.
//
// Live capture and photo upload converge here: both produce the same cropped
// square JPEGs, scored and slotted by head angle, so everything downstream —
// the review thumbnails, the Tripo request — is written once.

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024 // Tripo's own per-image ceiling

let views = null // { front, left, right } — `back` is deliberately unused

export function setViews(next) {
  clear()
  views = next
}

export function getViews() {
  return views
}

export function hasUsableViews() {
  if (!views?.front) return false
  return ['front', 'left', 'right'].filter((k) => views[k]).length >= 2
}

export function clear() {
  views = null
}

/** Decode a user-supplied image file into something we can score and crop. */
export async function decodeImageFile(file) {
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
    return { ok: false, error: `${file.type} isn't supported. Use JPEG, PNG or WebP.` }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `That image is ${(file.size / 1048576).toFixed(0)} MB. The limit is ${MAX_IMAGE_BYTES / 1048576} MB.`,
    }
  }

  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d').drawImage(bitmap, 0, 0)
    bitmap.close?.()
    return { ok: true, canvas, name: file.name }
  } catch {
    return { ok: false, error: `${file.name} could not be decoded as an image.` }
  }
}
