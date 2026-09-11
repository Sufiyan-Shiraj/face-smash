// Puts every runtime asset under public/ so Vite serves it verbatim in both dev
// and build, and so the app never touches a CDN at runtime. Venue wifi is
// assumed hostile; a demo that needs the network to start is a demo that fails
// at the judging table.
//
// Runs automatically on `npm install` (postinstall), or by hand: `npm run assets`.

import { createWriteStream } from 'node:fs'
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { ENVIRONMENT, PROPS } from '../src/assets/catalog.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PUBLIC = path.join(ROOT, 'public')

const MODELS = [
  {
    file: 'hand_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  },
  // Face landmarker is used once, to gate the capture screen on blink/smile/yaw.
  // It must never run in the same loop as the hand landmarker.
  {
    file: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
]

// FilesetResolver.forVisionTasks() picks between the SIMD and no-SIMD builds at
// runtime depending on the browser. The `module` variant is only for
// useModule:true, which we don't use — skipping it saves ~12 MB of deploy.
const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]

const size = async (p) => {
  try {
    return (await stat(p)).size
  } catch {
    return 0
  }
}

async function copyWasm() {
  const src = path.join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
  const dest = path.join(PUBLIC, 'mediapipe')
  await mkdir(dest, { recursive: true })

  for (const file of WASM_FILES) {
    const from = path.join(src, file)
    const to = path.join(dest, file)
    const fromSize = await size(from)
    if (!fromSize) throw new Error(`missing ${from} — is @mediapipe/tasks-vision installed?`)
    if ((await size(to)) === fromSize) {
      console.log(`✓ ${file}`)
      continue
    }
    await copyFile(from, to)
    console.log(`→ ${file} (${(fromSize / 1e6).toFixed(1)} MB)`)
  }
}

async function fetchModels() {
  const dest = path.join(PUBLIC, 'models')
  await mkdir(dest, { recursive: true })

  for (const { file, url } of MODELS) {
    const to = path.join(dest, file)
    const have = await size(to)
    if (have > 0) {
      console.log(`✓ ${file} (${(have / 1e6).toFixed(1)} MB)`)
      continue
    }
    process.stdout.write(`↓ ${file} ... `)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${file}: ${res.status} ${res.statusText}`)
    await pipeline(Readable.fromWeb(res.body), createWriteStream(to))
    console.log(`${((await size(to)) / 1e6).toFixed(1)} MB`)
  }
}

// --- Poly Haven props and environment ---------------------------------------
//
// All CC0, from a public keyless API. See src/assets/catalog.js for why the
// licence is the deciding factor rather than a footnote.

const PH_API = 'https://api.polyhaven.com/files'

async function download(url, to) {
  await mkdir(path.dirname(to), { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(to))
  return size(to)
}

async function fetchProps() {
  const dest = path.join(PUBLIC, 'models', 'props')
  const credits = []

  for (const { slug, author } of PROPS) {
    credits.push(`${slug} — ${author} (CC0, polyhaven.com)`)
    const dir = path.join(dest, slug)
    const main = path.join(dir, `${slug}_1k.gltf`)

    if (await size(main)) {
      console.log(`✓ ${slug}`)
      continue
    }

    process.stdout.write(`↓ ${slug} ... `)
    const files = await (await fetch(`${PH_API}/${slug}`)).json()
    const gltf = files.gltf?.['1k']?.gltf
    if (!gltf) throw new Error(`${slug}: no 1k glTF in the Poly Haven response`)

    // The .gltf is JSON that references its .bin and textures by RELATIVE path,
    // so every include has to land at exactly the key the API gives it or the
    // loader 404s on a file that did download.
    let total = await download(gltf.url, main)
    for (const [rel, f] of Object.entries(gltf.include ?? {})) {
      total += await download(f.url, path.join(dir, rel))
    }
    console.log(`${(total / 1e6).toFixed(1)} MB`)
  }

  await writeFile(
    path.join(dest, 'CREDITS.txt'),
    [
      'Props from Poly Haven (https://polyhaven.com), all CC0 / public domain.',
      'Attribution is not required. Listed because they did the work.',
      '',
      ...credits,
      '',
    ].join('\n')
  )
}

async function fetchEnvironment() {
  const to = path.join(PUBLIC, 'models', 'env', `${ENVIRONMENT.slug}_${ENVIRONMENT.res}.hdr`)
  if (await size(to)) {
    console.log(`✓ ${ENVIRONMENT.slug}`)
    return
  }
  process.stdout.write(`↓ ${ENVIRONMENT.slug} ... `)
  const files = await (await fetch(`${PH_API}/${ENVIRONMENT.slug}`)).json()
  const url = files.hdri?.[ENVIRONMENT.res]?.hdr?.url
  if (!url) throw new Error(`${ENVIRONMENT.slug}: no ${ENVIRONMENT.res} HDR`)
  console.log(`${((await download(url, to)) / 1e6).toFixed(1)} MB`)
}

await copyWasm()
await fetchModels()

// Props are a nice-to-have: every weapon has a procedural fallback that renders
// instantly, so a failure here must not break `npm install`.
try {
  await fetchProps()
  await fetchEnvironment()
} catch (err) {
  console.warn(`\n! props unavailable (${err.message})`)
  console.warn('  The game still runs — weapons fall back to their built-in shapes.')
}

console.log('\nRuntime assets ready under public/.')
