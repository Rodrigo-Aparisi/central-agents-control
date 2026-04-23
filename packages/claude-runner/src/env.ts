const ALWAYS_PROPAGATE = new Set<string>([
  'PATH',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'SystemRoot',
  'TEMP',
  'TMP',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
]);

const OPT_IN_SECRETS = new Set<string>(['ANTHROPIC_API_KEY']);

export interface BuildEnvOptions {
  parent?: NodeJS.ProcessEnv;
  propagateSecrets?: boolean;
  extra?: Record<string, string>;
}

export function buildSanitizedEnv(opts: BuildEnvOptions = {}): NodeJS.ProcessEnv {
  const parent = opts.parent ?? process.env;
  const env: NodeJS.ProcessEnv = {};

  for (const key of ALWAYS_PROPAGATE) {
    const v = parent[key];
    if (typeof v === 'string' && v.length > 0) env[key] = v;
  }

  if (opts.propagateSecrets !== false) {
    for (const key of OPT_IN_SECRETS) {
      const v = parent[key];
      if (typeof v === 'string' && v.length > 0) env[key] = v;
    }
  }

  if (opts.extra) {
    for (const [k, v] of Object.entries(opts.extra)) {
      env[k] = v;
    }
  }

  return env;
}
