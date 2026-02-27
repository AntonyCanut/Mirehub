---
description: "Angular signal-based reactive forms"
paths:
  - "**/*.component.ts"
  - "**/*.component.html"
  - "**/forms/**/*.ts"
  - "**/*-form.component.ts"
  - "**/*-form/**/*.ts"
---

# Forms

## Strategy Selection

| Approach | When to use |
|---|---|
| Signal-based (`signal()` + `computed()`) | Default for new forms — simple, reactive, no extra module |
| Reactive Forms (`FormGroup` / `FormControl`) | Complex cross-field validation, dynamic schema-driven forms |
| Signal Forms (experimental, Angular 21+) | Available for new forms; expected to stabilize in a future release |

## Signal-Based Forms (default)

- DO use `signal()` for each form field
- DO use `computed()` for validation (derived from field signals)
- DO use `computed()` for overall `isValid` flag
- DO use `linkedSignal()` when form values must reset on external state change (e.g., selected entity changes)

```typescript
protected readonly email = linkedSignal(() => this.selectedUser().email);
```

## Two-Way Binding

- DO use `model()` for component inputs that support `[(value)]` binding
- For template-driven: `[ngModel]="field()" (ngModelChange)="field.set($event)"`

## Nested Objects

- DO use `signal<FormType>({ ... })` for the whole form object
- DO use `update()` with spread for immutable field updates

## Submission

- DO track `isSubmitting` signal — disable button and show loading state
- DO track `submitError` signal — display error feedback
- DO reset form signals on successful submission
- DO NOT submit without checking `isValid()`

## Async Validation

- DO use RxJS `debounceTime` + `takeUntilDestroyed` for server-side checks (username availability)
- DO show checking/available/taken states to the user

## Anti-patterns

- DO NOT use `BehaviorSubject` for form state — use `signal()`
- DO NOT use manual subscriptions for validation — use `computed()`
- DO NOT submit forms without loading and error state handling
- DO NOT forget `type="button"` on non-submit buttons inside `<form>` — they default to submit
