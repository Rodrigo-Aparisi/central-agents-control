# 00 — Overview

## Qué es CAC

Central Agents Control (CAC) es un dashboard web local para orquestar múltiples proyectos desarrollados con Claude Code. Actúa como wrapper del CLI `claude`, añadiendo:

- Panel de configuración y lanzamiento de runs.
- Log en vivo del stream de salida del CLI.
- Histórico estructurado de runs, eventos y artefactos en Postgres.
- Diff viewer de los cambios que el agente aplicó al código.
- Visualización de grafos de dependencias entre proyectos/runs.
- Métricas de uso (tokens, coste, duración).

Es una herramienta personal en v1. En v2 se ampliará al departamento.

## Principios de diseño

1. **Localhost first**: v1 nunca expone nada fuera de `127.0.0.1`. No hay auth en v1, pero el código se escribe para que añadirla en v2 sea quirúrgico.
2. **Transparencia total**: todo lo que hace el agente es visible — logs, diffs, tool calls, usage. Sin cajas negras.
3. **Seguridad por defecto**: deny list en el harness, saneado de input, redacción de secretos antes de persistir. Ver `03-security.md`.
4. **Stack cerrado**: las piezas tecnológicas están fijadas. No se añaden ni sustituyen sin revisión explícita.
5. **Spec antes que código**: los cambios funcionales comienzan en `docs/spec/`, no en el editor.

## Versiones

### v1 — Localhost, usuario único
Scope: lo que está en `06-features-mvp.md` + `07-features-v1.md`.
- Corre en `localhost:3000` (web) / `localhost:3001` (api).
- Sin auth. Sin multi-tenant. Sin Docker obligatorio (postgres/redis vía Docker Compose para dev).
- Objetivo: que una persona pueda orquestar todos sus proyectos Claude Code desde un panel.

### v2 — Servidor Docker, multi-usuario
Scope: lo que está en `08-features-v2.md`.
- Docker Compose completo: web + api + postgres + redis.
- Auth JWT/session + RBAC mínimo (admin / viewer).
- Multi-proyecto con aislamiento por usuario.
- No empieza hasta que v1 esté estable.

## No-goals (v1 y v2)

- No es un IDE. No reemplaza VS Code ni Claude Code CLI directo.
- No gestiona la configuración de Claude Code de los proyectos objetivo.
- No ejecuta código arbitrario del usuario. Sólo lanza el CLI `claude` con parámetros controlados.
- No tiene mobile ni PWA.
- No tiene internacionalización activa en v1 (los strings se escriben i18n-ready pero sólo ES).

## Relación con documentos hermanos

| Documento | Contenido |
|---|---|
| `01-architecture.md` | Diagrama de componentes, flujo de datos, decisiones de diseño |
| `02-db-schema.md` | Tablas, columnas, índices, relaciones |
| `03-security.md` | Threat model, controles, deny list |
| `04-orchestration.md` | Runner, BullMQ, ciclo de vida de un run |
| `05-observability.md` | Logging, métricas, trazas, audit |
| `06-features-mvp.md` | Features del MVP (lo mínimo que hace CAC útil) |
| `07-features-v1.md` | Features completos de v1 |
| `08-features-v2.md` | Features de v2 (multi-usuario, Docker) |
