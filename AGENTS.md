# AI Agent Guide — Blue Mist Perfumes E‑commerce

This document is for **AI agents** (including Antigravity and other coding assistants) to understand the codebase, styling, and conventions so they can extend the backend and frontend correctly and consistently.

---

## 1. What This App Is

- **Product**: E‑commerce web app for **Blue Mist Perfumes** (oud, bakhoor, attar, oriental fragrances).
- **Stack**:
  - **Backend**: Go 1.21+, Gin, MongoDB. Module: `perfume-store`.
  - **Frontend**: React 18, Vite 5, react-router-dom 6, i18next (EN/AR), recharts. No axios — native `fetch` via `api()`.
  - **Testing**: Playwright for E2E testing (frontend and integration).
- **Users**: Customers (shop, cart, checkout, orders, addresses, profile); Admins (products, orders, categories, upload, returns, reviews, stock); Super Admins (users, audit, analytics, feature flags, seasonal banner, order fees, stores, investigate).
- **Design**: “Blue Mist” — minimal blue theme, single blue accent, clean whites, serif + sans typography, RTL support for Arabic.

---

## 2. Project Layout (Quick Reference)

```
ecom/
├── backend/
│   ├── main.go              # Entry: config, DB, seeds, Gin engine, CORS, routes, graceful shutdown
│   ├── CONFIG.md            # Backend configuration guide (host, CORS, env)
│   ├── config/              # config.go (Load from config.json)
│   ├── database/            # mongo.go (Connect/Disconnect), indexes.go
│   ├── handlers/            # HTTP handlers (auth, products, home, orders, users, categories, banners, settings, audit, analytics, addresses, upload, health, geocode, orderfee, returns, reviews, stores)
│   ├── middleware/         # auth.go, rbac.go, request_logger.go, logger.go, ratelimit.go
│   ├── models/              # product.go, user.go, order.go, address.go, audit.go
│   ├── routes/              # routes.go (Setup)
│   ├── logger/              # zerolog wrapper
│   └── utils/               # pagination.go, jwt.go, password.go, audit.go
├── frontend/
│   ├── index.html           # Root; fonts: Cormorant Garamond, DM Sans
│   ├── public/config.json   # apiBaseUrl (e.g. "/api")
│   ├── e2e/                 # Playwright E2E tests (*.spec.js)
│   ├── src/
│   │   ├── main.jsx         # React root, BrowserRouter, App, i18n, index.css
│   │   ├── App.jsx          # Routes, lazy pages, ProtectedRoute, Layout + Outlet
│   │   ├── api/client.js    # api(), uploadFile(), setApiBaseUrl()
│   │   ├── config.js        # loadConfig() from /config.json
│   │   ├── context/         # AuthContext, CartContext
│   │   ├── components/     # Navbar, Footer, Layout, Pagination, BackButton, EmptyState, Skeleton, SeasonalBanner, Toast, etc.
│   │   ├── pages/          # Home, Shop, Product, Cart, Checkout, Login, Register, Profile, Orders, ShopLocator; admin/* (ReturnRequests, Reviews, Stock); superadmin/* (Investigate, OrderFee, StoreLocations)
│   │   ├── i18n/            # index.js (i18next), translations.js (en/ar)
│   │   ├── utils/           # currency.js, productI18n.js
│   │   └── styles/         # shared.css (tokens-based shared UI)
│   └── vite.config.js       # Proxy /api, /health, /ping, /uploads → backend
└── AGENTS.md                # This file
```

---

## 3. Backend Conventions (Go)

### 3.1 Adding a New Route

1. **Handler**: Add a new func in the appropriate file under `backend/handlers/`, e.g. `func MyHandler(c *gin.Context)`.
2. **Doc comment**: Put a short comment above **every exportable** function (e.g. `// MyHandler does X`).
3. **Register route**: In `backend/routes/routes.go`, add the route under the correct group:
   - Public (no auth): `api.GET("/path", handlers.MyHandler)` or with `middleware.OptionalAuth()` if role affects response.
   - Authenticated: inside `auth := api.Group(""); auth.Use(middleware.Auth())`.
   - Admin: `adminGroup.Use(middleware.Auth(), middleware.RequireAdmin())`.
   - Customer-only: `userOnly.Use(middleware.Auth(), middleware.RequireRole(models.RoleCustomer))`.
   - Super Admin only: `superAdmin.Use(middleware.Auth(), middleware.RequireSuperAdmin())`.

### 3.2 Handler Pattern

- **Request**: JSON body → `c.ShouldBindJSON(&req)` with struct tags `binding:"required"`, `email`, `min=6`, etc. Path params → `c.Param("id")`. Query → `c.Query("key")`. Pagination → `utils.GetPageLimit(c)` (page, limit; default 1, 12; max limit 100).
- **Response**: Success → `c.JSON(http.StatusOK, gin.H{"key": value})` or struct. Error → `c.JSON(status, gin.H{"error": "message"})`. Use 200/201/204 for success; 400/401/403/404/409/500/503 for errors.
- **DB**: `database.DB.Collection("collection_name")`; use `context.Background()`; `bson.M` for filters; `options.Find().SetSort().SetSkip().SetLimit().SetProjection()` where needed.
- **Auth in handler**: After `middleware.Auth()`, use `c.GetString("user_id")`, `c.GetString("user_email")`, `c.GetString("user_role")`.

### 3.3 Models

- Use `primitive.ObjectID` for IDs; BSON tags `bson:"snake_case"`, JSON tags `json:"camelCase"`.
- Request DTOs: name like `CreateXxxRequest`, `UpdateXxxRequest`; use pointers for optional PATCH fields.
- Add new collections in `database/indexes.go` if you need indexes.

### 3.4 Naming

- Packages: lowercase. Exported funcs/types: PascalCase. Request structs: `XxxRequest`. Handlers: verb or noun (e.g. `ListProducts`, `GetProduct`, `CreateOrder`).

### 3.5 Configuration (config.json)

- **CORS**: `cors_origins` array in `config.json` allows multiple origins.
- **Host**: Set `host` to `0.0.0.0` for external accessibility (e.g., mobile testing).
- **Environment**: `app_env` should be `production` for live deployments.
- **Secrets**: Change `jwt_secret` from its default in any non-dev environment.
- See `backend/CONFIG.md` for detailed networking and deployment scenarios.

---

## 4. Frontend Conventions (React)

### 4.1 Adding a New Page

1. Create `frontend/src/pages/MyPage.jsx` (or under `admin/` / `superadmin/`).
2. Default export the page component.
3. Use a CSS Module: `frontend/src/pages/MyPage.module.css`; import as `import s from './MyPage.module.css'` and use `className={s.someClass}`.
4. In `App.jsx`: add `const MyPage = lazy(() => import('./pages/MyPage'))` and a `<Route path="my-page" element={<MyPage />} />` (wrap in `ProtectedRoute` with `roles={['admin']}` etc. if needed).
5. Fetch data with `api('/api-path')` from `src/api/client.js`; handle loading and errors in state.

### 4.2 Adding a New Component

- File: `frontend/src/components/ComponentName.jsx` with `ComponentName.module.css` next to it.
- Use design tokens and shared classes from `index.css` and `styles/shared.css` (see §6). Prefer CSS variables (e.g. `var(--color-accent)`) over hard-coded colors.

### 4.3 Styling Rules

- **CSS Modules only** for page/component-specific styles. One `.module.css` per component/page; class names in kebab-case or camelCase in CSS; reference via `s.className`.
- **No inline styles** for layout/theme; use tokens and shared classes.
- **Global styles**: Only in `src/index.css` and `src/styles/shared.css`. Do not add new global CSS files for component-level styling.
- **RTL**: Use logical properties or `[dir='rtl']` when needed; i18n sets `document.documentElement.dir = 'rtl'` for Arabic.

### 4.4 API and Auth

- All requests go through `api(path, options)` in `src/api/client.js`. No axios. For file upload use `uploadFile(file, path)`.
- On 401 (except public paths), the client clears token/user and may redirect to `/login?expired=1` for cart/checkout/admin/superadmin.
- Config: `loadConfig()` (from `config.js`) provides `apiBaseUrl`; set once (e.g. in AuthContext). Default `/api`; Vite proxies to backend.

### 4.5 i18n

- **Setup**: `src/i18n/index.js`; resources from `translations.js` (en, ar); locale from localStorage; on change, set `document.documentElement.lang` and `dir` for RTL.
- **Usage**: `useTranslation()` → `t('key')`, `t('key', { key: value })` for interpolation.
- **New copy**: Add keys under `nav`, `footer`, `home`, `shop`, `auth`, `common`, `product`, `category`, `orderFee`, `storeLocationsAdmin`, `returns`, `storeLocator`, etc. in `frontend/src/i18n/translations.js` for both `en` and `ar`.
- **Product/category**: Use `getProductDisplay(p, locale)` and `categoryKey(category)` from `src/utils/productI18n.js` for localized product name/description and category translation keys.

### 4.7 Testing

- **E2E**: Use Playwright. Tests are in `frontend/e2e/*.spec.js`.
- **Run**: `npm run test:e2e` for headless or `npm run test:e2e:ui` for the interactive UI.
- Use `page.goto('/')` and `expect(page).toHaveTitle(...)` patterns. See existing specs for auth and i18n test examples.

### 4.6 Naming

- **Files**: PascalCase for React components/pages (`Home.jsx`, `Navbar.jsx`); camelCase for non-components (`productI18n.js`, `client.js`).
- **Components**: PascalCase; default export for pages and major components.

---

## 5. UI Design Rules (Blue Mist — for Antigravity and All Agents)

These rules keep the app visually and behaviorally consistent. **Follow them when creating or changing UI.**

### 5.1 Design System Name and Vibe

- **Name**: “Blue Mist” (bluemistperfumes).
- **Vibe**: Minimal blue theme; clean whites; **one blue accent**; no heavy gradients or multiple accent colors. Feels calm and premium.

### 5.2 Colors (Use CSS Variables Only)

- **Background**: `var(--color-bg)` (#fafbfc), `var(--color-surface)` (#ffffff), `var(--color-surface-elevated)` (#f4f6f8).
- **Border**: `var(--color-border)` (#e5e9f0).
- **Text**: `var(--color-text)` (#1a1d24), muted `var(--color-text-muted)` (#6b7280).
- **Accent**: `var(--color-accent)` (#3b82f6), hover `var(--color-accent-hover)` (#2563eb). Muted/soft: `var(--color-accent-muted)`, `var(--color-accent-soft)`.
- **On accent** (text on blue): `var(--color-on-accent)` (#ffffff).
- **Semantic**: Error `var(--color-error)`, `var(--color-error-muted)`; Success `var(--color-success)`, `var(--color-success-muted)`.
- **Shadows**: `var(--shadow-sm)`, `var(--shadow-md)`, `var(--shadow-accent)`, `var(--shadow-lg)`, `var(--shadow-modal)`, `var(--shadow-nav)`.
- **Overlay**: `var(--overlay)`, `var(--overlay-dark)`.

Do **not** introduce new hex colors for UI; extend `:root` in `index.css` only if a new token is needed.

### 5.3 Typography

- **Serif (headings, hero)**: `var(--font-serif)` — Cormorant Garamond.
- **Sans (body, UI)**: `var(--font-sans)` — DM Sans.
- Body font-size ~15px; line-height 1.6. Use `clamp()` for responsive headings.

### 5.4 Spacing and Layout

- **Spacing scale**: `var(--space-xs)` through `var(--space-3xl)` (0.25rem–4rem). Use these instead of arbitrary rem/px.
- **Max width**: `var(--max-width)` (1200px). Page content in `.container` (max-width + horizontal padding).
- **Layout**: `.layout` (flex column, min-height 100vh), `.layoutMain` (flex: 1). Main content in `<main id="main-content">` for skip links.

### 5.5 Touch and Focus (Accessibility)

- **Touch targets**: Minimum height `var(--touch-min)` (44px) for buttons/links.
- **Focus**: Use `:focus-visible` with `var(--focus-ring)` and `var(--focus-offset)`. Inputs use blue focus ring (see shared.css).

### 5.6 Radii and Motion

- **Radii**: `var(--radius)` (4px), `var(--radius-lg)` (8px), `var(--radius-xl)` (12px).
- **Transitions**: `var(--transition-fast)`, `var(--transition)`, `var(--transition-slow)`, `var(--transition-bounce)`. Prefer `var(--ease-out)` or `var(--ease-in-out)` for animations.
- **Reduced motion**: Respect `@media (prefers-reduced-motion: reduce)` (disable or shorten animations).

### 5.7 Shared Component Classes (from `styles/shared.css`)

- **Page**: `.page` (min-height 100vh, padding, fade-in).
- **Titles**: `.pageTitle` (serif), `.pageSubtitle` (muted).
- **Loading/empty**: `.loading`, `.empty`.
- **Buttons**: `.btn` (primary blue), `.btnGhost` (transparent, hover accent).
- **Inputs**: `.input` (border, blue focus ring).
- **Cards**: `.card` (surface, border, hover lift and soft blue shadow).

Use these classes where they fit; for page-specific layout use the page’s CSS Module.

### 5.8 Animation Classes (in `index.css`)

- `animate-fade-in`, `animate-fade-in-up`, `animate-fade-in-down`, `animate-scale-in`, `animate-scale-in-bounce`, `animate-slide-in-right`, `animate-slide-in-left`.
- Keyframes: fadeIn, fadeInUp, slideIn, scaleIn, shimmer, etc. Use existing keyframes and animation vars; avoid one-off flashy effects.

### 5.9 Do Not

- Do not add a second accent color or a new palette that competes with blue.
- Do not use heavy gradients (light gradients like the hero are fine).
- Do not introduce new global CSS files for component styling; use CSS Modules.
- Do not hard-code colors/fonts; use design tokens.

---

## 6. Instructions for Forward Development

### 6.1 Backend

- Add new features by: new handler(s) in `handlers/`, new or existing model in `models/`, route in `routes/routes.go`. Use existing middleware (Auth, RequireRole, RateLimit) as needed.
- Keep exportable functions documented with a short comment. Use `utils` for cross-cutting helpers (pagination, JWT, password, audit).
- Preserve existing response shape: success with JSON object; errors with `gin.H{"error": "message"}`.

### 6.2 Frontend

- New pages: new file under `pages/` (or `admin/` / `superadmin/`), lazy in `App.jsx`, route with correct `ProtectedRoute` and `roles` if needed.
- New components: new file under `components/` with co-located `.module.css`. Use tokens and shared classes.
- New API calls: use `api(path)`; handle loading and error state; show user-friendly messages (client.js maps status codes to messages).
- New copy: add to `i18n/translations.js` in both `en` and `ar`; use `t('key')` or `t('key', { ... })` in components.

### 6.3 UI Consistency (Antigravity and Others)

- Before adding UI: read §5 (UI Design Rules). Use only the design tokens and shared classes defined there.
- New components/pages must use CSS Modules and the Blue Mist palette and typography. Preserve RTL and reduced-motion behavior.

---

## 7. File Path Quick Reference

| Purpose           | Path |
|-------------------|------|
| Backend entry     | `backend/main.go` |
| Routes            | `backend/routes/routes.go` |
| Config            | `backend/config/config.go`, `backend/config.json` |
| Config Guide      | `backend/CONFIG.md` |
| Handlers          | `backend/handlers/*.go` |
| Models            | `backend/models/*.go` |
| Middleware        | `backend/middleware/*.go` |
| Frontend entry    | `frontend/src/main.jsx`, `frontend/index.html` |
| App & routing     | `frontend/src/App.jsx` |
| API client        | `frontend/src/api/client.js` |
| Config (frontend) | `frontend/public/config.json`, `frontend/src/config.js` |
| i18n              | `frontend/src/i18n/index.js`, `frontend/src/i18n/translations.js` |
| Global CSS        | `frontend/src/index.css`, `frontend/src/styles/shared.css` |
| Product i18n     | `frontend/src/utils/productI18n.js` |
| E2E Tests         | `frontend/e2e/` |

---

*This guide is the single source of truth for AI agents working on this repo. When in doubt, match existing handler and component patterns and the Blue Mist UI rules above.*
