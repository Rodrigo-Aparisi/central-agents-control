---
name: db-rules
description: Reglas obligatorias para el paquete de base de datos (Drizzle + Postgres 16)
globs:
  - packages/db/**
---

# DB (packages/db)

Reglas para el paquete de base de datos. Esquema completo y razones en `docs/spec/02-db-schema.md`.

## Drizzle ORM

- Un archivo por tabla en `packages/db/src/schema/<table>.ts`. Barrel en `schema/index.ts`.
- Nombres de tabla: `snake_case` plural (`runs`, `projects`, `run_events`, `run_artifacts`).
- Nombres de columna: `snake_case`. Campos TS generados: `camelCase` (lo hace Drizzle al inferir).
- PKs: UUID v7 (`uuid`), generados en la app (no `gen_random_uuid()` de Postgres) para poder propagarlos antes del insert.
- Timestamps: `created_at`, `updated_at` con `timestamp({ withTimezone: true, mode: 'string' })`. Default `defaultNow()`.
- Enums: definidos con `pgEnum`. Los valores literales también se exportan desde `@cac/shared` para que web/api los usen sin importar `@cac/db`.
- JSONB para payloads flexibles (`params`, `event_payload`, `metadata`). Tipados con un `$type<T>()` que refleja un schema Zod de `@cac/shared`.

## Migraciones

- Generadas con `drizzle-kit generate`. Nunca se editan a mano salvo para fixes quirúrgicos documentados.
- Una migración por PR cuando haya cambio de schema. No agrupar múltiples cambios no relacionados.
- Migraciones idempotentes en la medida de lo posible (`CREATE INDEX IF NOT EXISTS` cuando Drizzle lo permita, o `DO $$ ... $$` guards).
- Siempre se corren en `pnpm db:migrate`. Nunca aplicar manualmente a una DB compartida.
- Rollback: no se generan rollbacks automáticos. Para revertir, migración nueva que deshace.

## Índices y FKs

- FKs explícitas en todo `*_id` que referencia otra tabla. `onDelete: 'cascade'` solo cuando la semántica lo justifica (ej: `run_events` → `runs`).
- Índices en:
  - Toda FK.
  - Columnas de filtro frecuente (`status`, `project_id`, `created_at`).
  - Composite donde la query real lo pida (documentar en la migración el por qué).
- No crear índices "por si acaso".

## Tipos y validación

- Cada tabla exporta: `TableName` (el schema Drizzle), `TableNameRow` (`$inferSelect`), `TableNameInsert` (`$inferInsert`), y cuando aplique un Zod schema en `@cac/shared` para validar al cruzar red.
- `@cac/db` **no** depende de Fastify ni React. Es una librería pura de acceso a datos.
- Un `createDb(url)` factory devuelve el cliente Drizzle + un objeto de repositorios por tabla (`db.runs.findById(id)`, `db.runs.insert({...})`). Nada de queries SQL sueltas en `apps/api`.

## Soft delete

- No por defecto. Borrar significa borrar.
- Si una tabla necesita soft delete, añadir `deleted_at timestamptz null` y un helper `.excludingDeleted()` en el repositorio. Documentar el por qué en `docs/memory/decisions.md`.

## Transacciones

- Operaciones multi-tabla van en `db.transaction(async tx => { ... })`.
- Para consistencia de runs (insertar run + N eventos iniciales), siempre transacción.
- No transacciones de larga duración; si algo tarda, partirlo.

## Seed y dev data

- Script `packages/db/scripts/seed.ts` para dev. Nunca se corre en producción.
- Factories tipadas (ej: `makeProject`, `makeRun`) en `packages/db/src/factories.ts` para tests y seed.

## Convención de IDs en el producto

- `projectId`, `runId`, `eventId`, etc. UUID v7 en todos los contratos web↔api↔db. Nunca exponer PKs numéricos.
