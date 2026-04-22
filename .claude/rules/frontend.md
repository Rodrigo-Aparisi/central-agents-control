---
name: frontend-rules
description: Reglas obligatorias para la web CAC (React 19 + Vite + shadcn/ui + TanStack)
globs:
  - apps/web/**
---

# Frontend (apps/web)

Reglas que aplican al código de la web. Detalle de features en `docs/spec/06-features-mvp.md`+.

## Skill de referencia obligatoria

Invocar `/frontend-design` **antes de crear o modificar componentes visuales nuevos**: pantallas completas, layouts principales, primitivos UI distintivos (cards de run, nodos de grafo, paneles de log). Establece la dirección estética antes de escribir código.

**No invocar** para cambios triviales: wiring de estado, refactors internos, ajustes puntuales de spacing, correcciones de bug visual menor.

## React 19

- Functional components + hooks. Nunca clases.
- Usar `use()` para leer promesas/contextos cuando aplique.
- Server Actions **no** (no hay SSR; esto es SPA contra API Fastify). Mutaciones via TanStack Query.
- Suspense + Error Boundaries en cada ruta principal.
- Evitar `useEffect` para derivar estado; preferir selectores y valores calculados. `useEffect` sólo para side-effects reales (subscripciones, timers, IO).

## shadcn/ui + Tailwind 4

- Todos los componentes base (Button, Input, Dialog, DropdownMenu, Sheet, Tabs, Card, Table, Tooltip, Toast, Form) vienen de shadcn. No reimplementar.
- Componentes de negocio se componen sobre shadcn y viven en `apps/web/src/components/<dominio>/`.
- Tailwind 4: tokens en `apps/web/src/styles/tokens.css` (CSS custom properties). No valores hardcoded (`#ffffff`, `16px`) en clases de producción salvo excepciones documentadas.
- Dark mode: clase `dark` en `<html>`, toggle persistido en `localStorage`.
- Accesibilidad: todo interactivo debe ser focusable y tener label accesible. Usar `aria-*` correctamente. Componentes shadcn traen Radix primitives — respetar sus convenciones.

## TanStack Router

- Rutas code-based en `apps/web/src/routes/`. Un archivo por ruta.
- Loaders para precargar datos críticos (TanStack Query `ensureQueryData`).
- Search params tipados con Zod (`validateSearch`).
- Navegación entre apps/proyectos siempre via `Link` o `router.navigate`; nada de `window.location`.

## TanStack Query

- Un `queryClient` central en `apps/web/src/lib/query.ts` con defaults: `staleTime: 30s`, `refetchOnWindowFocus: true` sólo en listas, `false` en detalles.
- Query keys en `apps/web/src/lib/queryKeys.ts` (array const). Jerarquía: `['projects']`, `['projects', id]`, `['projects', id, 'runs']`.
- Mutaciones: siempre `onSuccess` invalida la key correcta; usar `setQueryData` para actualizar detalle si la respuesta lo trae.
- Prefetch en loaders, no en `useEffect`.

## Zustand

- Un store por dominio transversal de UI: `ui` (tema, layout), `filters` (filtros compartidos), `runnerPanel` (panel de run activo).
- **No** usar Zustand para datos de servidor; eso es TanStack Query.
- Slices con `createSlice` pattern (un archivo por slice, combinados en `useStore`).
- Selectores siempre con shallow compare o atómicos (`useStore(s => s.theme)`).

## Estado del runner en vivo

- Socket.IO client se conecta a `/runs`, se une al room del `runId` activo.
- Eventos llegan al `runnerPanel` store y se re-proyectan a componentes via selectores.
- Para logs largos: ventana virtualizada (react-virtual o equivalente ligero).

## Monaco + Diff

- Monaco se carga lazy (`React.lazy` + Suspense). Peso crítico.
- `react-diff-viewer-continued` para diffs de archivos. Side-by-side por defecto, switch a unified por usuario.
- Ambos respetan el tema (light/dark).

## @xyflow/react

- Para visualizar grafos de dependencias entre runs / proyectos.
- Nodos custom en `apps/web/src/components/flow/`.
- Layout automático con dagre o elk (lo que tengamos ya integrado; documentar la elección).

## Recharts

- Para gráficos de observabilidad (duración de runs, tokens, coste).
- Colores del tema (tokens CSS), nunca hardcoded.
- Tooltips y legendas siempre traducibles (i18n-ready aunque v1 sea solo ES).

## Errores y estados

- Cada query/mutation maneja `isPending`, `isError`, `isSuccess`. No dejar UI "en blanco" en pending.
- Errores del API vienen como `{ error: { code, message, details } }`. Mapear `code` a mensajes traducidos en `apps/web/src/lib/errors.ts`.
- Toasts (shadcn `sonner`) para feedback de mutaciones. Nunca `alert()`.

## Tests

- Vitest + Testing Library para componentes.
- Playwright (en v1 tardío) para E2E de golden paths.
- Testear comportamiento, no implementación. Nada de snapshots gigantes.
