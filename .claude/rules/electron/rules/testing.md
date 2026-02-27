---
author: "SpaceMalamute"
authorUrl: "https://github.com/SpaceMalamute"
---

---
description: "Electron testing patterns — Vitest for unit, Playwright for E2E"
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/*.e2e.ts"
  - "**/*.e2e-spec.ts"
---

# Testing

## Stack

- **Vitest** for unit tests (main process logic, shared utilities)
- **Playwright** with `_electron.launch()` for E2E tests
- Test IPC handlers in isolation — mock `event` and assert return values

## Unit Tests (Vitest)

- Test main process handlers as pure functions where possible
- Mock Electron APIs (`BrowserWindow`, `app`, `dialog`) with `vi.mock`
- Test preload bridge types match the exposed API contract

## GOOD

```typescript
import { describe, it, expect, vi } from 'vitest';
import { handleFileRead } from '../src/main/ipc/file-handler';

describe('file:read handler', () => {
  it('reads file from userData directory', async () => {
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = await handleFileRead(mockEvent, 'config.json');
    expect(result).toContain('{');
  });

  it('rejects invalid file path', async () => {
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    await expect(handleFileRead(mockEvent, 123 as any)).rejects.toThrow();
  });
});
```

## E2E Tests (Playwright)

- Use `_electron.launch()` to start the app
- Access the main window via `electronApp.firstWindow()`
- Test real IPC round-trips through the UI

## GOOD

```typescript
import { test, expect, _electron } from '@playwright/test';

test('app launches and shows main window', async () => {
  const app = await _electron.launch({ args: ['.'] });
  const window = await app.firstWindow();

  await expect(window.locator('h1')).toBeVisible();
  await app.close();
});

test('file open dialog works', async () => {
  const app = await _electron.launch({ args: ['.'] });
  const window = await app.firstWindow();

  await window.click('[data-testid="open-file"]');
  await expect(window.locator('.file-content')).toBeVisible();
  await app.close();
});
```

## BAD

```typescript
// Using Spectron — deprecated since Electron 20
import { Application } from 'spectron';

// Testing private BrowserWindow internals instead of user-facing behavior
expect(win.webPreferences.contextIsolation).toBe(true);

// Not closing the app after test — leaves zombie processes
test('my test', async () => {
  const app = await _electron.launch({ args: ['.'] });
  // Missing app.close()
});
```

## Test Organization

- `src/main/**/*.test.ts` — main process unit tests
- `src/shared/**/*.test.ts` — shared utility tests
- `tests/e2e/**/*.e2e.ts` — E2E tests with Playwright
