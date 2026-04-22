# 02 — DB Schema

Motor: Postgres 16. ORM: Drizzle. Todas las tablas en el schema `public`.

## Tablas

### `projects`

Representa un proyecto local que CAC puede orquestar.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | UUID v7, generado en app |
| `name` | `text NOT NULL` | Nombre mostrado en UI |
| `root_path` | `text NOT NULL` | Ruta absoluta al directorio del proyecto |
| `description` | `text` | Descripción opcional |
| `claude_config` | `jsonb` | Config específica del proyecto para el runner (flags whitelist, timeout, etc.) |
| `metadata` | `jsonb` | Datos adicionales libres |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

Índices: PK en `id`. Índice en `created_at` para ordenación.

### `runs`

Una ejecución de `claude -p` sobre un proyecto.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | UUID v7 |
| `project_id` | `uuid NOT NULL` | FK → `projects.id` |
| `status` | `run_status NOT NULL` | Enum: `queued`, `running`, `completed`, `cancelled`, `failed`, `timeout` |
| `prompt` | `text NOT NULL` | Prompt enviado al CLI (saneado, sin secretos) |
| `params` | `jsonb` | Flags del CLI usados (whitelist). Tipo: `RunParams` de `@cac/shared` |
| `usage` | `jsonb` | Tokens input/output/cache, coste estimado. Tipo: `RunUsage` |
| `exit_code` | `integer` | Código de salida del proceso |
| `duration_ms` | `integer` | Duración en ms |
| `error` | `text` | Mensaje de error si `status = failed` |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Momento de creación (≈ encolado) |
| `started_at` | `timestamptz` | Momento en que el worker hizo spawn |
| `finished_at` | `timestamptz` | Momento de resolución |

Índices: PK, FK `project_id`, `status`, `created_at`. Composite `(project_id, created_at)` para el listado de runs por proyecto.

### `run_events`

Eventos individuales del stream-json del CLI. Una fila por línea de salida significativa.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | UUID v7 |
| `run_id` | `uuid NOT NULL` | FK → `runs.id` ON DELETE CASCADE |
| `seq` | `integer NOT NULL` | Secuencia monotónica dentro del run |
| `type` | `event_type NOT NULL` | Enum: ver abajo |
| `payload` | `jsonb NOT NULL` | Contenido tipado según `type`. Tipo: `EventPayload` de `@cac/shared` |
| `timestamp` | `timestamptz NOT NULL` | Momento del evento (del stream, no del insert) |

Índices: PK, FK `run_id` (con CASCADE), composite `(run_id, seq)` para replay ordenado.

**Enum `event_type`**: `assistant_message`, `tool_use`, `tool_result`, `thinking`, `usage`, `system`, `error`, `unknown`.

### `run_artifacts`

Archivos creados o modificados por el agente durante un run (snapshotted después del run).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | UUID v7 |
| `run_id` | `uuid NOT NULL` | FK → `runs.id` ON DELETE CASCADE |
| `file_path` | `text NOT NULL` | Ruta relativa al `project.root_path` |
| `operation` | `artifact_operation NOT NULL` | Enum: `created`, `modified`, `deleted` |
| `diff` | `text` | Diff unificado (patch) del cambio |
| `content_after` | `text` | Contenido completo del archivo post-run (sólo si < 500KB) |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

Índices: PK, FK `run_id`, `(run_id, file_path)`.

**Enum `artifact_operation`**: `created`, `modified`, `deleted`.

## Relaciones

```
projects (1) ──── (N) runs
runs     (1) ──── (N) run_events   [cascade delete]
runs     (1) ──── (N) run_artifacts [cascade delete]
```

## Shapes JSONB tipados

### `projects.claude_config` → `ProjectClaudeConfig`
```ts
{
  timeoutMs?: number        // default: 1_800_000 (30 min)
  allowedFlags?: string[]   // subset de la whitelist global
  model?: string            // override del modelo
}
```

### `runs.params` → `RunParams`
```ts
{
  flags: string[]           // flags efectivamente pasados al CLI
  model: string             // modelo usado
  timeoutMs: number
}
```

### `runs.usage` → `RunUsage`
```ts
{
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  estimatedCostUsd: number
}
```

### `run_events.payload` → `EventPayload` (discriminated union por `type`)
```ts
// assistant_message
{ content: string; stop_reason?: string }

// tool_use
{ tool: string; input: Record<string, unknown> }   // secrets redactados

// tool_result
{ tool: string; output: string; isError: boolean } // output truncado a 4KB

// usage
{ inputTokens: number; outputTokens: number; ... }

// error
{ code: string; message: string }
```

## Convenciones

- PKs UUID v7 generados en app (`packages/db/src/lib/uuid.ts` usando `uuidv7` npm).
- `updated_at` se actualiza via trigger Postgres o en el repositorio antes de cada UPDATE.
- No hay soft delete por defecto. Borrar un proyecto hace CASCADE sobre sus runs/eventos/artefactos.
- Migraciones en `packages/db/migrations/`, generadas con `drizzle-kit generate`.

## Índices de rendimiento previstos

Para el MVP las queries críticas son:
1. **Lista de proyectos**: `SELECT * FROM projects ORDER BY created_at DESC LIMIT 20` — índice en `created_at`.
2. **Lista de runs de un proyecto**: `WHERE project_id = $1 ORDER BY created_at DESC` — composite `(project_id, created_at)`.
3. **Eventos de un run en orden**: `WHERE run_id = $1 ORDER BY seq ASC` — composite `(run_id, seq)`.
4. **Runs activos** (polling de estado): `WHERE status IN ('queued','running')` — índice en `status`.
