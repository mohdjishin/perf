# E2E tests (Playwright)

Browser tests that run against the real app. **Not unit tests.**

## Prerequisites

- **Backend** running (e.g. `go run .` in project root) so `/api` and `/home` work.
- **Frontend** will be started by Playwright if not already running (`reuseExistingServer: true`).

## Run tests

```bash
# From repo root, start backend first (in another terminal):
cd backend && go run .

# From frontend folder:
cd frontend
npm run test:e2e
```

Or with UI (step through tests in the browser):

```bash
npm run test:e2e:ui
```

## What’s covered

- **Home:** Hero and “Explore Collection” visible; navigation to Shop.
- **Shop:** Page loads; search and Refine button visible.
- **Auth:** Login and Register pages load and show form fields.

## Config

- `playwright.config.js`: baseURL `http://127.0.0.1:5173`, Chromium, dev server reused if already running.
