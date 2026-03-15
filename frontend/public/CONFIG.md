# API config (config.json)

- **Same machine** (dev with Vite proxy, or frontend + backend behind same server):  
  Use `"apiBaseUrl": "/api"` in `config.json`.

- **Frontend at test.com, backend at api.test.com** (separate subdomains):
  Set the backend base URL in `config.json`:
  ```json
  {"apiBaseUrl": "https://api.test.com/api"}
  ```
  Use `http://` if you don’t have TLS. Ensure the backend’s `config.json` has your frontend origin in `cors_origins`, e.g. `"https://test.com"` (see backend CONFIG.md).

- **Backend on a different machine (IP/host):**  
  Set the URL in `config.json`, e.g. `{"apiBaseUrl": "http://192.168.1.10:8080/api"}`. Ensure the backend allows CORS from your frontend origin (backend `config.json` → `cors_origins`).

**Backend:** Add your frontend URL(s) to the backend’s `cors_origins` in `config.json` (e.g. `https://test.com`). See `backend/CONFIG.md` for details.
