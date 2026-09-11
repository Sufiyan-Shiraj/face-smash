import { useState, useEffect, useRef } from 'react'

export function useParallax(lerpFactor = 0.12) {
  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
    rawX: 0,
    rawY: 0,
  })

  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })
  const animFrameRef = useRef(null)

  useEffect(() => {
    // Respect reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mediaQuery.matches) return

    const handleMouseMove = (e) => {
      const { innerWidth, innerHeight } = window
      // Calculate normalized coords between -1 and 1 (0 at center)
      const nx = (e.clientX / innerWidth) * 2 - 1
      const ny = (e.clientY / innerHeight) * 2 - 1
      targetRef.current = {
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      }
    }

    const handleDeviceOrientation = (e) => {
      if (e.gamma === null || e.beta === null) return
      const nx = Math.max(-1, Math.min(1, e.gamma / 25))
      const ny = Math.max(-1, Math.min(1, (e.beta - 45) / 25))
      targetRef.current = { x: nx, y: ny }
    }

    const handleMouseLeave = () => {
      targetRef.current = { x: 0, y: 0 }
    }

    // Smoothed 60-120fps animation loop
    const animate = () => {
      const dx = targetRef.current.x - currentRef.current.x
      const dy = targetRef.current.y - currentRef.current.y

      if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
        currentRef.current.x += dx * lerpFactor
        currentRef.current.y += dy * lerpFactor

        setCoords({
          x: currentRef.current.x,
          y: currentRef.current.y,
          rawX: targetRef.current.x,
          rawY: targetRef.current.y,
        })
      }

      animFrameRef.current = requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true })

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('deviceorientation', handleDeviceOrientation)
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [lerpFactor])

  const getOffset = (maxPxX, maxPxY, invert = false) => {
    const py = maxPxY !== undefined ? maxPxY : maxPxX
    const factor = invert ? -1 : 1
    return {
      x: coords.x * maxPxX * factor,
      y: coords.y * py * factor,
    }
  }

  const getTilt = (maxAngleX, maxAngleY) => {
    return {
      rotateX: -coords.y * maxAngleX,
      rotateY: coords.x * maxAngleY,
    }
  }

  return {
    ...coords,
    getOffset,
    getTilt,
  }
}
