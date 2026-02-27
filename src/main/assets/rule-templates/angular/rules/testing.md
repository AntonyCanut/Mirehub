---
description: "Angular testing with TestBed"
paths:
  - "**/*.spec.ts"
  - "**/*.test.ts"
  - "**/*.e2e.ts"
---

# Testing

## Stack

- **Vitest** — default unit test runner (replaces Karma/Jasmine)
- **Playwright** — E2E testing
- Use `vi.fn()`, `vi.spyOn()` for mocks

## Zoneless Testing

- Angular 21 is zoneless by default; for pre-v21 codebases, add `provideZonelessChangeDetection()` in TestBed providers
- DO prefer `await fixture.whenStable()` over `fixture.detectChanges()` in zoneless — ensures all signals are settled
- DO use `fixture.componentRef.setInput('name', value)` for signal inputs
- DO read signal values directly: `expect(component.mySignal()).toBe(expected)`

## RxJS Testing — Marble Only

- DO NOT use `.subscribe()` for testing RxJS streams — use `TestScheduler` with marble syntax
- Exception: `output()` testing uses `.subscribe()` because it is event-based, not stream-based

| Marble symbol | Meaning |
|---|---|
| `-` | 10ms time frame |
| `a-z` | Emission |
| `\|` | Complete |
| `#` | Error |

## Service Mocking

- DO create mock objects with `vi.fn()` methods
- DO provide mocks via `{ provide: ServiceClass, useValue: mockObj }`

## NgRx Testing

- **Reducers**: call reducer function directly with state + action, assert new state
- **Selectors**: use `.projector()` for isolated selector testing
- **Effects**: use `TestScheduler` marble testing with `hot()` / `cold()` / `expectObservable()`

## Component Testing

- DO test inputs, outputs, and rendered output
- DO test user interactions (click, type) + verify resulting state/emissions
- DO group tests by behavior: `describe('when loading')`, `describe('when user clicks')`

## E2E (Playwright)

- DO use Page Object pattern for reusable page interactions
- DO use `getByTestId()`, `getByRole()`, `getByText()` locators
- DO use `@axe-core/playwright` for accessibility audits

## Coverage Targets

| Layer | Target |
|---|---|
| Reducers, selectors | 100% |
| Effects | Success + error paths (marble) |
| Business logic services | >80% |
| UI components | Inputs, outputs, rendering |
| E2E | Critical user flows |
