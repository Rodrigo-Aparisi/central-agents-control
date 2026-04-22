# 07 — Features v1

v1 completa el MVP con observabilidad, UX pulida y las features que hacen de CAC una herramienta de uso diario. Sigue siendo localhost, usuario único.

---

## F-07: Dashboard de métricas

**Objetivo**: entender el uso del agente en el tiempo.

### API
- `GET /v1/stats/projects/:id` → tokens/coste/duración agregados por día (últimos 30 días).
- `GET /v1/stats/global` → métricas globales: total runs, total tokens, total coste, top proyectos.

### Web
- Página `/dashboard`: overview global.
- Recharts: gráfico de barras (runs por día), línea (tokens acumulados), pie (distribución de estados).
- Filtros: proyecto, rango de fechas (7d / 30d / custom).
- Colores desde tokens CSS del tema.

---

## F-08: Grafo de dependencias entre runs

**Objetivo**: visualizar cómo se encadenan runs (un run lanzado a partir de otro).

### DB
- Columna `parent_run_id uuid` en `runs` (nullable, FK → `runs.id`).

### API
- `GET /v1/projects/:id/run-graph` → nodos (runs) y aristas (parent_run_id).

### Web
- Tab "Graph" en la página de proyecto.
- `@xyflow/react`: nodos custom con badge de estado, aristas de dependencia.
- Layout automático con dagre.
- Click en nodo → navega a `/runs/:runId`.

---

## F-09: Replay y navegación de eventos

**Objetivo**: poder navegar el historial de un run como una timeline.

### API
- `GET /v1/runs/:id/events?fromSeq=0&limit=100` → paginación de eventos por cursor (`seq`).

### Web
- Slider de timeline en la página del run completado.
- Navegación a un evento específico: el log viewer hace scroll al evento.
- "Jump to error": botón que lleva al primer evento de tipo `error`.

---

## F-10: Relanzar run (re-run)

**Objetivo**: relanzar un run anterior con el mismo prompt y params.

### API
- `POST /v1/runs/:id/rerun` → crea nuevo Run clonando `prompt` y `params` del run original.

### Web
- Botón "Re-run" en la página del run y en la tabla de historial.
- Opción de editar el prompt antes de relanzar.

---

## F-11: Monaco file browser

**Objetivo**: navegar y leer los archivos del proyecto directamente desde CAC.

### API
- `GET /v1/projects/:id/files?path=src/` → lista de ficheros/directorios bajo `path`.
- `GET /v1/projects/:id/files/content?path=src/index.ts` → contenido del archivo (max 500KB).
- Validación server-side: `path` dentro de `project.rootPath`.

### Web
- Panel lateral en la página de proyecto con árbol de ficheros.
- Click en archivo → Monaco en modo lectura (no edición, v1).
- Resaltado de archivos modificados por el último run.

---

## F-12: Configuración por proyecto

**Objetivo**: personalizar comportamiento del runner por proyecto.

### Web
- Tab "Settings" en la página de proyecto.
- Campos: timeout (slider), modelo (select), flags adicionales (checkboxes de whitelist).
- Guardado → `PUT /v1/projects/:id` con `claudeConfig`.

---

## F-13: Notificaciones en la UI

**Objetivo**: alertar al usuario cuando un run termina (aunque esté en otra pestaña del mismo browser).

### Web
- Toast (shadcn `sonner`) al completar/fallar un run.
- Badge de runs activos en el header (contador).
- `document.title` actualiza con el estado cuando hay runs activos.

---

## F-14: Dark mode y preferencias

**Objetivo**: persistencia del tema y preferencias del usuario.

### Web
- Toggle dark/light en el header. Persiste en `localStorage`.
- Detecta `prefers-color-scheme` del sistema en el primer acceso.
- Preferencias adicionales: tamaño de fuente del log viewer, vista de diff (side-by-side/unified).

---

## F-15: Export de run

**Objetivo**: exportar un run completo (log + diff + metadatos) para compartir o archivar.

### API
- `GET /v1/runs/:id/export?format=json|markdown` → descarga el run completo.
- JSON: todos los campos del run + eventos (redactados) + artefactos.
- Markdown: prompt, log resumido, diff de archivos.

---

## Criterio de v1 completado

> CAC reemplaza el flujo manual de abrir una terminal, lanzar `claude -p`, esperar, hacer `git diff` y copiar resultados. Todo desde el browser, con historial persistente y métricas de uso.
