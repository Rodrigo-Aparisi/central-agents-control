export interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement: string;
}

export const REDACTION_RULES: readonly RedactionRule[] = [
  {
    name: 'anthropic_api_key',
    pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g,
    replacement: '[ANTHROPIC_KEY_REDACTED]',
  },
  {
    name: 'github_pat',
    pattern: /ghp_[A-Za-z0-9]{36}/g,
    replacement: '[GITHUB_PAT_REDACTED]',
  },
  {
    name: 'github_oauth',
    pattern: /gho_[A-Za-z0-9]{36}/g,
    replacement: '[GITHUB_OAUTH_REDACTED]',
  },
  {
    name: 'anthropic_api_key_env',
    pattern: /ANTHROPIC_API_KEY=\S+/g,
    replacement: 'ANTHROPIC_API_KEY=[REDACTED]',
  },
  {
    name: 'basic_auth_in_url',
    pattern: /(https?:\/\/)[^\s/@:]+:[^\s/@]+@/g,
    replacement: '$1[CREDENTIALS_REDACTED]@',
  },
];

export function redactString(input: string): string {
  let out = input;
  for (const rule of REDACTION_RULES) {
    out = out.replace(rule.pattern, rule.replacement);
  }
  return out;
}

export function redactUnknown(value: unknown, depth = 0): unknown {
  if (depth > 10) return value;
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((v) => redactUnknown(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactUnknown(v, depth + 1);
    }
    return out;
  }
  return value;
}
