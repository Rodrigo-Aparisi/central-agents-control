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

## Fase 3 — API MVP

- [ ] `apps/api`: estructura Fastify + pino-http + config.ts con Zod
- [ ] `AppError` + error handler global
- [ ] Plugin `projects`: CRUD completo (`GET`, `POST`, `PUT`, `DELETE`)
- [ ] Plugin `runs`: launch (202 + BullMQ), cancel, get status
- [ ] Plugin `events`: GET paginado de eventos de un run
- [ ] Plugin `artifacts`: GET artefactos de un run
- [ ] Plugin `health`: GET con ping a DB y Redis
- [ ] BullMQ worker `runs`: integración runner → batch insert eventos → Socket.IO emit
- [ ] Socket.IO: namespace `/runs`, rooms por `runId`, `run:event` + `run:status` + `run:log`

---

## Fase 4 — Web MVP

- [ ] `apps/web`: estructura Vite + React 19 + TanStack Router + TanStack Query + Zustand
- [ ] shadcn/ui: instalación + tokens CSS en `styles/tokens.css` (light + dark)
- [ ] Layout base: header con badge de health, nav lateral, dark mode toggle
- [ ] Página `/projects`: lista + formulario de creación
- [ ] Página `/projects/:id`: detalle + tab runs + tab settings
- [ ] Página `/projects/:id/runs/new`: formulario de launch
- [ ] Página `/runs/:id`: log en vivo (virtualizado) + estado + botón cancel
- [ ] Sección "Changed files" con `react-diff-viewer-continued`
- [ ] Socket.IO client: join room, handle `run:event` / `run:status`
- [ ] `runnerPanel` store (Zustand): estado del run activo, eventos

---

## Fase 5 — Calidad y cierre MVP

- [ ] Tests integración API: todos los endpoints del MVP con `fastify.inject()`
- [ ] Tests runner: cobertura de cancelación, timeout, parse-error, redact
- [ ] Tests frontend: páginas críticas con Testing Library
- [ ] `pnpm lint` + `pnpm typecheck` en cero errores
- [ ] Documentar en `decisions.md` cualquier decisión tomada durante la implementación
- [ ] Actualizar `todos.md` al cerrar cada tarea significativa

---

## Fase 6 — v1 completo *(post-MVP)*

- [ ] F-07: Dashboard de métricas (Recharts)
- [ ] F-08: Grafo de runs (@xyflow/react + dagre)
- [ ] F-09: Replay y navegación de eventos (timeline slider)
- [ ] F-10: Re-run con edición de prompt
- [ ] F-11: Monaco file browser (lectura)
- [ ] F-12: Configuración por proyecto (timeout, modelo, flags)
- [ ] F-13: Notificaciones UI (sonner toasts + badge)
- [ ] F-14: Dark mode + preferencias persistidas
- [ ] F-15: Export de run (JSON + Markdown)
- [ ] Playwright E2E: golden paths (crear proyecto → launch → ver log → ver diff)

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
