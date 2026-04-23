# Central Agents Control

Dashboard web local para orquestar múltiples proyectos desarrollados con Claude Code. Wrapper del CLI `claude` + panel de configuración, lanzamiento y auditoría. Memoria nativa de Claude Code complementada con histórico estructurado en Postgres.

**Estado**: v1 completo (localhost, usuario único). v2 (servidor Docker + auth) planificado.

---

## Qué hace

Flujo típico: abres el browser, eliges un proyecto local, escribes un prompt, el wrapper lanza `claude -p --output-format stream-json` con `cwd` fijo al proyecto, el log aparece en vivo (Socket.IO) y al terminar ves el diff de archivos modificados. Todo queda persistido — runs, eventos, artefactos — con métricas agregadas por día.

## Stack

| Capa        | Tecnologías                                                                                         |
|-------------|-----------------------------------------------------------------------------------------------------|
| Web         | React 19, Vite 6, Tailwind 4, shadcn/ui, TanStack Router, TanStack Query, Zustand, Recharts, @xyflow/react, Monaco, react-diff-viewer-continued, socket.io-client |
| API         | Node 22, Fastify 5, fastify-type-provider-zod, Socket.IO, BullMQ, ioredis, Pino, execa, close-with-grace |
| Shared      | Zod schemas (`@cac/shared`)                                                                          |
| DB          | Drizzle ORM, Postgres 16 (`@cac/db`)                                                                 |
| Runner      | Wrapper de `claude -p --output-format stream-json` (`@cac/claude-runner`) con split2 + execa         |
| Tooling     | pnpm workspaces, Biome, Vitest, Playwright                                                           |
| Infra local | Docker Compose: postgres 16 + redis 7                                                                |

Tipografía: IBM Plex Sans + IBM Plex Mono self-hosted. Paleta OKLCH con 5 series de chart anclados al primary.

## Estructura

```
apps/
  web/                   # React 19 + Vite
  api/                   # Fastify + Socket.IO + BullMQ
packages/
  shared/                # Zod schemas (web ↔ api)
  db/                    # Drizzle schema + migraciones + repos
  claude-runner/         # Spawning y parseo del CLI claude
docs/
  spec/                  # Spec fragmentada
  memory/                # decisions.md, todos.md, bugs.md
.claude/
  rules/                 # Reglas scoped por carpeta
  agents/                # Subagentes especializados
  settings.json          # Deny list global + hooks
```

## Requisitos

- **Node 22+**
- **pnpm 9+** (`npm i -g pnpm@9` si no lo tienes)
- **Docker Desktop** (para postgres + redis)
- **Claude Code CLI** instalado y en `PATH` como `claude` — es el binario que el runner lanza

## Setup

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Crear `.env` en la raíz

Copia `.env.example` a `.env` y rellena como mínimo:

```env
DATABASE_URL=postgresql://cac:cac@127.0.0.1:5434/cac
REDIS_URL=redis://localhost:6379
PROJECTS_ROOT=D:/Proyectos/cac-proyects
POSTGRES_PORT=5434
```

`PROJECTS_ROOT` tiene que ser un directorio que exista; todos los proyectos registrados deben vivir debajo de él (el runner lo valida con `realpath` + prefix check).

### 3. Levantar infra local

```bash
docker compose up -d postgres redis
docker compose ps    # verifica que ambos estén healthy
```

### 4. Aplicar migraciones

```bash
pnpm db:migrate
```

Aplica las migraciones de `packages/db/migrations/` (crea `projects`, `runs`, `run_events`, `run_artifacts`, enums e índices). **Imprescindible** — sin esto, cualquier request devuelve 500.

### 5. Arrancar dev

```bash
pnpm dev
```

Levanta web y API en paralelo:

- Web: http://localhost:5173
- API: http://127.0.0.1:8787 (health: `GET /v1/health`)

Vite proxy reenvía `/v1/*` y `/ws/*` del puerto 5173 al 8787, así que abres sólo la web.

> Si ves `ECONNREFUSED 127.0.0.1:8787` en la consola de vite, el API no arrancó. Lanza `cd apps/api && pnpm dev` en su propio terminal para ver el error real — el wrapper paralelo de pnpm bufferiza los logs de los procesos hijo.

## Comandos

```bash
pnpm dev                    # web + api en paralelo
pnpm --filter @cac/web dev  # sólo la web
pnpm --filter @cac/api dev  # sólo la api (con logs al directo)

pnpm lint                   # biome check
pnpm lint:fix               # biome check --write
pnpm typecheck              # tsc --noEmit en cada paquete
pnpm test                   # vitest en todos los paquetes
pnpm build                  # build de producción (web → dist/)

pnpm db:generate            # drizzle-kit generate tras cambiar el schema
pnpm db:migrate             # aplica migraciones pendientes
pnpm db:studio              # drizzle-studio sobre la DB local

pnpm --filter @cac/web e2e  # Playwright golden path
```

## Tests

- **Unit + integración**: 106 tests con Vitest (`pnpm test`)
  - `@cac/shared` — schemas Zod, prompt wrapping, whitelist de flags
  - `@cac/db` — UUID v7, factories
  - `@cac/claude-runner` — parser stream-json, redact, cwd validation, sanitize, integración con fake-claude
  - `@cac/api` — rutas via `fastify.inject()` con mocks en memoria de db/redis/queues/socketio
  - `@cac/web` — `RunStatusBadge`, `humanizeError`, `runnerPanel` store, `HealthBadge`, `renderPayload`
- **E2E**: 1 golden path con Playwright (`pnpm --filter @cac/web e2e`) — projects list → detail (tabs Runs/Graph/Files/Ajustes) → run detail con timeline, todo contra API mockada vía `page.route`.

## Seguridad

Resumen — detalle completo en [`docs/spec/03-security.md`](docs/spec/03-security.md).

- **Prompt injection**: todo input externo se envuelve con `wrapUntrustedInput` antes de llegar al CLI.
- **Path traversal**: el runner valida `projectRoot` con `realpathSync` + prefix check contra `PROJECTS_ROOT`; también lo hacen las rutas que aceptan paths del cliente.
- **Secret leakage**: el runner filtra patrones (`sk-ant-…`, `ghp_…`, `gho_…`, URLs con credenciales, `ANTHROPIC_API_KEY=…`) antes de emitir o persistir eventos.
- **CLI flags**: whitelist cerrada en `@cac/shared`; cualquier flag fuera de ella devuelve 400.
- **Env del proceso hijo**: arranca vacío y añade sólo PATH/HOME/USERPROFILE + `ANTHROPIC_API_KEY` (opt-in) + `envExtras` explícito. Nunca `{...process.env}`.
- **Deny list del harness**: `.claude/settings.json` bloquea `rm -rf`, `sudo`, `curl`, `git push --force`, reads de `.env*`, writes a `/etc/**`. Revisar antes de aceptar PRs que la toquen.

## Arquitectura

- Diagrama y flujos: [`docs/spec/01-architecture.md`](docs/spec/01-architecture.md)
- Schema DB: [`docs/spec/02-db-schema.md`](docs/spec/02-db-schema.md)
- Orquestación (BullMQ + runner + Socket.IO): [`docs/spec/04-orchestration.md`](docs/spec/04-orchestration.md)
- Observabilidad: [`docs/spec/05-observability.md`](docs/spec/05-observability.md)
- Features MVP / v1 / v2: [`docs/spec/06-features-mvp.md`](docs/spec/06-features-mvp.md), [`07-features-v1.md`](docs/spec/07-features-v1.md), [`08-features-v2.md`](docs/spec/08-features-v2.md)
- Decisiones no obvias: [`docs/memory/decisions.md`](docs/memory/decisions.md)
- Plan y estado: [`docs/memory/todos.md`](docs/memory/todos.md)

## Contribuir

Convenciones en [`CLAUDE.md`](CLAUDE.md) y reglas scoped en [`.claude/rules/`](.claude/rules/). Resumen:

- Imports absolutos por paquete (`@cac/shared`, `@cac/db`, `@cac/claude-runner`) — nunca `../../packages/...`.
- Contratos web ↔ api pasan por schemas Zod en `@cac/shared`.
- Errores del API en formato `{ error: { code, message, details? } }` con códigos tipados.
- TypeScript `strict: true` + `noUncheckedIndexedAccess`. Biome para lint + format.
- Tipografía: IBM Plex Sans/Mono. Densidad: primitivos ≤ 40px. Números siempre con `.tnum`, micro-labels con `.micro`.

Antes de tocar componentes visuales distintivos nuevos (pantallas, cards, grafos, log panels), invocar `/frontend-design` y respetar el brief resultante. Para la v1 actual está resuelto.
