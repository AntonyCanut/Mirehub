import { describe, it, expect } from 'vitest'

/**
 * Tests for the collapse/expand logic used in ProjectItem.
 *
 * The component behavior is:
 * - `expanded` state is initialized to `isActive`
 * - When `isActive` becomes true, `expanded` is set to true (useEffect)
 * - When `isActive` becomes false, `expanded` is NOT forced to false
 * - Click on active project toggles expanded
 * - Click on inactive project sets it active + expanded
 *
 * We test this logic as pure state transitions without React rendering.
 */

interface CollapseState {
  isActive: boolean
  expanded: boolean
}

/**
 * Simulate initial state (equivalent to useState(isActive))
 */
function createState(isActive: boolean): CollapseState {
  return { isActive, expanded: isActive }
}

/**
 * Simulate the useEffect that fires when isActive changes:
 *   if (isActive) setExpanded(true)
 */
function onActiveChange(state: CollapseState, newIsActive: boolean): CollapseState {
  const next = { ...state, isActive: newIsActive }
  if (newIsActive) {
    next.expanded = true
  }
  return next
}

/**
 * Simulate click on the project item:
 *   if (isActive) toggle expanded
 *   else set active + expanded
 */
function onClick(state: CollapseState): CollapseState {
  if (state.isActive) {
    return { ...state, expanded: !state.expanded }
  }
  return { ...state, isActive: true, expanded: true }
}

describe('Collapse/Expand Logic (ProjectItem)', () => {
  describe('etat initial', () => {
    it('projet actif demarre expanded', () => {
      const state = createState(true)
      expect(state.expanded).toBe(true)
    })

    it('projet inactif demarre collapsed', () => {
      const state = createState(false)
      expect(state.expanded).toBe(false)
    })
  })

  describe('click sur un projet actif', () => {
    it('collapse un projet expanded', () => {
      const state = createState(true)
      expect(state.expanded).toBe(true)

      const after = onClick(state)
      expect(after.expanded).toBe(false)
    })

    it('expand un projet collapsed', () => {
      let state = createState(true)
      state = onClick(state) // collapse
      expect(state.expanded).toBe(false)

      state = onClick(state) // expand
      expect(state.expanded).toBe(true)
    })

    it('toggle multiple fois', () => {
      let state = createState(true)
      expect(state.expanded).toBe(true)

      state = onClick(state)
      expect(state.expanded).toBe(false)

      state = onClick(state)
      expect(state.expanded).toBe(true)

      state = onClick(state)
      expect(state.expanded).toBe(false)
    })
  })

  describe('click sur un projet inactif', () => {
    it('le selectionne et l expand', () => {
      const state = createState(false)
      expect(state.isActive).toBe(false)
      expect(state.expanded).toBe(false)

      const after = onClick(state)
      expect(after.isActive).toBe(true)
      expect(after.expanded).toBe(true)
    })
  })

  describe('changement de isActive (useEffect)', () => {
    it('passer a actif force expanded a true', () => {
      const state = createState(false)
      expect(state.expanded).toBe(false)

      const after = onActiveChange(state, true)
      expect(after.isActive).toBe(true)
      expect(after.expanded).toBe(true)
    })

    it('passer a inactif ne force PAS expanded a false (comportement cle)', () => {
      // C'est le test le plus important: expanded est independant de isActive
      let state = createState(true)
      expect(state.expanded).toBe(true)

      // Un autre projet devient actif, celui-ci devient inactif
      const after = onActiveChange(state, false)
      expect(after.isActive).toBe(false)
      // expanded reste true! C'est le comportement voulu
      expect(after.expanded).toBe(true)
    })

    it('expanded reste collapsed si le projet devient inactif apres un collapse', () => {
      let state = createState(true)
      state = onClick(state) // collapse
      expect(state.expanded).toBe(false)

      // Passer a inactif ne change pas expanded
      const after = onActiveChange(state, false)
      expect(after.expanded).toBe(false)
    })
  })

  describe('scenario complet de navigation multi-projets', () => {
    it('scenario: A actif, collapse A, selectionner B, revenir a A', () => {
      // Projet A est actif et expanded
      let stateA = createState(true)
      let stateB = createState(false)
      expect(stateA.expanded).toBe(true)
      expect(stateB.expanded).toBe(false)

      // L'utilisateur collapse le projet A
      stateA = onClick(stateA)
      expect(stateA.expanded).toBe(false)

      // L'utilisateur clique sur le projet B (B devient actif, A devient inactif)
      stateB = onClick(stateB)
      stateA = onActiveChange(stateA, false)
      expect(stateB.isActive).toBe(true)
      expect(stateB.expanded).toBe(true)
      expect(stateA.isActive).toBe(false)
      // A reste collapsed car onActiveChange(false) ne force pas expanded
      expect(stateA.expanded).toBe(false)

      // L'utilisateur revient au projet A (A redevient actif via useEffect)
      stateA = onActiveChange(stateA, true)
      stateB = onActiveChange(stateB, false)
      // A est force a expanded=true par le useEffect
      expect(stateA.expanded).toBe(true)
      // B reste expanded car le useEffect ne force pas false
      expect(stateB.expanded).toBe(true)
    })

    it('scenario: expanded persiste quand un projet perd le focus', () => {
      // Projet A expanded et actif
      let stateA = createState(true)
      expect(stateA.expanded).toBe(true)

      // A perd le focus (un autre projet selectionne)
      stateA = onActiveChange(stateA, false)

      // A garde son etat expanded
      expect(stateA.expanded).toBe(true)
      expect(stateA.isActive).toBe(false)
    })
  })
})
