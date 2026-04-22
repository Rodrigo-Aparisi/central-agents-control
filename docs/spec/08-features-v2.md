# 08 — Features v2

v2 convierte CAC en una herramienta de equipo: servidor compartido en Docker, multi-usuario con RBAC mínimo.

**Prerequisito**: v1 estable y en uso. No empezar v2 hasta que v1 esté completado y probado.

---

## Cambios de infraestructura

### Docker Compose completo
```yaml
services:
  web:       # nginx sirviendo el build de apps/web
  api:       # apps/api compilado
  postgres:  # postgres:16
  redis:     # redis:7-alpine
```

- Variables de entorno en `.env` (gitignored). Template en `.env.example`.
- Health checks en todos los servicios.
- Volúmenes para postgres y redis (persistencia entre reinicios).
- `PROJECTS_ROOT` montado como volumen read-only en `api` (los proyectos viven fuera del contenedor).

### Reverse proxy
- Nginx como reverse proxy: `/` → web, `/api` → api, `/ws` → api Socket.IO.
- TLS opcional con certificado self-signed para HTTPS en intranet.

---

## F-V2-01: Autenticación

**Scope**: login con usuario/contraseña local. Sin OAuth en v2.

### DB
Nueva tabla `users`:
| Columna | Tipo |
|---|---|
| `id` | `uuid` PK |
| `email` | `text UNIQUE NOT NULL` |
| `password_hash` | `text NOT NULL` (bcrypt, cost 12) |
| `role` | `user_role NOT NULL` (enum: `admin`, `viewer`) |
| `created_at` | `timestamptz` |
| `last_login_at` | `timestamptz` |

### API
- `POST /v1/auth/login` → valida credenciales → responde `{ accessToken, refreshToken }`.
- `POST /v1/auth/refresh` → rota refresh token → nuevo access token.
- `POST /v1/auth/logout` → invalida refresh token.
- Access token: JWT HS256, expiración 15min, payload `{ sub: userId, role }`.
- Refresh token: opaque, almacenado en DB (tabla `refresh_tokens`), httpOnly cookie.

### Web
- Página `/login` (única ruta pública).
- TanStack Router: loader guard que redirige a `/login` si no hay token válido.
- Token en memoria (no localStorage). Refresh silencioso antes de expirar.

---

## F-V2-02: RBAC mínimo

| Recurso | Admin | Viewer |
|---|---|---|
| Ver proyectos y runs | ✓ | ✓ |
| Lanzar/cancelar runs | ✓ | ✗ |
| Crear/editar/borrar proyectos | ✓ | ✗ |
| Ver métricas globales | ✓ | ✓ |
| Gestionar usuarios | ✓ | ✗ |
| Exportar runs | ✓ | ✓ |

- Fastify plugin `auth` valida el JWT en cada request y adjunta `req.user`.
- Helper `requireRole(role)` como hook de Fastify para proteger rutas.

---

## F-V2-03: Gestión de usuarios (admin)

### API
- `GET /v1/admin/users` → lista de usuarios.
- `POST /v1/admin/users` → crea usuario.
- `PUT /v1/admin/users/:id` → actualiza rol.
- `DELETE /v1/admin/users/:id` → borra usuario.

### Web
- Página `/admin/users` (solo admin).
- Tabla con email, rol, último login, acciones.
- Formulario de creación con email + rol + contraseña temporal.

---

## F-V2-04: Audit log persistido en DB

En v1 el audit log es un archivo local. En v2 se persiste en DB para consultarlo desde la web.

### DB
Nueva tabla `audit_events`:
| Columna | Tipo |
|---|---|
| `id` | `uuid` PK |
| `user_id` | `uuid` FK → `users.id` |
| `tool_name` | `text` |
| `detail` | `text` (primeros 120 chars del comando/path) |
| `timestamp` | `timestamptz` |

### Web
- Página `/admin/audit` (solo admin): tabla cronológica de acciones con filtro por usuario/fecha.

---

## F-V2-05: Rate limiting y protección de endpoints

- `@fastify/rate-limit`: 60 req/min por IP para endpoints generales, 10 req/min para `/v1/auth/login`.
- `POST /v1/projects/:id/launch`: máx 5 runs simultáneos por usuario.
- Responde `429` con `{ error: { code: 'RATE_LIMITED', retryAfterMs } }`.

---

## F-V2-06: CORS y seguridad HTTP

- `@fastify/cors`: origin whitelist = `ALLOWED_ORIGINS` env var.
- `@fastify/helmet`: headers de seguridad (CSP, HSTS, X-Frame-Options).
- CSP permite `unsafe-eval` sólo para Monaco (documentar el why).

---

## Criterio de v2 completado

> Un equipo de hasta 5 personas puede usar CAC desde sus browsers contra un servidor compartido, con control de quién puede lanzar runs y trazabilidad completa de acciones via audit log.

---

## Decisiones pendientes para v2

- **¿SSO?**: SAML/OIDC para integrarse con el IdP corporativo. Evaluar cuando el equipo crezca.
- **¿Proyectos por usuario o compartidos?**: en el diseño actual todos los proyectos son globales y admin-gestionados. Puede necesitar cambio si hay proyectos privados.
- **¿Notificaciones push?**: email o webhook cuando un run falla. No en el scope inicial de v2.
