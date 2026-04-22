# 06 — Features MVP

El MVP es lo mínimo que hace CAC útil: puedes registrar un proyecto, lanzar un run, ver el log en vivo y el diff resultante.

## Criterio de MVP completado

> Un desarrollador puede abrir CAC en el browser, seleccionar un proyecto local, escribir un prompt, ver el output del agente en tiempo real y revisar los archivos que modificó.

---

## F-01: Gestión de proyectos

**Scope**: CRUD de proyectos en DB + UI de lista.

### API
- `GET /v1/projects` → lista paginada por cursor.
- `POST /v1/projects` → crea proyecto. Body: `{ name, rootPath, description? }`.
- `GET /v1/projects/:id` → detalle.
- `PUT /v1/projects/:id` → actualiza nombre/descripción/config.
- `DELETE /v1/projects/:id` → borra con CASCADE.

### Web
- Página `/projects`: lista de proyectos con nombre, path, fecha de último run, estado del último run.
- Formulario de creación: nombre + `rootPath` (input texto, validado al guardar).
- Menú de contexto por proyecto: editar, borrar (confirmar), lanzar run.

### Validaciones
- `rootPath` debe existir en disco al guardar (validación server-side con `fs.existsSync`).
- `rootPath` debe estar bajo `PROJECTS_ROOT`.

---

## F-02: Lanzar un run

**Scope**: POST que encola un run y devuelve 202 + runId.

### API
- `POST /v1/projects/:id/launch` → crea Run (queued) + encola job BullMQ.
- Body: `{ prompt: string, params?: { model?, timeoutMs?, flags? } }`.
- Responde: `202 { runId }`.

### Web
- Panel lateral o modal de "New Run" desde la página de proyecto.
- Textarea para el prompt (Monaco con syntax hint).
- Opciones colapsables: modelo, timeout, flags permitidos.
- Botón "Launch" → POST → redirige a `/runs/:runId`.

---

## F-03: Log en vivo del run

**Scope**: streaming de eventos por Socket.IO al cliente, renderizado en tiempo real.

### API / Runner
- Worker itera `runner.events`, hace batch insert cada 200ms, emite `run:event` / `run:log` por Socket.IO.
- Emite `run:status` al inicio (running) y al final (completed/failed/cancelled/timeout).

### Web
- Página `/runs/:runId`: muestra log en vivo.
- Log viewer virtualizado (`react-virtual`): soporta miles de eventos sin lag.
- Tipos de evento con colores distintos: `assistant_message` (blanco), `tool_use` (azul), `tool_result` (gris), `error` (rojo), `thinking` (púrpura tenue).
- Badge de estado del run (animado mientras `running`).
- Botón "Cancel" → `POST /v1/runs/:id/cancel` → runner SIGTERM.
- Al completar: muestra resumen de usage (tokens, duración, coste estimado).

---

## F-04: Diff viewer de artefactos

**Scope**: visualización de los archivos modificados por el agente.

### API
- `GET /v1/runs/:id/artifacts` → lista de artefactos con `filePath`, `operation`, `diff`.

### Web
- Sección "Changed files" en la página del run (disponible cuando `status = completed`).
- Lista de archivos con badge de operación (created/modified/deleted).
- Al seleccionar: `react-diff-viewer-continued` side-by-side.
- Switch a unified mode.
- Respeta tema (light/dark).

---

## F-05: Historial de runs de un proyecto

**Scope**: listado de runs pasados con estado y métricas básicas.

### API
- `GET /v1/projects/:id/runs` → lista paginada (cursor) con: `id`, `status`, `createdAt`, `duration_ms`, `usage`.

### Web
- Página `/projects/:id`: tab "Runs" con tabla de runs.
- Columnas: fecha, estado, duración, tokens, coste, acciones (ver log, relanzar).
- Filtros: estado, rango de fechas.
- Paginación por cursor ("Load more").

---

## F-06: Health y estado del sistema

**Scope**: indicador visual de que DB y Redis están accesibles.

### API
- `GET /health` → `{ status, db, redis, timestamp }`.

### Web
- Badge en el header: verde (ok), amarillo (degraded), rojo (error).
- Poll cada 30s.

---

## Qué NO está en el MVP

- Métricas agregadas / gráficos (F-07, en v1).
- Grafo de dependencias entre runs (v1).
- Replay de run desde un evento concreto (v1).
- Auth (v2).
- Multi-usuario (v2).
- Docker Compose completo (las instrucciones de setup asumen postgres/redis en Docker, pero no hay `Dockerfile` para la app).
