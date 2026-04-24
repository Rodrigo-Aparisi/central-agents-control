export const CLAUDE_INIT_PROMPT = `Inicializa este proyecto para Claude Code realizando las siguientes acciones:

1. Crea el archivo CLAUDE.md en la raíz del proyecto con:
   - Descripción breve del proyecto y su propósito
   - Stack tecnológico principal (lenguajes, frameworks, herramientas)
   - Comandos de desarrollo esenciales (build, test, lint, format, dev server, etc.)
   - Estructura de directorios y propósito de cada parte relevante
   - Convenciones de código específicas del proyecto

2. Examina qué tipos de tareas son frecuentes en este proyecto. Si hay áreas de trabajo bien diferenciadas, crea agentes especializados en .claude/agents/ (un archivo .md por agente), con frontmatter YAML (name, description) y las instrucciones específicas del agente.

Sé conciso en CLAUDE.md (máximo 200 líneas). Prioriza información que ayude a un asistente de IA a ser más efectivo trabajando en este proyecto específico.`;
