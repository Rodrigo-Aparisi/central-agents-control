import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SETTINGS_FILENAME = path.join('.claude', 'settings.json');

const REQUIRED_ALLOW = [
  'Read(**)',
  'Write(**)',
  'Edit(**)',
  'Bash(*)',
  'Glob(**)',
  'Grep(**)',
  'Task(**)',
  // Explicit dotfile entries: many glob implementations skip hidden dirs by default,
  // so Write(**) alone may not cover .claude/agents/** in Claude Code's matcher.
  'Write(.claude/**)',
  'Edit(.claude/**)',
];

const DEFAULT_DENY = [
  'Read(.env*)',
  'Bash(rm -rf*)',
  'Bash(sudo*)',
  'Bash(curl*)',
  'Bash(git push --force*)',
];

/**
 * Ensures `.claude/settings.json` inside `projectRoot` has the minimum required
 * allow entries for headless runs. Creates the file if it doesn't exist; if it
 * does exist, merges any missing allow entries without touching existing rules.
 */
export async function ensureProjectClaudeSettings(projectRoot: string): Promise<void> {
  const settingsPath = path.join(projectRoot, SETTINGS_FILENAME);

  let existing: Record<string, unknown> | null = null;
  try {
    const raw = await readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null) {
      existing = parsed as Record<string, unknown>;
    }
  } catch {
    // File missing or unparseable — will create fresh
  }

  if (existing === null) {
    await mkdir(path.join(projectRoot, '.claude'), { recursive: true });
    await writeFile(
      settingsPath,
      `${JSON.stringify({ permissions: { allow: REQUIRED_ALLOW, deny: DEFAULT_DENY } }, null, 2)}\n`,
      'utf8',
    );
    return;
  }

  // Merge: add any missing required allow entries, leave everything else untouched
  const perms = (
    typeof existing.permissions === 'object' && existing.permissions !== null
      ? existing.permissions
      : {}
  ) as Record<string, unknown>;

  const currentAllow: string[] = Array.isArray(perms.allow)
    ? (perms.allow as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];

  const missing = REQUIRED_ALLOW.filter((entry) => !currentAllow.includes(entry));
  if (missing.length === 0) return; // nothing to add

  const merged = {
    ...existing,
    permissions: {
      ...perms,
      allow: [...currentAllow, ...missing],
    },
  };
  await writeFile(settingsPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
}
