# Backend config (config.json)

- **Same machine (default):** Use `config.json` with `port`, `mongo_uri`, `jwt_secret`, and `cors_origin` (e.g. `http://localhost:5173`). Server binds to `127.0.0.1` (localhost only).

- **Frontend at test.com, backend at api.test.com:**  
  Set `cors_origins` to the frontend origin(s) so the browser allows requests from test.com to api.test.com:
  ```json
  "cors_origins": ["https://test.com", "http://test.com"]
  ```
  Include both https and http if you use both. The frontend’s `config.json` should have `"apiBaseUrl": "https://api.test.com/api"` (or `http://api.test.com/api` without TLS).

- **Backend reachable from other machines (e.g. frontend on different host or mobile on LAN):**
  1. Set `"host": "0.0.0.0"` so the server listens on all interfaces.
  2. Set `cors_origins` to the full URL(s) where the frontend is served (e.g. `"http://192.168.1.5:5173"` or `"https://test.com"`).

- **Production:** Set `"app_env": "production"` and a non-default `jwt_secret`. All configuration is from `config.json` only.
