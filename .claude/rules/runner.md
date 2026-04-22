---
name: runner-rules
description: Reglas obligatorias para el wrapper del CLI claude (execa + stream-json)
globs:
  - packages/claude-runner/**
---

# Claude Runner (packages/claude-runner)

Wrapper que lanza el CLI `claude -p --output-format stream-json`, parsea su salida y emite eventos tipados. Detalle completo en `docs/spec/04-orchestration.md`.

## Responsabilidades

- Lanzar un proceso `claude` por run, aislado al `cwd` del proyecto objetivo.
- Parsear `stream-json` (JSON line-delimited) a eventos tipados.
- Exponer una API reactiva (async iterator / EventEmitter) consumible por el API.
- Gestionar ciclo de vida: spawn → stream → close → cleanup.
- Permitir cancelación limpia (SIGTERM → SIGKILL con timeout).
- Sanear input potencialmente hostil antes de pasarlo al CLI.

## execa

- **Siempre** `execa`, nunca `child_process` directo.
- Config base obligatoria:
  ```ts
  execa(claudeBin, args, {
    cwd: projectRoot,           // absolute, validado dentro de PROJECTS_ROOT
    env: sanitizedEnv,          // sólo lo que el runner necesita, no process.env completo
    stdio: ['pipe', 'pipe', 'pipe'],
    reject: false,              // manejamos exit codes nosotros
    cleanup: true,              // kill del hijo si muere el padre
    timeout: runTimeoutMs,      // from config, default 30min
  });
  ```
- `sanitizedEnv`: arranca vacío, añade explícitamente `PATH`, `HOME` (o `USERPROFILE` en Windows), y lo que `claude` necesite (`ANTHROPIC_API_KEY` si está configurado globalmente, nunca desde input del usuario).
- Nunca inyectar secretos del usuario de CAC en el env del hijo salvo que sea el secreto explícito del proyecto.

## stream-json: parseo

- Parser en `packages/claude-runner/src/parser.ts`. Consume el stdout como stream de líneas (usar `readline` o `split2` sobre el stream).
- Cada línea se parsea con `JSON.parse` dentro de try/catch. Línea inválida → evento `runner:parse-error` con la línea cruda (truncada a 1KB) y se continúa.
- Eventos de `claude` se mapean a los tipos de `@cac/shared`: `assistant-message`, `tool-use`, `tool-result`, `thinking`, `usage`, `system`, `error`. Evento desconocido → se emite como `unknown` sin perderlo, pero se loggea a `warn`.

## Tipos de eventos emitidos

- Todos tipados con Zod schemas en `@cac/shared`. El runner **no** inventa shapes.
- Eventos tienen `runId`, `seq` (secuencia monotónica por run), `timestamp`, `type`, `payload`.
- Se persisten en `run_events` (ver `db.md`). El consumidor (API) hace batch insert.

## Ciclo de vida

1. `runner.start(config)` → devuelve `{ runId, events: AsyncIterable<Event>, result: Promise<ExitResult> }`.
2. Consumer itera `events` hasta que el iterable acaba.
3. `result` resuelve con `{ exitCode, durationMs, usage, reason: 'completed' | 'cancelled' | 'timeout' | 'crashed' }`.
4. Cleanup implícito: al resolver `result`, el proceso hijo está muerto y los streams cerrados.

## Cancelación

- `runner.cancel(runId, reason?)` → SIGTERM al hijo. Si no muere en 5s → SIGKILL.
- Cualquier `AbortSignal` pasado a `start()` también cancela.
- Los consumidores deben propagar cancelación del request HTTP / job BullMQ al runner.

## Aislamiento de cwd

- `projectRoot` se valida antes de spawn: debe ser absoluta, existir, y estar contenida en `PROJECTS_ROOT` (configurable). Si no, `RunnerError('INVALID_CWD')`.
- No seguir symlinks que escapen del root (usar `fs.realpath` + prefix check).

## Input hostil

- Cualquier string que venga del usuario y se concatene en args o prompt del CLI pasa por:
  - Validación Zod (tipo, longitud máxima).
  - Sanitizado: quitar caracteres de control, limitar a UTF-8 válido.
  - Wrapping con la plantilla anti-prompt-injection (ver `CLAUDE.md`).
- Bloques `tool_use` del CLI que pidan herramientas no whitelistadas se descartan y se loggea `warn` con `suspicious: true`.

## Redacción de secretos

- Antes de persistir o emitir un evento, pasar por `redact()` que elimina patrones: API keys (`sk-ant-...`), tokens GitHub (`ghp_`, `gho_`), URLs con credenciales, emails si así se configura.
- Nunca loguear el prompt completo en `info`. Sólo hash + longitud.

## Errores

- `RunnerError` con códigos: `INVALID_CWD`, `SPAWN_FAILED`, `PARSE_ERROR`, `TIMEOUT`, `CANCELLED`, `CRASHED`.
- Los errores se exponen via `result`, no via throw dentro del iterable (el iterable cierra limpio).

## Tests

- Unit tests del parser con fixtures de stream-json reales (capturados de runs de dev).
- Integración con un fake binario (`packages/claude-runner/test/fake-claude.ts`) que imprime stream-json conocido. No depender del `claude` real en CI.
- Tests de cancelación, timeout, cwd inválido, línea corrupta.
