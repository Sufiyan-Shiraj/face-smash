/**
 * Custom Comic & Manga SVG VFX Generator
 * Generates authentic, high-impact vector action bursts, explosive text badges,
 * and floating damage graphics without plain HTML text.
 */

// Palette of comic ink and vibrant fills
const PALETTES = {
  default: {
    stroke: '#100c1e',
    fillStart: '#ffe600',
    fillMid: '#ff2e88',
    fillEnd: '#a30048',
    textFill: '#ffffff',
    textStroke: '#100c1e',
    shadow: 'rgba(0, 0, 0, 0.85)',
  },
  critical: {
    stroke: '#150616',
    fillStart: '#fff275',
    fillMid: '#ff005b',
    fillEnd: '#7a0035',
    textFill: '#ffff80',
    textStroke: '#150616',
    shadow: 'rgba(255, 0, 91, 0.4)',
  },
  smash: {
    stroke: '#110d18',
    fillStart: '#00f0ff',
    fillMid: '#7928ca',
    fillEnd: '#ff0080',
    textFill: '#ffffff',
    textStroke: '#110d18',
    shadow: 'rgba(0, 240, 255, 0.45)',
  },
  gold: {
    stroke: '#1b1206',
    fillStart: '#ffffff',
    fillMid: '#ffd700',
    fillEnd: '#ff8800',
    textFill: '#ffffff',
    textStroke: '#1b1206',
    shadow: 'rgba(255, 200, 0, 0.5)',
  },
}

let vfxIdCounter = 0

/**
 * Generates a jagged, hand-drawn comic starburst polygon path.
 */
function makeStarburstPath(cx, cy, outerR, innerR, points = 16, seed = 0) {
  let d = ''
  const total = points * 2
  for (let i = 0; i < total; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2
    // Pseudo-random jitter for comic inking feel
    const jitter = 0.88 + (((i * 19 + seed * 7) % 11) / 11) * 0.24
    const r = (i % 2 === 0 ? outerR : innerR) * jitter
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    d += (i === 0 ? 'M ' : ' L ') + x.toFixed(1) + ' ' + y.toFixed(1)
  }
  return d + ' Z'
}

/**
 * Creates radial comic impact speed tick lines.
 */
function makeSpeedSpikes(cx, cy, rBase, count = 8, seed = 1) {
  let spikes = ''
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count + 0.15 + (((seed + i) % 5) * 0.08)
    const len = 14 + ((seed * 13 + i * 7) % 16)
    const w = 4 + (i % 3)
    const x1 = cx + Math.cos(angle) * rBase
    const y1 = cy + Math.sin(angle) * rBase
    const x2 = cx + Math.cos(angle) * (rBase + len)
    const y2 = cy + Math.sin(angle) * (rBase + len)
    const pAx = x1 + Math.cos(angle + Math.PI / 2) * (w / 2)
    const pAy = y1 + Math.sin(angle + Math.PI / 2) * (w / 2)
    const pBx = x1 - Math.cos(angle + Math.PI / 2) * (w / 2)
    const pBy = y1 - Math.sin(angle + Math.PI / 2) * (w / 2)
    spikes += `<polygon points="${pAx.toFixed(1)},${pAy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${pBx.toFixed(1)},${pBy.toFixed(1)}" fill="#ffe600" opacity="0.9" />`
  }
  return spikes
}

/**
 * Generates an authentic Manga/Marvel Action Comic Word SVG.
 */
export function createComicWordSvg(word, { strength = 0.5, isCritical = false, isSmash = false } = {}) {
  const id = ++vfxIdCounter
  const gradId = `cw_grad_${id}`
  const shadowGradId = `cw_sh_${id}`

  const palette = isSmash ? PALETTES.smash : isCritical ? PALETTES.critical : PALETTES.default

  const size = isSmash ? 240 : isCritical ? 210 : 180
  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.44
  const innerR = size * 0.26

  const starburstD = makeStarburstPath(cx, cy, outerR, innerR, 14, id)
  const speedSpikes = makeSpeedSpikes(cx, cy, outerR * 0.95, 8, id)

  const fontSize = Math.min(Math.round(size * 0.23), Math.round((size * 1.5) / Math.max(word.length, 4)))

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" class="comic-vfx-svg action-burst">
      <defs>
        <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.fillStart}" />
          <stop offset="55%" stop-color="${palette.fillMid}" />
          <stop offset="100%" stop-color="${palette.fillEnd}" />
        </linearGradient>
        <filter id="${shadowGradId}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="4" dy="5" stdDeviation="1" flood-color="#000000" flood-opacity="0.9" />
          <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="${palette.fillMid}" flood-opacity="0.6" />
        </filter>
      </defs>

      <g filter="url(#${shadowGradId})">
        <!-- Offset solid ink background for heavy comic drop-shadow -->
        <path d="${starburstD}" fill="${palette.stroke}" transform="translate(4, 5)" />

        <!-- Main vibrant starburst -->
        <path d="${starburstD}" fill="url(#${gradId})" stroke="${palette.stroke}" stroke-width="4" stroke-linejoin="round" />

        <!-- Radiating Action Speed Spikes -->
        ${speedSpikes}

        <!-- Center Comic Action Text with authentic double ink stroke -->
        <text
          x="${cx}"
          y="${cy + fontSize * 0.35}"
          text-anchor="middle"
          font-family="'Cabinet Grotesk', Impact, 'Arial Black', sans-serif"
          font-size="${fontSize}"
          font-weight="900"
          font-style="italic"
          letter-spacing="1px"
        >
          <!-- Deep ink shadow layer -->
          <tspan fill="${palette.stroke}" stroke="${palette.stroke}" stroke-width="8" stroke-linejoin="round" dx="3" dy="3">${word}</tspan>
          <!-- Top crisp vibrant layer -->
          <tspan x="${cx}" dy="-3" fill="${palette.textFill}" stroke="${palette.stroke}" stroke-width="3.5" stroke-linejoin="round">${word}</tspan>
        </text>
      </g>
    </svg>
  `
}

/**
 * Generates an SVG Floating Damage Number Badge.
 */
export function createDamageSvg(points, { isCritical = false, isSmash = false } = {}) {
  const id = ++vfxIdCounter
  const gradId = `dmg_grad_${id}`
  const glowId = `dmg_glow_${id}`

  const palette = isCritical ? PALETTES.critical : PALETTES.gold
  const formatted = `+${points.toLocaleString()}`

  const width = isCritical ? 240 : 190
  const height = 90
  const fontSize = isCritical ? 36 : 30

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="comic-vfx-svg damage-badge">
      <defs>
        <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.fillStart}" />
          <stop offset="50%" stop-color="${palette.fillMid}" />
          <stop offset="100%" stop-color="${palette.fillEnd}" />
        </linearGradient>
        <filter id="${glowId}" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="3" dy="4" stdDeviation="1" flood-color="#000000" flood-opacity="0.95" />
          <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="${isCritical ? '#ff005b' : '#ffaa00'}" flood-opacity="0.7" />
        </filter>
      </defs>

      <g filter="url(#${glowId})">
        ${
          isCritical
            ? `
          <!-- Spiked Critical Badge Diamond on the left -->
          <polygon points="20,45 32,24 54,18 48,40 68,45 48,52 54,72 32,66 20,45" fill="#ff005b" stroke="#000" stroke-width="2.5" />
          <text x="38" y="49" text-anchor="middle" font-family="'Cabinet Grotesk', Impact, sans-serif" font-size="11" font-weight="900" fill="#fff">CRIT!</text>
        `
            : `
          <!-- Mini Impact Glint Star on the left -->
          <polygon points="24,45 30,34 42,30 36,44 48,48 35,52 38,64 28,55 18,60 22,48" fill="#ffe600" stroke="#000" stroke-width="2" />
        `
        }

        <!-- Damage Numbers with dual-layer comic stroke -->
        <text
          x="${isCritical ? '65%' : '56%'}"
          y="${height * 0.62}"
          text-anchor="middle"
          font-family="'Cabinet Grotesk', Impact, 'Arial Black', sans-serif"
          font-size="${fontSize}"
          font-weight="900"
          font-style="italic"
          letter-spacing="1px"
        >
          <tspan fill="#100c1e" stroke="#100c1e" stroke-width="7" stroke-linejoin="round" dx="3" dy="3">${formatted}</tspan>
          <tspan x="${isCritical ? '65%' : '56%'}" dy="-3" fill="url(#${gradId})" stroke="#100c1e" stroke-width="3" stroke-linejoin="round">${formatted}</tspan>
        </text>
      </g>
    </svg>
  `
}

/**
 * Spawns an animated SVG comic VFX element into a container with auto-cleanup.
 */
export function spawnComicHit(container, pos, { word, points, strength = 0.5, isCritical = false, isSmash = false }) {
  if (!container) return

  // 1. Spawn Comic Action Word Starburst
  if (word && strength > 0.35) {
    const burstWrapper = document.createElement('div')
    burstWrapper.className = 'comic-svg-wrapper action-wrapper'
    burstWrapper.style.left = `${pos.x}px`
    burstWrapper.style.top = `${pos.y - 40}px`
    const rot = (Math.random() * 26 - 13).toFixed(1)
    burstWrapper.style.setProperty('--rot', `${rot}deg`)
    burstWrapper.innerHTML = createComicWordSvg(word, { strength, isCritical, isSmash })

    burstWrapper.addEventListener('animationend', () => burstWrapper.remove(), { once: true })
    container.appendChild(burstWrapper)
  }

  // 2. Spawn Floating Damage Badge SVG
  if (points) {
    const dmgWrapper = document.createElement('div')
    dmgWrapper.className = 'comic-svg-wrapper damage-wrapper'
    dmgWrapper.style.left = `${pos.x + (Math.random() * 32 - 16)}px`
    dmgWrapper.style.top = `${pos.y + 15 + (Math.random() * 20 - 10)}px`
    const dmgRot = (Math.random() * 16 - 8).toFixed(1)
    dmgWrapper.style.setProperty('--rot', `${dmgRot}deg`)
    dmgWrapper.innerHTML = createDamageSvg(points, { isCritical, isSmash })

    dmgWrapper.addEventListener('animationend', () => dmgWrapper.remove(), { once: true })
    container.appendChild(dmgWrapper)
  }

  // Cap max active elements to maintain locked 60+ FPS
  while (container.children.length > 12) {
    container.removeChild(container.firstChild)
  }
}
