// Instant Image Preloader & GPU Texture Warmer
// Preloads and decodes all UI and background assets off the main thread
// using img.decode() so every route and component renders with 0ms lag.

import navbarImg from '../assets/common/paintbrush_navbar.webp'

// Upload View
import heroLogoImg from '../assets/upload/hero_logo.webp'
import punchedDudeImg from '../assets/upload/punched_dude.webp'
import crtComputerImg from '../assets/upload/crt_computer.webp'
import bgCanvasImg from '../assets/upload/background_canvas.webp'

// Scan View
import background2Img from '../assets/scan/background2.webp'
import scan3dImg from '../assets/scan/scan3d.webp'
import scandivImg from '../assets/scan/scandiv.webp'
import startscanImg from '../assets/scan/startscan.webp'
import nextdudeImg from '../assets/scan/nextdude.webp'
import cameraCardImg from '../assets/scan/camera_status_card.webp'
import almostThereImg from '../assets/scan/almost_there_badge.webp'

// Lab View
import background3Img from '../assets/smash/background3.webp'
import webcamImg from '../assets/smash/webcam.webp'
import glovePinkImg from '../assets/smash/glove_pink.webp'
import gloveSpikedImg from '../assets/smash/glove_spiked.webp'
import gloveDuckyImg from '../assets/smash/glove_ducky.webp'
import gloveHammerImg from '../assets/smash/glove_hammer.webp'
import gloveGauntletImg from '../assets/smash/glove_gauntlet.webp'

export const PRELOAD_ASSETS = {
  common: [navbarImg],
  upload: [heroLogoImg, bgCanvasImg, punchedDudeImg, crtComputerImg],
  scan: [
    background2Img,
    scan3dImg,
    scandivImg,
    startscanImg,
    nextdudeImg,
    cameraCardImg,
    almostThereImg,
  ],
  lab: [
    background3Img,
    webcamImg,
    glovePinkImg,
    gloveSpikedImg,
    gloveDuckyImg,
    gloveHammerImg,
    gloveGauntletImg,
  ],
}

const decodedCache = new Set()

/**
 * Preloads and decodes an image URL using the browser's img.decode() API.
 * Decoding off the main thread eliminates jank/freeze when the image is first rendered.
 */
export function preloadImage(src) {
  if (!src || decodedCache.has(src) || typeof window === 'undefined') {
    return Promise.resolve(src)
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.src = src
    decodedCache.add(src)

    if ('decode' in img) {
      img
        .decode()
        .then(() => resolve(src))
        .catch(() => resolve(src))
    } else {
      img.onload = () => resolve(src)
      img.onerror = () => resolve(src)
    }
  })
}

/**
 * Preload all images across all screens.
 * Tier 1 (Common & Upload) loads immediately in parallel.
 * Tier 2 (Scan & Lab) starts immediately after or during idle frames.
 */
export function preloadAllImages() {
  if (typeof window === 'undefined') return Promise.resolve()

  const tier1 = [...PRELOAD_ASSETS.common, ...PRELOAD_ASSETS.upload]
  const tier2 = [...PRELOAD_ASSETS.scan, ...PRELOAD_ASSETS.lab]

  // Start Tier 1 immediately
  const p1 = Promise.all(tier1.map(preloadImage))

  // Prefetch Tier 2 in parallel without blocking main thread
  const startTier2 = () => {
    tier2.forEach(preloadImage)
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(startTier2, { timeout: 300 })
  } else {
    setTimeout(startTier2, 50)
  }

  return p1
}

// Auto-start preloading as soon as the bundle loads
if (typeof window !== 'undefined') {
  preloadAllImages()
}
