# Genix Frontend

React 18 + Vite frontend for GenixERP. Talks to the Go backend (`genix-backend`) REST API at `/api/v1`.

## Running the app

```bash
npm install
npm run dev
```

The dev server runs on http://localhost:5173. Set `VITE_API_URL` in `.env` to point at the backend (default: `http://localhost:8080/api/v1`).

## Building the app

```bash
npm run build
```

## Testing

```bash
npm test              # vitest unit tests
npx playwright test   # e2e tests (requires dev server + backend running)
```
