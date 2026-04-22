# 05 — Observabilidad

## Logging (Pino)

### Configuración raíz
`apps/api/src/logger.ts` crea el logger global con:

```ts
pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'body.secrets',
      'body.*.token',
      '*.ANTHROPIC_API_KEY',
    ],
    censor: '[REDACTED]',
  },
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
})
```

### Jerarquía de niveles

| Nivel | Cuándo |
|---|---|
| `trace` | Detalles internos del runner: cada línea de stream-json recibida |
| `debug` | Decisiones de lógica: job dequeued, parser state |
| `info` | Hitos: run iniciado, run completado, proyecto creado |
| `warn` | Recuperables: tool_use sospechoso, línea stream inválida, retry de job |
| `error` | No recuperables: spawn fallido, DB unavailable, crash del runner |

### Contexto por request
`pino-http` añade `requestId` (UUID) a cada log del request. Dentro de un run:

```ts
const runLog = req.log.child({ runId, projectId })
runLog.info('run started')
```

### Qué nunca loggear
- Prompt completo. Solo `sha256(prompt).slice(0, 12)` + `promptLengthBytes`.
- Variables `ANTHROPIC_*`. Redactadas en la config de Pino.
- Tokens Git (`ghp_`, `gho_`). Redactados vía `redact()` del runner.
- Contenido de archivos del proyecto. Solo rutas relativas.

## Audit log

Generado por el hook `PreToolUse` de `.claude/settings.json`. Formato línea:

```
2026-04-22T22:15:03Z | [Bash] pnpm install --filter @cac/shared
2026-04-22T22:15:04Z | [Edit] packages/shared/src/types.ts
```

En v1: archivo `.claude/audit.log` en el repo (gitignored). En v2: tabla `audit_events` en DB.

## Métricas (v1: client-side, Recharts)

Las métricas se calculan desde los datos que ya están en DB. No hay servidor de métricas externo en v1.

### Por run
- `duration_ms`: duración total.
- `usage.inputTokens`, `usage.outputTokens`, `usage.cacheReadTokens`.
- `usage.estimatedCostUsd`.
- Número de `tool_use` events.
- Número de archivos modificados (`run_artifacts`).

### Por proyecto (agregado)
- Total de runs por estado.
- Tokens y coste acumulados (últimos 7/30 días).
- Duración media de run.
- Tasa de éxito (completed / total).

### Visualización en Web
- `Recharts`: gráficos de barras (runs por día), línea (tokens por run), pie (distribución de estados).
- Filtros: rango de fechas, proyecto específico.
- Colores: tokens CSS del tema, nunca hardcoded.

## Health check

`GET /health` — responde siempre 200 si el servidor está vivo.

```json
{
  "status": "ok",
  "db": "ok" | "degraded",
  "redis": "ok" | "degraded",
  "timestamp": "2026-04-22T22:15:03Z"
}
```

`db` y `redis` se comprueban con ping de 1s de timeout. Si fallan, responden `degraded` (no 503, para no interrumpir load balancers en v2).

## Error tracking (v1: logs estructurados)

No hay Sentry ni equivalente en v1. Los errores se loguean con stack completo a nivel `error` en Pino. En v2 se evalúa Sentry self-hosted o Axiom.

Errores tipados:

```ts
// apps/api/src/errors.ts
class AppError extends Error {
  constructor(
    public code: ErrorCode,    // de @cac/shared
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) { super(message) }
}
```

El error handler global de Fastify:
1. Si es `AppError`: responde con `{ error: { code, message, details } }` + `statusCode`.
2. Si es `ZodError` (validación): responde 400 con `{ error: { code: 'VALIDATION_ERROR', details: issues } }`.
3. Cualquier otro: loggea con stack, responde 500 con `{ error: { code: 'INTERNAL', message: 'Internal server error' } }`.

## Performance de runs en vivo

El worker monitorea backpressure del socket:
- Si hay > 100 eventos pendientes de emitir en el room, agrupa y emite `run:log` (batch) cada 100ms.
- Si el proceso hijo supera `WARNING_THRESHOLD_MS` (default: 20min), emite `run:status` con `warning: 'long_run'`.

El cliente virtualiza el log viewer con `react-virtual` para no colapsar el DOM con miles de eventos.
