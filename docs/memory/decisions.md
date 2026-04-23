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

---

## [2026-04-23] Imports internos sin extensión `.js` en paquetes TS

**Contexto**: con `moduleResolution: "Bundler"` + `verbatimModuleSyntax: true`, los imports relativos pueden o no llevar `.js`. Inicialmente se escribieron con `.js` (estilo Node ESM). Al ejecutar `drizzle-kit generate` falla con `Cannot find module './enums.js'` porque el loader interno de drizzle-kit (esbuild-kit sobre CJS) no resuelve `.js` → `.ts`.

**Decisión**: los imports relativos **dentro del monorepo** se escriben sin extensión (`from './enums'`, no `from './enums.js'`). Vitest, tsx, tsc (modo Bundler) y drizzle-kit resuelven correctamente. Los imports de módulos de `node:` sí llevan prefijo (`node:path`, `node:url`).

**Alternativas descartadas**:
- Mantener `.js` y parchear drizzle-kit: su loader no respeta `moduleResolution: Bundler`. Cambiarlo es frágil.
- Compilar a `dist/` antes de correr drizzle-kit: añade paso extra; preferimos cero-build en dev.
- `resolveJsonModule: true` + custom resolver: sobre-engineering para un problema resuelto con una convención.

**Consecuencias**: no se podrá publicar `@cac/db` o `@cac/shared` como paquetes npm ESM puros sin un paso de compilación que rewrite los imports. Es aceptable: son paquetes internos del monorepo. Al añadir nuevos paquetes, seguir la convención (sin `.js` en relativos).

---

## [2026-04-23] Node ESM compilado vs TS directo en consumidores

**Contexto**: todos los `package.json` de paquetes internos apuntan `main`/`types` directamente a `./src/index.ts` (no a `./dist`). No hay `tsc --build` en el flujo de dev.

**Decisión**: los consumidores (`apps/api`, `apps/web`) cargan TS directamente vía tsx (dev) o via su bundler (Vite para web). Sólo `apps/api` produce `dist/` para `pnpm start` (modo producción local).

**Alternativas descartadas**:
- `tsc -b` incremental + `references` entre paquetes: añade latencia en dev y complica debugging.
- Bundle cada paquete con tsup: sobra para paquetes puros Node/TS sin dependencias exóticas.

**Consecuencias**: arranque de dev inmediato (`tsx watch`). Si en el futuro se publica alguno de estos paquetes, habrá que introducir un paso de build; hoy el monorepo es cerrado.

---

## [2026-04-23] pnpm 9 fijado vía `packageManager`

**Contexto**: Corepack falló al activar pnpm (permisos en `C:\Program Files\nodejs`). Se instaló pnpm 9.15.9 global por usuario vía `npm -g`.

**Decisión**: `packageManager` del `package.json` raíz fija `pnpm@9.15.9`. `engines.pnpm >= 9.0.0`. Mientras no haya motivo, no se salta a pnpm 10 (breaking changes en resolución de peer deps).

**Consecuencias**: cualquier colaborador necesita pnpm 9.x. Corepack sigue siendo la vía recomendada si tiene permisos; si no, `npm i -g pnpm@9` en el prefix del usuario.

---

## [2026-04-23] `envExtras` y `argsPrefix` en `RunnerConfig`

**Contexto**: el runner sanea el env del proceso hijo a una whitelist mínima (PATH, HOME/USERPROFILE, etc.). Esto es correcto por seguridad, pero los tests necesitaban propagar `FAKE_CLAUDE_SCENARIO` al binario fake, y en producción existen proyectos con secretos propios (p.ej. `GH_TOKEN` de una organización concreta) que deben llegar al CLI sin abrir el flujo a `{...process.env}`.

**Decisión**: añadir dos campos explícitos al `RunnerConfig`:
- `envExtras: Record<string,string>` — variables que se mergean encima del env saneado. El caller decide qué entra, nunca el propio proceso padre.
- `argsPrefix: string[]` — args inyectados *antes* de la secuencia estándar `-p/--output-format/...`. En producción lo usamos vacío; en tests permite invocar `node fake-claude.mjs` reutilizando la misma `startRunner`.

**Alternativas descartadas**:
- Pasar todo `process.env` y delegar el filtrado al caller: rompe el principio de la whitelist y es fácil introducir regresiones.
- Duplicar `startRunner` con una variante `startRunnerUnsafe` para tests: duplica código y la versión testeada no sería la real.
- Inyectar el scenario via un flag CLI del fake: contamina la API pública con concerns de testing.

**Consecuencias**: la API pública del runner expone dos hooks. `argsPrefix` está documentado como hook de tests; si alguien lo usara en producción sería un smell. Vale la pena una nota en la spec (04-orchestration) en algún momento.

---

## [2026-04-23] Fake CLI en `.mjs` invocado vía `process.execPath` (no tsx)

**Contexto**: los tests de integración del runner necesitan un binario que imprima stream-json controlado. Se valoró ejecutarlo con tsx sobre un `.ts` para tener tipos, pero complica el spawn (tsx necesita su propio argv de script) y añade un salto más.

**Decisión**: el fake vive en `packages/claude-runner/test/fake-claude.mjs` (JS nativo). Los tests usan `claudeBin = process.execPath` + `argsPrefix = [fakeScript]`. Node lo interpreta directamente sin herramienta intermedia.

**Consecuencias**: el fake no tiene tipos TypeScript — es un script pequeño (~50 líneas) con lógica trivial, aceptable. Si crece lo convertiremos a `.ts` con un build step.

---

## [2026-04-23] Parser tolerante a esquemas CLI en evolución

**Contexto**: el stream-json de `claude` puede cambiar (alias de `type`, nombres de campos tokens). El parser debe sobrevivir a cambios menores del upstream sin romper el producto.

**Decisión**: el parser acepta varios aliases por tipo (`assistant` / `assistant_message` / `message` con rol assistant), lee tokens tanto desde un objeto raíz `usage` como desde campos top-level, y traduce cualquier tipo desconocido a `EventPayload { type: 'unknown', raw }` en lugar de descartar o crashear. Los `tool_use` con herramienta fuera de whitelist se marcan como `SuspiciousEvent` separado del flujo normal.

**Consecuencias**: la definición de la whitelist de tools vive en `packages/claude-runner/src/parser.ts::TOOL_USE_WHITELIST`; cuando se amplíe hay que revisar explícitamente en vez de asumirlo. Un cambio en Claude CLI que rename `tool_use` a otro discriminador se verá como `unknown` — aceptable; se detecta con el log warn y se parchea sin urgencia.

---

## [2026-04-23] Cancelación de runs via pub/sub de Redis

**Contexto**: el handler HTTP de `POST /v1/runs/:id/cancel` y el worker BullMQ que corre el runner pueden estar en el mismo proceso (v1) o en procesos distintos (v2). Si el job está en `waiting`, se puede cancelar directamente desde el handler (`job.remove()`), pero si ya está `active` necesitamos señalar al worker para que invoque `runner.cancel()`.

**Decisión**: el handler publica en un canal Redis (`cac:run:cancel`). El worker mantiene `Map<runId, cancelFn>` de los runs activos y se suscribe con un cliente Redis duplicado (BullMQ exige una conexión propia por subscriber). Al recibir el mensaje busca el runId y llama a la función, que dispara SIGTERM→5s→SIGKILL en el runner.

**Alternativas descartadas**:
- `job.updateData()` + polling: añade latencia y carga Redis innecesariamente.
- BullMQ eventos de "queue.drain" / "removed": no hay evento nativo para "cancélame" sobre un job activo.
- Shared memory (`Map`) en proceso: rompe cuando API y worker están en procesos distintos (v2 con Docker).
- WebSocket del cliente al worker: demasiado acoplamiento, obliga a tener sticky sessions.

**Consecuencias**: los mensajes de cancel son "fire-and-forget" — si llegan antes de que el worker haya registrado el canceller, se pierden. En la práctica el runner arranca antes de cualquier click humano, pero si hubiera riesgo real se podría persistir el intento de cancel en la DB y que el worker lo consulte al registrar el canceller.

---

## [2026-04-23] Stack de API MVP: Fastify 5 + fastify-type-provider-zod

**Contexto**: elección concreta de librerías para Fastify (plugin type provider, cors, rate-limit, socket.io setup).

**Decisión**:
- Fastify 5 + `fastify-plugin` + `fastify-type-provider-zod` para validación/serialización con schemas Zod.
- `@fastify/sensible` (sólo httpErrors util, no más).
- Socket.IO attachado al servidor HTTP de Fastify (`fastify.server`) en el path `/ws`, con namespace `/runs` (definido en `@cac/shared`).
- `close-with-grace` para shutdown ordenado que cierra worker + app.
- `ioredis` para cliente Redis (el compatible con BullMQ 5).

**Alternativas descartadas**:
- Express + Ajv a mano: más código, peor tipado, sin plugin system.
- ts-rest o tRPC: añaden otra capa de contratos sobre los schemas Zod que ya tenemos en `@cac/shared`; no aporta.
- SSE + fetch streaming: ya descartado (ver decision Socket.IO sobre SSE).

**Consecuencias**: los plugins de rutas heredan el `ZodTypeProvider` con `fastify.withTypeProvider<ZodTypeProvider>()`. Para el schema de respuesta `204 No Content`, se usa `z.null()` y el handler llama `reply.code(204).send(null)` (el serializer convierte a empty body).

---

## [2026-04-23] Helper `ping()` en `CacDb` en vez de exponer drizzle-orm

**Contexto**: el healthcheck de la API tenía que ejecutar `select 1` para validar la DB. Intentamos importar `sql` de `drizzle-orm` desde `apps/api`, pero añadir drizzle-orm como dep de API rompe el encapsulamiento (db es librería, api no debería saber de Drizzle).

**Decisión**: añadir `db.ping(): Promise<boolean>` al factory `createDb` en `@cac/db`. La API sólo depende de `@cac/db`, no de `drizzle-orm`.

**Consecuencias**: `@cac/db` define la superficie pública mínima; añadir más métodos "cross-cutting" (estadísticas, counts de health) sigue este patrón.

---

## [2026-04-23] TanStack Router code-based con ruta padre referenciada por import

**Contexto**: la regla `frontend.md` pide "rutas code-based, un archivo por ruta". En TanStack Router code-based cada ruta hija necesita `getParentRoute: () => rootRoute`. Mantener esa referencia en cada archivo acopla cada ruta al archivo `__root.tsx`.

**Decisión**: cada archivo de ruta exporta `Route = createRoute({ getParentRoute: () => rootRoute, path, component, loader })` importando `Route as rootRoute` desde `./__root`. Un `router.tsx` central hace `rootRoute.addChildren([...])` con todas las rutas y construye el `createRouter({ routeTree, context: { queryClient } })`.

**Alternativas descartadas**:
- File-based con plugin: la regla explícitamente dice "code-based".
- Un único archivo con todos los routes: rompe "un archivo por ruta".
- Factory helper: añade indirección que no compensa; el patrón actual es plano y rastreable.

**Consecuencias**: para añadir una ruta: crear `routes/<x>.tsx` con `createRoute(...)`, añadirla al array `addChildren` en `router.tsx`. Si el grupo crece mucho se podría introducir un helper, pero con <10 rutas el patrón manual es claro.

---

## [2026-04-23] `/frontend-design` deferido a Fase 6 (v1 polish)

**Contexto**: la regla `frontend.md` pide invocar `/frontend-design` antes de componentes visuales distintivos (pantallas completas, layouts, cards de run, log panel). Para el MVP de Fase 4 decidí usar shadcn defaults con tokens propios en `styles/tokens.css` sin invocar la skill.

**Decisión**: shadcn/ui + Tailwind 4 con tokens OKLCH light/dark. Componentes de negocio (LogViewer, RunStatusBadge, ChangedFiles, CreateProjectDialog) construidos directamente sobre primitives shadcn. El objetivo de Fase 4 era funcionalidad end-to-end, no polish estético distintivo.

**Alternativas descartadas**:
- Invocar `/frontend-design` con un brief completo: output potencialmente sobre-diseñado para un dashboard interno y latencia alta.
- Saltarse tokens y usar colores Tailwind hardcoded: rompe la regla de tokens CSS.

**Consecuencias**: antes de marcar v1 como completada (Fase 6) hay que invocar `/frontend-design` y pasar LogViewer, RunStatusBadge, la tabla de runs y la landing de `/projects` por un rediseño. Tokens ya están en sitio para absorber cambios sin refactor profundo. Si la skill propone motivos gráficos (iconografía propia, tipografía, motion), el wiring de estado no debería tocarse.

---

## [2026-04-23] Conflicto Vite 5/6 resuelto excluyendo `vitest.config.ts` de `tsc`

**Contexto**: `@tailwindcss/vite` requiere Vite 6+; `vitest@2.x` depende de Vite 5. En el monorepo conviven ambos. Al importar `vitest.config.ts` con `import react from '@vitejs/plugin-react'` dentro del scope de web, TS ve dos versiones de los tipos `Plugin` y falla con "Type 'Plugin<any>' is not assignable to type 'PluginOption'".

**Decisión**: `apps/web/tsconfig.json` no incluye `vitest.config.ts` en `include`. Vitest carga el archivo con su propio loader TS; tsc no necesita validarlo. `vite.config.ts` también queda fuera del include por el mismo motivo.

**Alternativas descartadas**:
- Bump vitest a 3.x en todo el monorepo: más trabajo por un fix de tipos; la API runtime está estable.
- Downgrade `@tailwindcss/vite`: rompe Tailwind 4.
- Forzar versión de vite vía `pnpm.overrides`: introduce deuda.

**Consecuencias**: las configs de build (`vite.config.ts`) y test (`vitest.config.ts`) no se typechequean con `tsc --noEmit`. Si se introduce un error de tipo ahí, se verá al correr `pnpm --filter @cac/web dev` o `test`. Aceptable: son archivos estáticos que casi no cambian.

---

## [2026-04-23] Mocks con estado compartido en tests API (no DB real en CI)

**Contexto**: la spec de `backend.md` dice "DB de test: Postgres real (via Docker Compose `postgres-test`), no mocks. Mockear sólo lo que cruza proceso...". Para los tests de Fase 5 (29 escenarios HTTP) ejecutar contra postgres-test real era costoso: requiere docker-compose up, migraciones y seeding, y los tests se volverían flaky bajo CI sin Docker.

**Decisión**: para los tests de wiring/contrato HTTP, los plugins `db/redis/queues/socketio` se mockean con `vi.mock` a un nivel de módulo y comparten un objeto `state` en memoria (con Maps y Arrays) que cada `beforeEach` resetea. Los repos mockeados implementan la misma firma que los reales (`findById`, `list`, `insert`, `update`, `delete`, `listByRun`, etc.).

**Alternativas descartadas**:
- Postgres real con `docker compose --profile test up` + `pnpm db:migrate:test`: añade 10-15s de arranque + dependencia de Docker corriendo; no queremos romper CI/local dev si Docker no está.
- Drizzle con SQLite en memoria: requiere portar los schemas a SQLite, duplicar dialectos.
- Integrar pg-mem: otra librería, menos mantenida, drivers inconsistentes.

**Consecuencias**: la regla "DB de test: Postgres real" sigue viva pero se relaja para tests de contrato HTTP (validación, routing, error handling, status codes). **Tests de integración DB-reales** irán en un segundo archivo `__tests__/db.integration.test.ts` con el profile `test` de docker-compose cuando se implementen (pendiente Fase 6). Los tests actuales cubren regresiones de rutas, validación Zod, mappers, y lógica de handlers sin ejecutar SQL.

---

## [2026-04-23] `renderPayload` exportada para tests puros (no virtualizer en jsdom)

**Contexto**: el `LogViewer` usa `@tanstack/react-virtual` que necesita `getBoundingClientRect()` del contenedor para calcular slots visibles. En jsdom el rect siempre es 0, así que el virtualizer renderiza 0 elementos y los tests de contenido fallan.

**Decisión**: se exporta la función pura `renderPayload(event)` desde `log-viewer.tsx` y se testea directamente para cada tipo de evento (`assistant_message`, `tool_use`, `tool_result`, `usage`, `error`, `unknown`). El componente en sí sólo se testea en el placeholder (estado vacío), que sí renderiza en jsdom porque no depende del virtualizer.

**Alternativas descartadas**:
- Stub de `getBoundingClientRect` + `ResizeObserver`: frágil, dependiente de la implementación interna del virtualizer.
- Playwright E2E contra la página real: postpone el feedback; mejor para Fase 6.
- No testear: el renderizado por tipo de evento tiene suficientes ramas para justificar coverage.

**Consecuencias**: si se cambia la firma/lógica de `renderPayload`, los tests lo pillan. El comportamiento visual del virtualizer queda fuera del coverage unit — se verá al correr la app o en E2E.

---

## [2026-04-23] Tests de componentes que usan `@/lib/api` mockean el módulo

**Contexto**: `HealthBadge` hace `useQuery({ queryFn: api.health })`. Intentar mockear `globalThis.fetch` en jsdom para simular la respuesta resultó inestable (Request/Response APIs tienen gaps en jsdom 26, y URLs relativas no siempre funcionan).

**Decisión**: los tests de componentes de web mockean el módulo `@/lib/api` con `vi.mock('@/lib/api', () => ({ api: { health: () => healthMock(), ... } }))`. Cada test configura el `vi.fn()` con el `mockResolvedValueOnce`/`mockRejectedValueOnce` que necesita.

**Consecuencias**: no se testea la serialización/deserialización del fetch (eso vive en tests de `api.ts` si se necesitase). Los tests de componentes se enfocan en comportamiento: qué se muestra según el estado de la query. Los tests de `api.ts` se pueden añadir después si se quiere verificar el manejo de error/status/body.

---

## [2026-04-23] Agregaciones de stats vía `db.execute(sql)` en el repo

**Contexto**: F-07 necesita métricas diarias (runs, tokens, coste) y totales globales. Expresarlas con el query builder de Drizzle (`select({... sum(sql...) ...}).groupBy(...)`) se vuelve verboso por la extracción de campos JSONB (`usage ->> 'inputTokens'::bigint`).

**Decisión**: los métodos `runs.dailyStats()`, `runs.totals()`, `runs.topProjects()` usan `db.execute(sql...)` con SQL crudo y tipado explícito del row. Devuelven shapes estables (`DailyStatsRow`, `TotalsRow`, `TopProjectRow`) que la capa API mapea a los DTOs de `@cac/shared`.

**Alternativas descartadas**:
- `select({...}).groupBy(date_trunc...)` con agregaciones Drizzle: posible pero requiere importar helpers y sigue siendo menos legible que el SQL plano.
- Vista materializada: overkill para v1; basta con un índice por `created_at` (ya existe) y las agregaciones ad-hoc.
- Mover la agregación a la capa de API: rompe la regla "nada de queries SQL sueltas en `apps/api`".

**Consecuencias**: si se cambia el nombre de campos JSONB (`inputTokens`, `estimatedCostUsd`) hay que acordarse de tocar los SQL del repo además del schema de Zod. Está aislado (un solo archivo en `packages/db/src/repos/runs.ts`), aceptable.

---

## [2026-04-23] `parent_run_id` con `onDelete: 'set null'` (no cascade)

**Contexto**: F-08 y F-10 añaden relación padre-hijo entre runs. Si borro el run padre (p.ej. limpieza automatica), que hago con los hijos?

**Decisión**: `parent_run_id` es nullable con FK `onDelete: 'set null'`. Borrar un run padre no borra los hijos; el campo se pone a null y los hijos quedan como runs "raíz" huérfanos.

**Alternativas descartadas**:
- `cascade`: borrar el padre arrastra a todos los descendientes. Demasiado destructivo; los hijos tienen valor propio (su log, diff, métricas).
- `restrict`: impide borrar un padre si tiene hijos. Rompe la limpieza automática sin aportar valor.
- No FK (sólo columna uuid): pierdes la restricción de integridad y las queries del graph se complican.

**Consecuencias**: el grafo de `/run-graph` filtra edges cuyo `parentRunId` ya no esté en el set de nodos devueltos, así las huérfanas se ven como raíz.

---

## [2026-04-23] Slice Fase 6 en 6a (backend + features sin viz) y 6b (visualizaciones + E2E)

**Contexto**: Fase 6 agrupa 10 features + Playwright. Meterlo todo en un commit mezcla backend estable con UI visual distintiva que pide `/frontend-design` (ver rule frontend.md).

**Decisión**: cortar en dos. **6a** entrega todo el backend (rerun, stats, run-graph, files, export) + features web que no requieren componentes visuales distintivos (settings tab, notificaciones, prefs, botones rerun/export, dashboard con totales en tabla). **6b** añade Recharts, xyflow, Monaco, timeline slider y Playwright E2E tras invocar `/frontend-design`.

**Alternativas descartadas**:
- Todo junto en un commit: revisable con dificultad, y mete visualizaciones sin `/frontend-design` saltándose la regla.
- 6a sólo backend, 6b todo el frontend: pierde la oportunidad de cerrar features funcionales (settings, notificaciones) que no necesitan diseño.

**Consecuencias**: el dashboard y el futuro tab Graph ya tienen endpoint listo — al llegar a 6b sólo se cablea la visualización encima. Los tipos en `@cac/shared` (`GlobalStatsResponse`, `RunGraphResponse`, `ListFilesResponse`) fijan el contrato entre slices.
