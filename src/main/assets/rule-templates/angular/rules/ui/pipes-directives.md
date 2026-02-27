---
description: "Angular pipes and custom directives"
paths:
  - "**/*.pipe.ts"
  - "**/*.directive.ts"
  - "**/pipes/**"
  - "**/directives/**"
---

# Pipes & Directives

## Template Control Flow (not pipes)

- DO use `@if`, `@else if`, `@else` — never `*ngIf`
- DO use `@for (item of items(); track item.id)` — never `*ngFor`
- DO use `@switch` / `@case` / `@default` — never `[ngSwitch]`
- These are built-in syntax since Angular 17 — no imports needed

## Custom Pipes

- DO keep pipes pure (default) — impure pipes cause performance issues
- DO accept parameters via `transform(value, ...args)` method
- Common custom pipes: `timeAgo`, `truncate`, `filter`, `safeHtml`

## Custom Directives

- DO use `takeUntilDestroyed()` for RxJS subscriptions in directives

### Attribute Directives

- For DOM behavior (highlight, click-outside, auto-focus, debounce-input)
- DO prefer `host: { '(event)': 'handler($event)' }` in @Component/@Directive metadata over `@HostListener` — simpler, no separate decorator
- Alternatively, use `fromEvent()` + `takeUntilDestroyed()` for event handling

### Structural Directives

- For conditional rendering (permission-based, feature-flag)
- DO inject `TemplateRef` and `ViewContainerRef`
- DO use `effect()` to react to input signal changes

## Anti-patterns

- DO NOT use `pure: false` on pipes — causes re-evaluation every CD cycle; update source data via signals instead
- DO NOT manipulate DOM via `nativeElement.innerHTML` — use `Renderer2` or Angular bindings
- DO NOT use `*ngIf`, `*ngFor`, `[ngSwitch]` — use built-in control flow (`@if`, `@for`, `@switch`)
