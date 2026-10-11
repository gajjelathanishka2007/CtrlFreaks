# Synq — Build. Simulate. Improve.

Synq is an AI-assisted workflow automation builder. It pairs a React Flow canvas for
composing automation flows with a **Flight Simulator** for testing them against
scenarios *before* they run for real, plus a **Synq Assistant** and data-contract
diagnostics.

This repository is a full-stack app that is **functional in demo mode out of the box**
and **ready to connect** to a Node/Express + MongoDB backend, an automation engine,
and an AI service.

> **Honesty first.** Several capabilities (real code execution, publishing to a live
> engine, live AI, real emails/Sheets writes) require external services that are *not*
> bundled. When they are not connected, Synq says so explicitly in the UI and labels
> results as simulated/demo. It never fakes a real integration.

---

## Features

- **Dashboard** — totals, active workflows, simulation pass rate, recent failures,
  contract warnings, recent workflows and activity. Sample data is clearly labelled.
- **Workflows** — list/search/sort, status filters, create/open/duplicate/delete.
- **Workflow builder** (React Flow)
  - Dotted grid canvas, pan/zoom, minimap, controls, undo/redo, keyboard shortcuts.
  - Custom nodes with category, description, inputs/outputs and execution status.
  - Bottom-center **+** button opening a searchable *Add Node / Integration* picker
    with category tabs (All, Apps, AI, Code, Database, Productivity, Logic, Triggers).
  - Right rail with **Configure** and **Assistant** tabs; selecting a node opens its config.
  - Editable header with Save / Test / Share / Publish and loading/success/error feedback.
- **Code nodes** — JavaScript & Python with an editor (syntax-highlight overlay),
  sample input, output preview, and **Run Test**.
- **Flight Simulator** — eight scenarios (valid, missing email, invalid email,
  duplicate, malformed data, missing field, large input, changed field name), a
  deterministic step-by-step trace, simulated actions, and a pass/fail summary.
- **Data contracts** — expected vs actual fields, missing/renamed/mismatches, and
  suggested mappings with *Test Repair* / *Apply Mapping* (never silently mutates a
  saved workflow).
- **Execution History** — search, status/type filters, pagination, and a detail view
  with input data, step logs, node I/O, errors, and simulation labels.
- **Synq Assistant** — chat with suggested prompts, code blocks with Copy, and
  contextual actions. Responses are labelled demo unless a live AI model is connected.

---

## Tech stack

| Layer      | Technology |
|------------|------------|
| Frontend   | React 18, Vite 6, React Router 6, Tailwind CSS v4 |
| Canvas     | `@xyflow/react` (React Flow 12) |
| Icons      | `lucide-react` |
| HTTP       | `axios` |
| Backend    | Node.js, Express 4, MongoDB via Mongoose 8 (optional) |
| Tooling    | `concurrently`, `dotenv`, `cors` |

Tailwind v4 uses `@theme` design tokens in `src/index.css` (there is no
`tailwind.config.js`). No orange is used anywhere in the palette.

---

## Prerequisites

- **Node.js 18+** (developed on Node 24) and npm.
- MongoDB is **optional** — the API runs without it (see below).

---

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Start the frontend (Vite dev server)
npm run dev
# → http://localhost:5173
```

That's it — the frontend defaults to **demo mode**, so it works without any backend.

### With the backend

```bash
# Option A: run web + API together
npm run dev:full

# Option B: two terminals
npm run dev       # frontend  → http://localhost:5173
npm run server    # API       → http://localhost:5000
```

Then point the frontend at the API by setting `VITE_USE_MOCK=false` (see below).

### Build / preview

```bash
npm run build     # production bundle → dist/
npm run preview   # serve the built bundle
```

---

## Environment variables

Copy `.env.example` to `.env` and adjust as needed. **Never put secrets in `VITE_*`
variables** — Vite inlines them into the browser bundle.

| Variable             | Scope    | Default                        | Purpose |
|----------------------|----------|--------------------------------|---------|
| `VITE_API_BASE_URL`  | Frontend | `http://localhost:5000/api`    | API base URL |
| `VITE_USE_MOCK`      | Frontend | `true`                         | `true` = mock service layer; `false` = call the API (falls back to mock on failure) |
| `PORT`               | Backend  | `5000`                         | API port |
| `CORS_ORIGIN`        | Backend  | `http://localhost:5173`        | Allowed origin |
| `MONGODB_URI`        | Backend  | *(unset)*                      | If set & reachable, use MongoDB; otherwise an in-memory seeded store |
| `OPENAI_API_KEY`     | Backend  | *(unset)*                      | Enables live AI; otherwise AI is demo |
| `CODE_RUNNER_URL`    | Backend  | *(unset)*                      | Enables a real isolated code runner; otherwise code is validated only |

The frontend **never** connects to MongoDB directly — all data access goes through the
Express API.

---

## Demo mode vs. live mode

The service layer in `src/services/` tries the real API first and gracefully falls back
to a tagged mock (`{ data, demo: true }`). Screens render a **Demo mode** banner when the
backend isn't connected. Set `VITE_USE_MOCK=false` and start the API to use live data.

The API itself degrades gracefully:

- No `MONGODB_URI` → **in-memory seeded store** (data resets on restart).
- No `OPENAI_API_KEY` → AI endpoints return **demo** responses.
- No `CODE_RUNNER_URL` → code endpoints perform **static validation only** and return
  `engineUnavailable`. Code is **never** executed in the browser or an unrestricted
  backend process.

---

## Project structure

```
├─ index.html
├─ vite.config.js            # React + Tailwind plugins, /api proxy → :5000
├─ .env.example
├─ public/synq-mark.svg
├─ src/
│  ├─ main.jsx  App.jsx       # Router + layout
│  ├─ index.css               # Tailwind v4 @theme tokens + utilities
│  ├─ pages/                  # Dashboard, Workflows, WorkflowEditor, ExecutionHistory, Teams, Settings, NotFound
│  ├─ components/
│  │  ├─ layout/              # Sidebar, AppLayout, PageHeader
│  │  ├─ workflow/            # WorkflowCanvas, SynqNode, NodeConfigPanel, CodeEditor, useWorkflowGraph, DiagnosticsDrawer, …
│  │  ├─ integrations/        # AddNodePopover
│  │  ├─ assistant/           # AssistantPanel, CodeBlock, RichText
│  │  ├─ simulator/           # SimulatorPanel
│  │  ├─ common/ ui/          # primitives (Button, Badge, Modal, StatCard, JsonBlock, …)
│  │  └─ history/             # ExecutionDetail
│  ├─ services/               # api, workflowService, executionService, simulationService, aiService, codeService, …
│  ├─ data/                   # nodeCatalog.js, mock.js
│  ├─ context/  hooks/  utils/
├─ server/
│  ├─ index.js  db.js  store.js  seed.js
│  ├─ models/                 # Workflow, Execution, Integration
│  └─ routes/                 # workflows, executions, dashboard, integrations, simulations, ai, code
```

---

## Backend API (default `http://localhost:5000`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/health` | Health + `{ store, ai }` capabilities |
| GET  | `/api/workflows` | List workflows |
| POST | `/api/workflows` | Create a workflow |
| GET/PUT/DELETE | `/api/workflows/:id` | Read / update / delete |
| POST | `/api/workflows/:id/publish` | Publish (requires engine confirmation) |
| GET  | `/api/executions` | List execution records |
| GET  | `/api/executions/:id` | Execution detail |
| GET  | `/api/dashboard/stats` | Dashboard aggregates |
| GET  | `/api/integrations` | Integration catalogue |
| POST | `/api/simulations/run` | Run the deterministic simulator |
| GET  | `/api/ai/status` | Whether a live AI model is connected |
| POST | `/api/ai/chat` | Assistant (live when `OPENAI_API_KEY` is set) |
| POST | `/api/code/run` | Static code validation (real run only with `CODE_RUNNER_URL`) |

Because everything is contract-first, the frontend works whether or not each endpoint
exists yet — missing endpoints fall back to the mock layer.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (http://localhost:5173) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run server` | Express API (http://localhost:5000) |
| `npm run dev:full` | Frontend + API together |

---

## Connecting the real services later

1. **Database** — set `MONGODB_URI`; the store switches from memory to MongoDB.
2. **AI** — set `OPENAI_API_KEY` (server-side) to enable live assistant responses.
3. **Automation engine** — implement publishing so it only reports success on real
   engine confirmation (the UI already distinguishes demo vs. real publishes).
4. **Code execution** — point `CODE_RUNNER_URL` at an isolated sandbox service; until
   then code nodes validate but do not execute.

## License

Private / unlicensed — provided as-is for evaluation.
