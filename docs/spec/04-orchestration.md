# 04 — Orquestación y Runner

## Flujo completo de un run

```
[Web] POST /v1/projects/:id/launch
  body: { prompt, params? }
  → API valida con Zod
  → API crea Run (status: queued, id: UUIDv7) en DB
  → API encola job BullMQ { runId, projectId, prompt, params }
  → API responde 202 { runId }

[BullMQ worker: runs]
  → Obtiene projectRoot de DB
  → runner.start({ runId, projectRoot, prompt, params })
  → Actualiza Run.status = running, Run.started_at en DB

[claude-runner]
  → validateProjectRoot(projectRoot, PROJECTS_ROOT)
  → sanitize(prompt)  → wrapUntrustedInput(prompt)
  → buildArgs(params) → valida contra ALLOWED_CLAUDE_FLAGS
  → execa('claude', ['-p', prompt, '--output-format', 'stream-json', ...flags], {
      cwd: projectRoot,
      env: sanitizedEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      reject: false,
      cleanup: true,
      timeout: params.timeoutMs,
    })
  → AsyncIterable<Event> desde stdout via readline
  → Emite eventos: { runId, seq, timestamp, type, payload }

[worker itera eventos]
  → redact(event) antes de persistir
  → batch insert run_events (flush cada 200ms o cada 50 eventos)
  → emite run:event por Socket.IO al room del runId

[runner.result resuelve]
  → worker actualiza Run: status, exit_code, duration_ms, usage, finished_at
  → worker snapshot artefactos modificados → insert run_artifacts
  → worker emite run:status final por Socket.IO
  → BullMQ marca job como completed
```

## `packages/claude-runner` — API pública

```ts
interface RunnerConfig {
  runId: string
  projectRoot: string       // validado: abs, dentro de PROJECTS_ROOT
  prompt: string            // ya saneado por el caller
  params: RunParams
  signal?: AbortSignal      // para cancelación desde el worker
}

interface ExitResult {
  exitCode: number
  durationMs: number
  usage: RunUsage
  reason: 'completed' | 'cancelled' | 'timeout' | 'crashed'
}

interface RunnerInstance {
  start(config: RunnerConfig): {
    runId: string
    events: AsyncIterable<RunEvent>
    result: Promise<ExitResult>
  }
  cancel(runId: string, reason?: string): void
}
```

Errores van en `result`, nunca como throw dentro del iterable. El iterable cierra limpio en todos los casos.

## Parser de stream-json

Archivo: `packages/claude-runner/src/parser.ts`.

```
stdout (stream)
  → readline (line-by-line)
  → JSON.parse(line)  [try/catch]
    OK → mapToEvent(raw) → emit
    Error → emit runner:parse-error { raw: line.slice(0, 1024) } → continuar
```

### Mapeo de tipos del CLI a EventType de CAC

| Tipo del CLI (`claude`) | `EventType` de CAC | Notas |
|---|---|---|
| `message` con role `assistant` | `assistant_message` | |
| `tool_use` | `tool_use` | Verificar herramienta en whitelist |
| `tool_result` | `tool_result` | Output truncado a 4KB |
| `thinking` | `thinking` | |
| `usage` | `usage` | |
| `system` | `system` | |
| `error` | `error` | |
| cualquier otro | `unknown` | Loggear warn |

Evento `tool_use` con herramienta fuera de whitelist: descartar del iterable, loggear `warn` con `{ type: 'suspicious_tool_use', tool, runId }`.

## Cancelación

```
runner.cancel(runId) o AbortSignal fired
  → SIGTERM al proceso hijo
  → espera 5000ms
  → si sigue vivo → SIGKILL
  → result resuelve con reason: 'cancelled'
```

El worker propaga cancelación desde:
- `POST /v1/runs/:id/cancel` (request HTTP) → BullMQ job update → AbortSignal
- Timeout del job BullMQ (configurable, default 35min con margen sobre el runner)

## BullMQ: colas y workers

### Cola `runs`
- **Job**: `{ runId, projectId, prompt, params }`
- **Worker**: `apps/api/src/workers/runs.ts`
- **Concurrency**: 3 (configurable via `MAX_CONCURRENT_RUNS`)
- **Reintentos**: 0 (runs no se reintentan automáticamente; el usuario re-lanza si quiere)
- **Timeout del job**: `params.timeoutMs + 5min` (margen para cleanup)
- **On failure**: actualiza `Run.status = failed`, emite `run:status` por Socket.IO

### Cola `git-ops` (v1 tardío)
- Operaciones git sobre el proyecto objetivo: `git diff`, `git log` para mostrar artefactos.
- **Concurrency**: 5
- **Reintentos**: 2 con backoff exponencial

### Cola `cleanup`
- Limpieza de runs antiguos: borrar `run_events` y `run_artifacts` de runs > 30 días.
- Cron schedule: diario a las 3:00.

## Socket.IO: namespaces y eventos

### Namespace `/runs`
- El cliente hace `socket.emit('join', runId)` tras recibir el 202.
- El servidor añade el socket a la room `runId`.
- Al reconectar, el cliente puede pedir replay: `socket.emit('replay', { runId, fromSeq })`.

### Eventos emitidos por el servidor

```ts
// Nuevo evento del stream
socket.to(runId).emit('run:event', RunEvent)

// Cambio de status del run
socket.to(runId).emit('run:status', {
  runId: string
  status: RunStatus
  exitCode?: number
  reason?: string
})

// Batch de logs (cuando hay muchos eventos seguidos)
socket.to(runId).emit('run:log', {
  runId: string
  events: RunEvent[]
})
```

### Backpressure
Si hay > 100 eventos/s, el worker agrupa en batches y emite `run:log` cada 100ms en lugar de `run:event` uno a uno. El cliente los desencola en orden por `seq`.

## Gestión de procesos en Windows

En Windows (donde corre v1):
- `cleanup: true` en execa mata al proceso hijo si el padre muere.
- SIGTERM no existe nativamente en Windows; execa mapea a `taskkill /F /PID`. Timeout de SIGKILL es 5s igual.
- `USERPROFILE` en lugar de `HOME` en `sanitizedEnv`.
- Paths con `path.win32` en validación de cwd cuando `process.platform === 'win32'`.
