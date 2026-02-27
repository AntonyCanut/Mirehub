---
description: "Web accessibility and ARIA patterns"
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.html"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/components/**/*.ts"
---

# Accessibility Rules (WCAG 2.2)

## Semantic HTML

- Use correct elements: `<button>` not `<div onclick>`, `<h1>` not `<div class="heading">`
- Maintain heading hierarchy: h1 > h2 > h3 — never skip levels
- Use landmark elements: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`

## Images

- All informative images must have descriptive `alt` text
- Decorative images: `alt="" role="presentation"`
- Complex images: use `<figure>` + `<figcaption>` for detailed description

## Forms

- Every input must have an associated `<label>` or `aria-label`
- DO NOT use `placeholder` as the only label — it disappears on focus
- Link error messages with `aria-describedby` and mark invalid fields with `aria-invalid="true"`
- Use `required` and `aria-required="true"` for required fields

## Keyboard Navigation

- All interactive elements must be keyboard accessible (Tab, Enter, Escape, Arrow keys)
- Trap focus inside modals — cycle between first and last focusable elements
- Never remove focus outline without a visible replacement — use `:focus-visible`
- Provide skip links for main content

## ARIA

- Prefer native HTML over ARIA — use ARIA only when HTML semantics are not enough
- Use `aria-live="polite"` for dynamic content updates
- Use `role="alert"` for urgent announcements
- Manage expanded/collapsed state: `aria-expanded`, `aria-controls`

## Color and Contrast

- Normal text: 4.5:1 contrast ratio minimum
- Large text (18px+ or 14px+ bold): 3:1 minimum
- DO NOT rely on color alone to convey information — add icons or text

## Motion

- Respect `prefers-reduced-motion: reduce` — disable animations for users who request it

## Testing

- Automated: axe-core, eslint-plugin-jsx-a11y, @angular-eslint
- Manual: keyboard-only navigation, screen reader (VoiceOver/NVDA), 200% zoom, high contrast mode

## Anti-patterns

- DO NOT use `<div>` or `<span>` for interactive elements — use `<button>` or `<a>`
- DO NOT remove `:focus` outline without replacement
- DO NOT skip heading levels
- DO NOT use ARIA when native HTML suffices
