const EXT_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'plaintext',
  css: 'css',
  scss: 'scss',
  html: 'html',
  htm: 'html',
  svg: 'html',
  xml: 'xml',
  sql: 'sql',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  env: 'plaintext',
  dockerfile: 'dockerfile',
};

export function detectLanguage(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path;
  const lower = name.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return 'plaintext';
  const ext = lower.slice(dot + 1);
  return EXT_MAP[ext] ?? 'plaintext';
}
