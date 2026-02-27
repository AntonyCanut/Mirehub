import { describe, it, expect } from 'vitest'
import { clampPanelHeight } from '../../src/renderer/components/DatabaseQueryArea'

/**
 * Tests for the panel resize clamping logic used in DatabaseQueryArea.
 *
 * The component has 3 vertically stacked panels (editor, results, NL chat)
 * separated by draggable dividers. The clampPanelHeight function ensures
 * panel heights stay within bounds:
 * - Minimum: 80px
 * - Maximum: 60% of container height (fallback 400px if no container)
 *
 * Editor divider: clampPanelHeight(current, +deltaY, containerHeight)
 * Chat divider:   clampPanelHeight(current, -deltaY, containerHeight)
 */

describe('clampPanelHeight', () => {
  describe('cas nominal', () => {
    it('applique un delta positif dans les limites', () => {
      // 150 + 50 = 200, max = 600 * 0.6 = 360
      expect(clampPanelHeight(150, 50, 600)).toBe(200)
    })

    it('applique un delta negatif dans les limites', () => {
      // 200 - 50 = 150, min = 80
      expect(clampPanelHeight(200, -50, 600)).toBe(150)
    })

    it('retourne la meme valeur si delta est 0', () => {
      expect(clampPanelHeight(150, 0, 600)).toBe(150)
    })
  })

  describe('clamp minimum (80px)', () => {
    it('ne descend pas sous 80px', () => {
      // 100 - 50 = 50, clamp a 80
      expect(clampPanelHeight(100, -50, 600)).toBe(80)
    })

    it('ne descend pas sous 80px avec un grand delta negatif', () => {
      expect(clampPanelHeight(150, -500, 600)).toBe(80)
    })

    it('reste a 80px si deja au minimum avec delta negatif', () => {
      expect(clampPanelHeight(80, -10, 600)).toBe(80)
    })

    it('peut remonter depuis le minimum', () => {
      expect(clampPanelHeight(80, 20, 600)).toBe(100)
    })
  })

  describe('clamp maximum (60% du conteneur)', () => {
    it('ne depasse pas 60% du conteneur', () => {
      // 300 + 200 = 500, max = 600 * 0.6 = 360
      expect(clampPanelHeight(300, 200, 600)).toBe(360)
    })

    it('fonctionne avec un petit conteneur', () => {
      // 100 + 100 = 200, max = 200 * 0.6 = 120
      expect(clampPanelHeight(100, 100, 200)).toBe(120)
    })

    it('reste au max si deja au maximum avec delta positif', () => {
      // max = 1000 * 0.6 = 600
      expect(clampPanelHeight(600, 10, 1000)).toBe(600)
    })

    it('peut redescendre depuis le maximum', () => {
      // max = 1000 * 0.6 = 600, 600 - 100 = 500
      expect(clampPanelHeight(600, -100, 1000)).toBe(500)
    })
  })

  describe('fallback sans conteneur (max = 400px)', () => {
    it('utilise 400px comme max quand containerHeight est null', () => {
      // 300 + 200 = 500, clamp a 400
      expect(clampPanelHeight(300, 200, null)).toBe(400)
    })

    it('applique le min normalement sans conteneur', () => {
      expect(clampPanelHeight(100, -50, null)).toBe(80)
    })

    it('permet des valeurs dans les limites sans conteneur', () => {
      expect(clampPanelHeight(150, 50, null)).toBe(200)
    })
  })

  describe('simulation resize editeur (delta positif = agrandir)', () => {
    it('agrandit l editeur en tirant le divider vers le bas', () => {
      const initial = 150
      const containerH = 800
      // Simule un drag de +30px
      const result = clampPanelHeight(initial, 30, containerH)
      expect(result).toBe(180)
    })

    it('reduit l editeur en tirant le divider vers le haut', () => {
      const initial = 150
      const containerH = 800
      // Simule un drag de -30px
      const result = clampPanelHeight(initial, -30, containerH)
      expect(result).toBe(120)
    })
  })

  describe('simulation resize chat (delta inverse)', () => {
    it('agrandit le chat en tirant le divider vers le haut (delta negatif inverse)', () => {
      const initial = 200
      const containerH = 800
      // Chat utilise -deltaY, donc drag vers le haut (deltaY=-30) => -(-30) = +30
      const result = clampPanelHeight(initial, 30, containerH)
      expect(result).toBe(230)
    })

    it('reduit le chat en tirant le divider vers le bas (delta positif inverse)', () => {
      const initial = 200
      const containerH = 800
      // Chat utilise -deltaY, donc drag vers le bas (deltaY=+30) => -(+30) = -30
      const result = clampPanelHeight(initial, -30, containerH)
      expect(result).toBe(170)
    })
  })
})
