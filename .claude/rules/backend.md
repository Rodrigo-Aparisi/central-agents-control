---
name: backend-rules
description: Reglas obligatorias para código del API CAC (Fastify + Zod + Pino + BullMQ)
globs:
  - apps/api/**
---

# Backend (apps/api)

Reglas que aplican al código del API. Detalle arquitectónico completo en `docs/spec/01-architecture.md` y `docs/spec/04-orchestration.md`.

## Fastify

- Registrar cada dominio como **plugin** (`fastify-plugin`). Un plugin por recurso: `projects`, `runs`, `events`, `health`.
- Rutas versionadas bajo `/v1/...`. Los sockets viven en `/ws` (Socket.IO).
- Schemas de request/response se definen con Zod en el mismo archivo de la ruta y se registran vía `fastify-type-provider-zod`. Nunca JSON Schema a mano.
- Nada de `reply.send(anyObject)` sin schema de respuesta. Todo sale tipado.
- Config (puerto, DB url, redis url, `CLAUDE_BIN`, `PROJECTS_ROOT`) se carga una sola vez en `apps/api/src/config.ts` con un Zod schema y se inyecta vía `fastify.decorate`. Prohibido `process.env.X` disperso.

## Zod y contratos

- Los schemas de payloads web↔api viven en `@cac/shared`, no en `apps/api`. El API los importa.
- Schemas internos (DB rows, eventos del runner) sí pueden vivir en `apps/api` o `@cac/db`.
- Toda entrada externa (body, query, params, headers relevantes) se valida con Zod antes de entrar a la lógica. Si falla → `400` con `{ error: { code: 'VALIDATION_ERROR', message, details } }`.

## Errores

- Formato único: `{ error: { code: string, message: string, details?: unknown } }`.
- Códigos tipados en `@cac/shared` (enum Zod): `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `RUNNER_FAILED`, `UNAUTHORIZED` (v2), `INTERNAL`.
- Lanzar `AppError` (clase propia con `code`, `statusCode`, `message`, `details`). Un error handler global lo convierte a response.
- Nunca `throw 'string'` ni `throw { ... }` literal.

## Logging (Pino)

- Logger global de Fastify con `pino-http`. Cada request tiene `requestId`.
- Dentro de un run, añadir `runId` al contexto (`req.log.child({ runId })`).
- Niveles: `trace` → detalle runner interno; `debug` → dev; `info` → hitos (run iniciado, completado); `warn` → recuperables; `error` → con stack.
- **Nunca** `console.log` ni `console.error` en código de runtime. Sólo en scripts one-shot de `apps/api/scripts/`.
- Redactar campos sensibles: `req.headers.authorization`, `env.ANTHROPIC_API_KEY`, `body.secrets.*`. Configurado en el logger raíz.

## Rutas: convenciones

- REST-ish: `GET /v1/projects`, `POST /v1/projects`, `GET /v1/projects/:id`, etc.
- Acciones no-CRUD como sub-recursos: `POST /v1/runs/:id/cancel`, `POST /v1/projects/:id/launch`.
- IDs en path siempre UUID v7 validados con Zod.
- Paginación por cursor (`?cursor=...&limit=...`), no offset.

## BullMQ

- Una cola por dominio: `runs`, `git-ops`, `cleanup`.
- Workers en `apps/api/src/workers/<queue>.ts`, se arrancan en el proceso API salvo que `ENABLE_WORKERS=false`.
- Jobs tipados con Zod en payload. Reintentos explícitos (`attempts`, `backoff`).
- Cualquier job que lance un proceso del runner debe respetar la cancelación (ver `runner.md`).

## Socket.IO

- Un namespace por dominio: `/runs`. Rooms por `runId`.
- Emitir sólo eventos tipados (definidos en `@cac/shared`): `run:event`, `run:status`, `run:log`.
- No usar sockets como canal de RPC; para mutaciones usa rutas HTTP.
- Backpressure: si la cola de emisión supera N eventos/run, agrupar (batch flush cada 100ms).

## execa y procesos

- Todo proceso hijo se lanza con `execa` desde `@cac/claude-runner` o workers de BullMQ. **Nunca `child_process` directo.**
- Reglas de spawning: ver `runner.md`.

## Seguridad (resumen)

- Nunca loggear ni persistir: variables `ANTHROPIC_*`, valores de `.env*`, tokens git.
- Sanear cualquier ruta de filesystem recibida del cliente antes de usarla: resolver absoluta y comprobar que cae dentro de `PROJECTS_ROOT`.
- No permitir al cliente elegir arbitrariamente flags del CLI `claude`. Whitelist cerrada en `@cac/shared`.

## Tests

- Vitest. Integración con Fastify en `apps/api/__tests__/` usando `fastify.inject()`.
- DB de test: Postgres real (via Docker Compose `postgres-test`), no mocks.
- Mockear sólo lo que cruza proceso (el CLI `claude`, redis) y sólo cuando el test no lo prueba.
