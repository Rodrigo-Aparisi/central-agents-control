# 01 — Arquitectura

## Diagrama de componentes

```
┌─────────────────────────────────────────────────────────┐
│  Browser (localhost:3000)                               │
│  apps/web — React 19 + Vite + TanStack + shadcn/ui      │
│                                                         │
│  ┌───────────┐  REST /v1/*  ┌──────────────────────┐   │
│  │ TanStack  │ ──────────► │                      │   │
│  │  Query    │             │   apps/api            │   │
│  └───────────┘  Socket.IO  │   Fastify + Node 22   │   │
│  ┌───────────┐ ◄─────────── │                      │   │
│  │  runner   │  /runs ns   │  ┌────────────────┐   │   │
│  │  Panel    │             │  │    BullMQ       │   │   │
│  │  store    │             │  │  workers/runs   │   │   │
│  └───────────┘             │  └────────┬───────┘   │   │
└─────────────────────────────│──────────┼───────────┘   │
                              │          │                │
                     ┌────────┴──┐  ┌────▼──────────┐    │
                     │ Postgres  │  │ claude-runner │    │
                     │ (Drizzle) │  │  packages/    │    │
                     └───────────┘  │  claude-runner│    │
                                    └───────┬───────┘    │
                     ┌─────────┐           │             │
                     │  Redis  │    ┌──────▼──────┐      │
                     │(BullMQ) │    │ claude CLI  │      │
                     └─────────┘    │  (proceso   │      │
                                    │   hijo)     │      │
                                    └─────────────┘      │
```

## Paquetes y responsabilidades

### `apps/web`
SPA React 19. Nunca habla directamente a la DB ni al runner. Todo via `apps/api`.

- **TanStack Query**: datos de servidor (proyectos, runs, eventos, métricas).
- **TanStack Router**: rutas con loaders que pre-fetchen datos.
- **Zustand**: estado de UI transversal (tema, panel de run activo, filtros).
- **Socket.IO client**: recibe eventos de run en vivo (`/runs` namespace, room por `runId`).
- **Monaco**: visualización/edición de archivos del proyecto.
- **react-diff-viewer-continued**: diffs de archivos modificados por el agente.
- **@xyflow/react**: grafo de dependencias entre proyectos/runs.
- **Recharts**: métricas de uso (tokens, coste, duración).

### `apps/api`
Servidor Fastify. Única fuente de verdad para el cliente. Orquesta DB, runner y colas.

- **Plugins Fastify**: `projects`, `runs`, `events`, `health`. Un plugin por dominio.
- **Rutas HTTP**: REST bajo `/v1/`. Contratos validados con Zod (`@cac/shared`).
- **Socket.IO**: namespace `/runs`. Emite eventos tipados al cliente en tiempo real.
- **BullMQ workers**: procesan jobs de `runs`, `git-ops`, `cleanup` sin bloquear el event loop.
- **Config centralizada**: `src/config.ts` carga y valida todas las variables de entorno con Zod.

### `packages/shared`
Librería pura de tipos y schemas Zod. Sin dependencias de runtime excepto `zod`.

- Schemas de payloads HTTP (request/response bodies).
- Tipos de eventos Socket.IO (`run:event`, `run:status`, `run:log`).
- Enums compartidos (`RunStatus`, `EventType`, `ErrorCode`).
- Whitelist de flags permitidos del CLI `claude`.
- Plantilla anti-prompt-injection (función `wrapUntrustedInput`).

### `packages/db`
Acceso a datos. Sin dependencias de Fastify ni React.

- Schema Drizzle: `projects`, `runs`, `run_events`, `run_artifacts`.
- Factory `createDb(url)` → cliente + repositorios tipados.
- Factories de test/seed en `src/factories.ts`.

### `packages/claude-runner`
Wrapper del CLI `claude`. Sin dependencias de Fastify ni DB.

- `runner.start(config)` → `{ runId, events: AsyncIterable<Event>, result: Promise<ExitResult> }`.
- `runner.cancel(runId)` → SIGTERM → SIGKILL.
- Parser de stream-json en `src/parser.ts`.
- Redactor de secretos en `src/redact.ts`.

## Flujo de un run

```
Usuario click "Launch" en Web
  → POST /v1/projects/:id/launch  (HTTP)
  → API crea Run en DB (status: queued)
  → API encola job en BullMQ (queue: runs)
  → API responde 202 con runId

Web recibe runId
  → socket.join(runId)  (Socket.IO)

BullMQ worker picks up job
  → runner.start({ projectRoot, prompt, runId })
  → spawnea `claude -p --output-format stream-json` con cwd = projectRoot

runner emite AsyncIterable<Event>
  → worker itera eventos
  → worker hace batch insert en run_events (DB)
  → worker emite eventos por Socket.IO al room del run

Web recibe run:event
  → runnerPanel store actualiza log
  → componente LogViewer virtualizado re-renderiza

runner.result resuelve
  → worker actualiza Run.status en DB (completed|cancelled|crashed|timeout)
  → worker emite run:status final por Socket.IO
  → Web actualiza UI con estado final y diff de archivos
```

## Decisiones de diseño

### Por qué BullMQ y no spawn directo en el request handler
Un run puede durar minutos. Si lo spawnamos en el handler y el cliente desconecta, el proceso queda huérfano sin gestión de estado. BullMQ da: persistencia del job, reintentos configurables, cancelación desde cualquier worker, y separación del ciclo de vida del run del ciclo de vida del request HTTP.

### Por qué Socket.IO y no SSE
SSE es unidireccional y no tiene rooms nativos. Socket.IO da bidireccionalidad (útil para cancelación), rooms por runId, y reconexión automática con replay de eventos pendientes.

### Por qué Drizzle y no Prisma
Drizzle es más cercano a SQL, lo que facilita queries complejas de métricas. Su type inference sin codegen encaja mejor con el monorepo pnpm. Migra con drizzle-kit sin dependencia de un binario externo pesado.

### Por qué UUID v7 y no UUID v4
UUID v7 es monotónico en el tiempo (primeros 48 bits = timestamp). Esto permite paginación por cursor usando el propio UUID y evita index fragmentation en B-tree de Postgres. Generado en la app para poder propagar el ID a logs/eventos antes del insert.
