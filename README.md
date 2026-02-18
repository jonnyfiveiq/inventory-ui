# Inventory Service UI

Web interface for the [Inventory Service](../inventory-service/), built with
React, TypeScript, Vite and [PatternFly 5](https://www.patternfly.org/).

## Features

- **Collection Runs** — table view with live polling (3s), status badges,
  resource counts, click-through to detail view
- **Run Detail** — progress bar, resource stats cards, error/traceback
  display, cancel button
- **Providers** — list with "Collect Now" action that triggers a run and
  navigates to the live detail view
- **Auto-refresh** — active runs poll every 2–3 seconds; providers every 10s
- **Login** — basic auth against the inventory service API

## Quick start

```bash
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).  The Vite dev server
proxies `/api` requests to `http://localhost:44926` (the inventory service
port-forward).

## Project structure

```
src/
  api/
    client.ts          — typed API client for all inventory endpoints
  components/
    StatusLabel.tsx     — status badge + formatting helpers
    ResourceStats.tsx   — resource count summary
  hooks/
    usePolling.ts       — generic polling hook with interval + enable toggle
  pages/
    Login.tsx           — basic auth login
    CollectionRuns.tsx  — task management table (main view)
    CollectionRunDetail.tsx — run detail with progress + error display
    Providers.tsx       — provider list with collect action
  App.tsx              — PatternFly page layout + routing
  main.tsx             — entry point + CSS imports
```

## Development

Requires the inventory service running and accessible via port-forward:

```bash
kubectl -n aap26 port-forward svc/inventory-service 44926:8000
```

## Building for production

```bash
npm run build
```

Output is in `dist/` — static files that can be served by nginx, the
AAP gateway, or embedded in a container.
