# TODOs y plan de trabajo

Estado: `[ ]` pendiente · `[~]` en progreso · `[x]` completado

---

## Fase 0 — Bootstrap del contexto *(completado 2026-04-22)*

- [x] `CLAUDE.md` raíz con stack, arquitectura, convenciones, anti-injection, TODOs
- [x] `.claude/rules/` scoped: `backend.md`, `frontend.md`, `db.md`, `runner.md`
- [x] `.claude/agents/` con 7 agentes especializados
- [x] `.claude/settings.json`: deny list global + hooks (audit, typecheck, TODO preservation)
- [x] `.claude/skills/frontend-design/SKILL.md`: skill canónico de diseño
- [x] `docs/spec/` fragmentada: 9 archivos (overview → features v2)
- [x] `docs/memory/`: `decisions.md`, `todos.md`, `bugs.md`

---

## Fase 1 — Bootstrap del monorepo *(completado 2026-04-23)*

- [x] Inicializar `pnpm init` + `pnpm-workspace.yaml` con los 5 workspaces
- [x] Configurar `tsconfig.json` base + tsconfigs por paquete (`strict: true`, `noUncheckedIndexedAccess`)
- [x] Configurar Biome (`biome.json`): lint + format, reglas base
- [x] Configurar Vitest (`vitest.config.ts`) base compartida
- [x] `packages/shared`: Zod schemas iniciales (errores, run status, event types, claude flags whitelist)
- [x] `packages/db`: schema Drizzle inicial (4 tablas) + primera migración + `createDb` factory
- [x] `docker-compose.yml`: postgres 16 + redis 7 con health checks y volúmenes

---

## Fase 2 — Runner mínimo *(completado 2026-04-23)*

- [x] `packages/claude-runner`: estructura de paquete + `package.json`
- [x] `runner.start()`: spawn con execa, config base, sanitizedEnv
- [x] `src/parser.ts`: readline sobre stdout, mapeo stream-json → RunEvent
- [x] `src/redact.ts`: patrones de secretos (sk-ant, ghp_, gho_, URLs con creds)
- [x] `src/cwd.ts`: validación `projectRoot` contra `PROJECTS_ROOT`
- [x] `runner.cancel()`: SIGTERM → 5s → SIGKILL
- [x] Tests: parser con fixtures, cancelación, cwd inválido, fake-claude binario

---

## Fase 3 — API MVP *(completado 2026-04-23)*

- [x] `apps/api`: estructura Fastify + pino-http + config.ts con Zod
- [x] `AppError` + error handler global
- [x] Plugin `projects`: CRUD completo (`GET`, `POST`, `PUT`, `DELETE`)
- [x] Plugin `runs`: launch (202 + BullMQ), cancel, get status
- [x] Plugin `events`: GET paginado de eventos de un run
- [x] Plugin `artifacts`: GET artefactos de un run
- [x] Plugin `health`: GET con ping a DB y Redis
- [x] BullMQ worker `runs`: integración runner → batch insert eventos → Socket.IO emit
- [x] Socket.IO: namespace `/runs`, rooms por `runId`, `run:event` + `run:status` + `run:log`

---

## Fase 4 — Web MVP *(completado 2026-04-23)*

- [x] `apps/web`: estructura Vite + React 19 + TanStack Router + TanStack Query + Zustand
- [x] shadcn/ui: instalación + tokens CSS en `styles/tokens.css` (light + dark)
- [x] Layout base: header con badge de health, nav lateral, dark mode toggle
- [x] Página `/projects`: lista + formulario de creación
- [x] Página `/projects/:id`: detalle + tab runs + tab settings
- [x] Página `/projects/:id/runs/new`: formulario de launch
- [x] Página `/runs/:id`: log en vivo (virtualizado) + estado + botón cancel
- [x] Sección "Changed files" con `react-diff-viewer-continued`
- [x] Socket.IO client: join room, handle `run:event` / `run:status`
- [x] `runnerPanel` store (Zustand): estado del run activo, eventos

---

## Fase 5 — Calidad y cierre MVP *(completado 2026-04-23)*

- [x] Tests integración API: todos los endpoints del MVP con `fastify.inject()` — 29 tests
- [x] Tests runner: cobertura de cancelación, timeout, parse-error, redact — 40 tests
- [x] Tests frontend: páginas críticas con Testing Library — 17 tests
- [x] `pnpm lint` + `pnpm typecheck` en cero errores
- [x] Documentar en `decisions.md` cualquier decisión tomada durante la implementación
- [x] Actualizar `todos.md` al cerrar cada tarea significativa

---

## Fase 6 — v1 completo *(post-MVP)*

### Fase 6a — backend + features sin visualización *(completado 2026-04-23)*

- [x] Migración `parent_run_id` + schema Drizzle + Run schema en @cac/shared
- [x] F-10: Re-run endpoint `POST /v1/runs/:id/rerun` + botón UI con prompt editable
- [x] F-12: Tab Ajustes extendida con `claudeConfig` (model, timeout, flags whitelist)
- [x] F-13: Notificaciones (toasts `run:status` + badge de activos + document.title)
- [x] F-14: Prefs persistidas (tema, prefers-color-scheme, logFontSize, diffView)
- [x] F-15: Export `GET /v1/runs/:id/export?format=json|markdown` + botones download
- [x] F-07 API: `GET /v1/stats/global` + `/v1/stats/projects/:id` con agregaciones diarias
- [x] F-07 Web (sin charts): `/dashboard` con totales + tabla de actividad diaria
- [x] F-08 API: `GET /v1/projects/:id/run-graph` con nodos + edges parent→child
- [x] F-11 API: `GET /v1/projects/:id/files` + `/files/content` con realpath + prefix check

### Fase 6b — visualizaciones + E2E *(completado 2026-04-23)*

- [x] `/frontend-design` invocado — brief estético "panel de instrumentos" con paleta extendida, IBM Plex, densidad, motion, iconografía
- [x] Tokens: chart-1..5, status-*, rule-strong/soft, --font-sans/mono + IBM Plex (fontsource), utilidades `.tnum`, `.micro`, `.rule`
- [x] F-07: charts Recharts — ComposedChart (barras runs + línea tokens acumulados), donut de estados, top proyectos con barras inline; RangeSelector 24h/7d/30d
- [x] F-08: tab Graph con `@xyflow/react` + dagre — RunNode custom 40px con stripe de estado, click-through a `/runs/:id`
- [x] F-09: timeline slider con ruler por tipo + jump-to-error + shortcuts (←/→, Shift+←/→, Home/End); LogViewer con `highlightSeq` y marker
- [x] F-11: tab Files — tree 24px rows con indent guides + Monaco readonly lazy con tema derivado del store `ui`
- [x] Playwright E2E golden path: projects → project detail → run detail (mocked API)

---

## Fase 7 — v2 *(pendiente de completar v1)*

- [ ] Docker Compose completo (web + api + postgres + redis + nginx)
- [ ] Auth JWT + bcrypt + refresh token
- [ ] RBAC admin/viewer
- [ ] Gestión de usuarios (admin panel)
- [ ] Audit log persistido en DB
- [ ] Rate limiting (`@fastify/rate-limit`)
- [ ] CORS + Helmet
- [ ] TLS self-signed para intranet
