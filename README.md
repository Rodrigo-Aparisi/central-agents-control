# Central Agents Control

Dashboard web para orquestar múltiples proyectos desarrollados con Claude Code. Wrapper del CLI `claude` + panel de configuración, lanzamiento y auditoría. Memoria nativa de Claude Code complementada con histórico estructurado en Postgres.

**Estado**: v1 + v2 completos. v1 = localhost, usuario único. v2 = servidor Docker, multi-usuario con JWT + RBAC + audit log.

---

## Qué hace

Flujo típico: abres el browser, eliges un proyecto local, escribes un prompt, el wrapper lanza `claude -p --output-format stream-json` con `cwd` fijo al proyecto, el log aparece en vivo (Socket.IO) y al terminar ves el diff de archivos modificados. Todo queda persistido — runs, eventos, artefactos — con métricas agregadas por día.

En modo multiusuario (v2): cada acción pasa por un JWT firmado, los admins gestionan usuarios desde `/admin/users`, y cada operación queda trazada en el audit log accesible en `/admin/audit`.

## Stack

| Capa        | Tecnologías |
|-------------|-------------|
| Web         | React 19, Vite 6, Tailwind 4, shadcn/ui, TanStack Router, TanStack Query, Zustand, Recharts, @xyflow/react, Monaco, react-diff-viewer-continued, socket.io-client |
| API         | Node 22, Fastify 5, fastify-type-provider-zod, Socket.IO, BullMQ, ioredis, Pino, @fastify/jwt, @fastify/cookie, @fastify/cors, @fastify/helmet, @fastify/rate-limit, bcrypt |
| Shared      | Zod schemas (`@cac/shared`) |
| DB          | Drizzle ORM, Postgres 16 (`@cac/db`) |
| Runner      | Wrapper de `claude -p --output-format stream-json` (`@cac/claude-runner`) |
| Tooling     | pnpm workspaces, Biome, Vitest, Playwright |
| Infra prod  | Docker Compose: web + api + nginx + postgres 16 + redis 7 |

Tipografía: IBM Plex Sans + IBM Plex Mono self-hosted. Paleta OKLCH con 5 series de chart anclados al primary.

## Estructura

```
apps/
  web/                   # React 19 + Vite (SPA)
  api/                   # Fastify + Socket.IO + BullMQ
packages/
  shared/                # Zod schemas (web ↔ api)
  db/                    # Drizzle schema + migraciones + repos
  claude-runner/         # Spawning y parseo del CLI claude
infra/
  nginx/                 # nginx.conf (TLS) + nginx-nossl.conf
  certs/                 # certificados self-signed (gitignored)
  generate-certs.sh      # genera self-signed para intranet
docs/
  spec/                  # Spec fragmentada
  memory/                # decisions.md, todos.md, bugs.md
.claude/
  rules/                 # Reglas scoped por carpeta
  agents/                # Subagentes especializados
  settings.json          # Deny list global + hooks
```

---

## Modo desarrollo local (v1, sin auth)

El modo más rápido — un solo usuario, sin JWT, sin usuarios en DB.

### Requisitos

- **Node 22+**
- **pnpm 9+** (`npm i -g pnpm@9`)
- **Docker Desktop**
- **Claude Code CLI** en `PATH` como `claude`

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Crear `.env` en la raíz

```env
# Base de datos
DATABASE_URL=postgresql://cac:cac@127.0.0.1:5432/cac
REDIS_URL=redis://localhost:6379

# Runner — ajusta a tu ruta real
PROJECTS_ROOT=C:/Users/TuNombre/proyectos

# Sin auth (modo v1)
AUTH_ENABLED=false

# Opcional — si no está en el entorno global del sistema
# ANTHROPIC_API_KEY=sk-ant-...
```

> **`PROJECTS_ROOT`** debe existir. Todos los proyectos registrados tienen que vivir dentro de él — el runner valida con `realpath` + prefix check.

### 3. Levantar postgres y redis

```bash
docker compose up -d postgres redis
docker compose ps   # espera a que ambos estén "healthy"
```

### 4. Aplicar migraciones

```bash
pnpm db:migrate
```

Crea las tablas `projects`, `runs`, `run_events`, `run_artifacts`, `users`, `refresh_tokens`, `audit_events`, enums e índices. **Imprescindible antes del primer arranque.**

### 5. Arrancar

```bash
pnpm dev
```

- Web: http://localhost:5173
- API: http://127.0.0.1:8787 (health: `GET /v1/health`)

Vite proxy reenvía `/v1/*` y `/socket.io/*` del puerto 5173 al 8787.

> Si ves `ECONNREFUSED 127.0.0.1:8787` en la consola de Vite, el API no arrancó. Lanza `pnpm --filter @cac/api dev` en su propio terminal para ver el error real.

---

## Modo producción Docker (v2, multiusuario)

Para servir a un equipo desde un servidor compartido en la intranet.

### Requisitos servidor

- Docker 24+ con compose plugin
- Acceso a internet solo para descargar imágenes al primer `up`

### 1. Clonar y preparar variables

Copia el archivo de ejemplo y rellena los valores obligatorios:

```bash
cp .env.example .env   # si el sistema lo permite; si no, créalo a mano
```

Variables mínimas en `.env`:

```env
POSTGRES_PASSWORD=contraseña_fuerte_aqui
JWT_SECRET=genera_con_node_e_crypto_randomBytes_48_toString_hex
PROJECTS_ROOT_HOST=/ruta/absoluta/host/a/proyectos
```

Genera el `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2. (Opcional) TLS self-signed para HTTPS

```bash
bash infra/generate-certs.sh cac.internal   # o la IP/hostname de tu servidor
```

Esto crea `infra/certs/server.crt` + `server.key`. Añade `server.crt` al almacén de confianza de los navegadores de tu equipo.

Para activar TLS, añade al `.env`:

```env
NGINX_CONF=nginx.conf
```

Sin TLS (HTTP puro en intranet):

```env
NGINX_CONF=nginx-nossl.conf   # valor por defecto
```

### 3. Construir y levantar

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Levanta: postgres, redis, api (tsx ESM), web (nginx static), nginx (reverse proxy).

Espera a que api esté healthy:

```bash
docker compose -f docker-compose.prod.yml ps
curl http://localhost/api/health   # debe devolver {"status":"ok",...}
```

### 4. Aplicar migraciones

```bash
DATABASE_URL=postgresql://cac:TU_PASS@localhost:5432/cac pnpm db:migrate
```

### 5. Crear el primer usuario admin

```bash
ADMIN_EMAIL=tu@email.com ADMIN_PASSWORD=contraseña_segura pnpm db:create-admin
```

O directamente contra la DB del contenedor:

```bash
docker compose -f docker-compose.prod.yml exec api \
  node --import tsx/esm packages/db/scripts/create-admin.ts
```

(con las vars `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` en el entorno)

### 6. Acceder

- HTTP: `http://IP_SERVIDOR` (puerto 80)
- HTTPS: `https://cac.internal` (si configuraste TLS)

Inicia sesión con el email/contraseña del paso 5. El primer admin puede crear más usuarios desde `/admin/users`.

---

## Comandos habituales

```bash
# Desarrollo
pnpm dev                      # web + api en paralelo
pnpm --filter @cac/web dev    # sólo web
pnpm --filter @cac/api dev    # sólo api (logs directos, útil para depurar)

# Calidad
pnpm lint                     # biome check
pnpm lint:fix                 # biome check --write
pnpm typecheck                # tsc --noEmit en todos los paquetes
pnpm test                     # vitest en todos los paquetes (122 tests)

# DB
pnpm db:generate              # drizzle-kit generate (tras cambiar schema)
pnpm db:migrate               # aplica migraciones pendientes
pnpm db:studio                # drizzle-studio en la DB local
pnpm db:create-admin          # crea el primer admin (necesita ADMIN_EMAIL + ADMIN_PASSWORD)

# E2E
pnpm --filter @cac/web e2e    # Playwright golden path (API mockada)
```

---

## Tests

122 tests, todos con Vitest:

| Paquete | Tests | Cobertura |
|---------|-------|-----------|
| `@cac/api` | 55 | rutas HTTP via `fastify.inject()`, auth (login/refresh/logout/RBAC), config, mocks en memoria |
| `@cac/claude-runner` | 40 | parser stream-json, redact, cwd, sanitize, fake-claude binario, cancelación, timeout |
| `@cac/web` | 17 | RunStatusBadge, humanizeError, runnerPanel store, HealthBadge, renderPayload |
| `@cac/shared` | 7 | schemas Zod, prompt wrapping |
| `@cac/db` | 3 | UUID v7, factories |

E2E Playwright: 1 golden path (projects list → project detail → run detail) contra API mockada vía `page.route`.

---

## Seguridad

Resumen — detalle en [`docs/spec/03-security.md`](docs/spec/03-security.md).

- **Auth (v2)**: JWT HS256, 15 min. Refresh token opaco (SHA-256 en DB), httpOnly cookie, 30 días. `AUTH_ENABLED=false` deshabilita la validación en dev local.
- **RBAC**: admin (lectura + escritura + gestión de usuarios) / viewer (sólo lectura). Middleware `requireRole` en todas las rutas de escritura.
- **Rate limiting**: 60 req/min por IP; 10 req/min en `/v1/auth/login`.
- **Headers HTTP**: `@fastify/helmet` con CSP estricta; `unsafe-eval` sólo para Monaco (worker de syntax highlighting).
- **Prompt injection**: todo input externo se envuelve con `wrapUntrustedInput` antes de llegar al CLI.
- **Path traversal**: el runner valida `projectRoot` con `realpathSync` + prefix check contra `PROJECTS_ROOT`.
- **Secret leakage**: el runner filtra `sk-ant-…`, `ghp_…`, `gho_…`, URLs con credenciales antes de persistir o emitir eventos.
- **CLI flags**: whitelist cerrada en `@cac/shared`; cualquier flag fuera de ella → 400.
- **Env del proceso hijo**: arranca vacío, añade sólo `PATH`/`HOME` + `ANTHROPIC_API_KEY` (opt-in). Nunca `{...process.env}`.
- **Deny list del harness**: `.claude/settings.json` bloquea `rm -rf`, `sudo`, `curl`, `git push --force`, reads de `.env*`, writes a `/etc/**`.

---

## Arquitectura

- Diagrama y flujos: [`docs/spec/01-architecture.md`](docs/spec/01-architecture.md)
- Schema DB: [`docs/spec/02-db-schema.md`](docs/spec/02-db-schema.md)
- Orquestación (BullMQ + runner + Socket.IO): [`docs/spec/04-orchestration.md`](docs/spec/04-orchestration.md)
- Features v2: [`docs/spec/08-features-v2.md`](docs/spec/08-features-v2.md)
- Decisiones: [`docs/memory/decisions.md`](docs/memory/decisions.md)

## Contribuir

Convenciones en [`CLAUDE.md`](CLAUDE.md) y reglas scoped en [`.claude/rules/`](.claude/rules/). Resumen:

- Imports absolutos por paquete (`@cac/shared`, `@cac/db`, `@cac/claude-runner`) — nunca `../../packages/...`.
- Contratos web ↔ api pasan por schemas Zod en `@cac/shared`.
- Errores del API en formato `{ error: { code, message, details? } }`.
- TypeScript `strict: true` + `noUncheckedIndexedAccess`. Biome para lint + format.
- Antes de tocar componentes visuales nuevos, invocar `/frontend-design`.
