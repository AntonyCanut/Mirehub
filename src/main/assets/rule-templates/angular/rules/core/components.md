---
description: "Angular component patterns and @defer"
paths:
  - "**/libs/**/feature/**/*.ts"
  - "**/libs/**/ui/**/*.ts"
  - "**/apps/**/*.component.ts"
---

# Component Rules

## Visibility Modifiers (mandatory on every class member)

| Visibility | When |
|---|---|
| `private readonly` | Injected services, internal state, helpers |
| `protected readonly` | Template-bound signals and computed |
| `public readonly` | Signal inputs, outputs, model — the component API |

## Signal-Based Inputs / Outputs / Queries

- DO use `input()`, `input.required()` — never `@Input()`
- DO use `output()` — never `@Output()` + `EventEmitter`
- DO use `model()` / `model.required()` for two-way binding (`[(value)]`)
- DO use `viewChild()` / `viewChildren()` — never `@ViewChild()`
- DO use `contentChild()` / `contentChildren()` — never `@ContentChild()`

## ChangeDetectionStrategy.OnPush

- DO add `changeDetection: ChangeDetectionStrategy.OnPush` on every component
- Rationale: not the default yet; OnPush ensures optimal performance with signals and zoneless

## File Structure

- DO use external templates (`templateUrl`) and styles (`styleUrl`)
- DO NOT use inline `template:` or `styles:`

## @defer — Component-Level Lazy Loading

- DO use `@defer (on viewport)` for below-the-fold / heavy components
- DO use `@defer (when condition())` for conditionally shown heavy components
- DO always provide `@placeholder` and `@loading` blocks

## Smart Components (feature/)

- When using NgRx: inject `Store`, dispatch actions, use `selectSignal()`
- DO pass data down via `input()`, handle events via `output()`
- DO NOT place business logic in the template

## UI Components (ui/)

- DO NOT inject `Store`, `HttpClient`, or `Router`
- DO accept data via `input()` / `input.required()`, emit via `output()`
- Must be testable in complete isolation

