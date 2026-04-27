export const CLAUDE_INIT_PROMPT = `Inicializa o actualiza este proyecto para Claude Code. Sigue estos pasos en orden.

## Paso 1 — Detectar modo

Comprueba si ya existe un CLAUDE.md:
- Si NO existe → modo CREACIÓN: genera uno desde cero.
- Si SÍ existe → modo ACTUALIZACIÓN: lee su contenido completo, identifica secciones obsoletas o ausentes, y propone un diff antes de modificar nada.

## Paso 2 — Explorar el proyecto (mayor señal primero)

Lee en este orden:
1. \`package.json\` / \`pnpm-workspace.yaml\` / \`Cargo.toml\` / equivalente del stack — para entender estructura real y comandos.
2. Todos los archivos en \`.claude/rules/\` — para NO duplicar lo que ya está cubierto ahí.
3. Archivos en \`docs/spec/\` o \`docs/\` — para referenciar en lugar de resumir inline.
4. \`docker-compose.yml\`, \`.env.example\`, archivos de configuración raíz — para entender requisitos de entorno.
5. Entry points del código (\`src/index.ts\`, \`apps/*/src/main.ts\`, \`main.py\`, etc.) — para entender arquitectura real.
6. \`.claude/settings.json\` — para detectar deny lists y restricciones de seguridad.

## Paso 3 — Escribir CLAUDE.md

Objetivo: **bajo 200 líneas**, sólo lo que no es derivable leyendo el código.

### Secciones obligatorias
- **Una línea de qué es el proyecto** y para quién.
- **Stack** — tabla compacta (tecnología por capa). Sólo lo que realmente usa el proyecto.
- **Comandos** — únicamente los que existan en los scripts del proyecto. Verificar antes de escribir. Formato: \`pnpm dev  # arranca web + api\`.
- **Estructura** — árbol de directorios si es no obvia (monorepos, workspaces).

### Secciones de alto valor (incluir sólo si hay contenido real)
- **Trampas / Qué NO hacer** — restricciones explícitas del proyecto: stack cerrado, operaciones prohibidas, reglas de seguridad. Extraer de deny lists, settings.json y comentarios WARNING/HACK en el código.
- **Convenciones no obvias** — reglas que quemarían a un dev nuevo y no están en ningún README: dirección de dependencias entre capas, patrones obligatorios, orden de arranque de servicios.
- **Cómo trabajar aquí** — el flujo habitual del 80% de los PRs. Si hay pre-requisitos de entorno (Docker, migraciones, etc.), indicar el orden.
- **Referencias** — links a \`docs/spec/\` o \`.claude/rules/\` en lugar de duplicar su contenido.

### Qué NO incluir
- Lo que ya está en \`.claude/rules/<dominio>.md\` → sólo un link.
- Prácticas genéricas ("usa TypeScript strict", "escribe tests") — se sobreentienden.
- Comandos no verificados o que no existan en el proyecto.
- Explicaciones de lo que el código ya muestra por sí solo.

## Paso 4 — Crear agentes especializados

Examina el proyecto y decide si hay dominios de trabajo bien diferenciados (backend, frontend, DB, infra, etc.). Para cada dominio con suficiente complejidad, crea \`.claude/agents/<nombre>.md\` con:
\`\`\`
---
name: <nombre>
description: <cuándo debe usarse este agente — frases concretas que lo activen>
---
# <Nombre del agente>
<Instrucciones específicas del dominio: convenciones, herramientas permitidas, patrones requeridos>
\`\`\`

No crear agentes genéricos o redundantes. Un agente útil tiene instrucciones que difieren materialmente de las instrucciones base.`;

