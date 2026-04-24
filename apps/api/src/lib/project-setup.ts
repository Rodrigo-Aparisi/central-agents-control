import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SETTINGS_FILENAME = path.join('.claude', 'settings.json');

const DEFAULT_SETTINGS = {
  permissions: {
    allow: ['Read(**)', 'Write(**)', 'Edit(**)', 'Bash(*)', 'Glob(**)', 'Grep(**)', 'Task(**)'],
    deny: [
      'Read(.env*)',
      'Bash(rm -rf*)',
      'Bash(sudo*)',
      'Bash(curl*)',
      'Bash(git push --force*)',
    ],
  },
};

/**
 * Creates `.claude/settings.json` inside `projectRoot` if one does not exist.
 * Skips silently if the file is already present — never overwrites user config.
 */
export async function ensureProjectClaudeSettings(projectRoot: string): Promise<void> {
  const settingsPath = path.join(projectRoot, SETTINGS_FILENAME);

  try {
    await readFile(settingsPath);
    return; // file already exists
  } catch {
    // doesn't exist — create it
  }

  await mkdir(path.join(projectRoot, '.claude'), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2) + '\n', 'utf8');
}
