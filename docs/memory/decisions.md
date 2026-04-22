# Decisiones arquitectónicas

Registro de decisiones no obvias del código. Formato por entrada:

```
## [YYYY-MM-DD] Título
**Contexto**: por qué surgió.
**Decisión**: qué se eligió.
**Alternativas descartadas**: qué más se consideró y por qué no.
**Consecuencias**: qué implica a futuro.
```

---

## [2026-04-22] UUID v7 como PK en todas las tablas

**Contexto**: necesitábamos IDs que se pudieran generar en la aplicación antes del INSERT (para propagar el `runId` a logs y eventos del runner antes de que el run exista en DB), y que además fueran eficientes como PKs en Postgres.

**Decisión**: UUID v7 generados en app con el paquete `uuidv7`. No usar `gen_random_uuid()` de Postgres.

**Alternativas descartadas**:
- UUID v4: completamente aleatorio, causa index fragmentation severo en tablas grandes (run_events puede tener millones de filas). No sortable por tiempo.
- ULID: similar a v7 pero menos estándar. La librería `uuidv7` es más mantenida.
- BIGSERIAL autoincrement: no se puede conocer el ID antes del INSERT, lo que rompería el flujo runner → worker → DB donde necesitamos el `runId` desde el spawn.

**Consecuencias**: los IDs son lexicográficamente ordenables por tiempo de creación, lo que permite paginación por cursor usando el propio UUID. Hay que importar `uuidv7` en `packages/db/src/lib/uuid.ts` y en cualquier código que genere IDs antes de insertar.

---

## [2026-04-22] BullMQ como cola de runs (no spawn directo en request handler)

**Contexto**: un run de Claude puede durar minutos. Si el runner se lanza directamente en el handler HTTP y el cliente desconecta o el servidor reinicia, el proceso queda huérfano sin gestión de estado.

**Decisión**: BullMQ con Redis. El handler crea el Run en DB y encola el job; un worker independiente hace el spawn.

**Alternativas descartadas**:
- Spawn directo en handler con `detached: true`: no hay forma de cancelarlo, reiniciarlo ni conocer su estado si el proceso padre muere.
- Worker threads de Node.js: no aíslan bien el proceso del CLI; si el CLI crashea podría llevarse el worker thread y el proceso API.
- Cola en memoria (p.ej. `p-queue`): no sobrevive reinicios del servidor. Inaceptable para runs que duran minutos.

**Consecuencias**: necesitamos Redis como dependencia adicional. El job tiene que ser idempotente (aunque en la práctica runs no se reintentan automáticamente). La cancelación requiere comunicación worker→runner vía AbortSignal propagado desde BullMQ.

---

## [2026-04-22] Socket.IO sobre SSE para streaming de eventos

**Contexto**: los eventos del runner llegan al cliente en tiempo real. Necesitábamos un canal de push desde servidor a cliente.

**Decisión**: Socket.IO con namespace `/runs` y rooms por `runId`.

**Alternativas descartadas**:
- SSE (Server-Sent Events): unidireccional, no tiene rooms nativos, reconexión manual, no permite enviar mensajes del cliente al servidor por el mismo canal (útil para cancelación futura).
- WebSocket puro: habría que implementar rooms, broadcast, y reconexión desde cero.
- Long polling: latencia inaceptable para logs en tiempo real.

**Consecuencias**: dependencia de `socket.io` en API y `socket.io-client` en Web. Socket.IO añade overhead de protocolo pero simplifica rooms, namespaces y reconexión automática con replay.

---

## [2026-04-22] Drizzle ORM sobre Prisma

**Contexto**: elección del ORM para `packages/db`.

**Decisión**: Drizzle ORM.

**Alternativas descartadas**:
- Prisma: requiere codegen (`prisma generate`) en cada cambio de schema, lo que complica el monorepo pnpm. Su query builder es menos expresivo para agregaciones complejas (métricas de tokens). El binario de Prisma Engine añade peso.
- Kysely: más cercano a SQL crudo, buena type safety, pero más verboso y sin migraciones integradas.
- SQL crudo con `postgres` (node-postgres): máximo control pero sin type safety ni abstracción de repositorios.

**Consecuencias**: Drizzle es más nuevo y su ecosystem de herramientas (drizzle-studio, drizzle-kit) es menos maduro que Prisma. Las migraciones de drizzle-kit son menos robustas en edge cases complejos. Compensamos con la regla de no editar migraciones a mano.

---

## [2026-04-22] `PROJECTS_ROOT` como límite de aislamiento del runner

**Contexto**: el runner necesita validar que el `cwd` de cada spawn esté dentro de un directorio controlado para evitar path traversal.

**Decisión**: variable de entorno `PROJECTS_ROOT` que define el directorio raíz bajo el que deben estar todos los proyectos registrados en CAC. Validación con `fs.realpath` + prefix check en cada spawn.

**Alternativas descartadas**:
- Validar sólo que el path existe y que está registrado en DB: no previene symlinks que escapen del área controlada.
- Sin restricción (confiar en que el admin registra paths seguros): inaceptable; en v2 con multi-usuario cualquier viewer podría manipular el path.

**Consecuencias**: el operador debe configurar `PROJECTS_ROOT` correctamente en el `.env`. Si un proyecto legítimo está fuera de ese directorio, hay que moverlo o ampliar `PROJECTS_ROOT`. En Windows hay que normalizar separadores (`path.win32`) antes del prefix check.
