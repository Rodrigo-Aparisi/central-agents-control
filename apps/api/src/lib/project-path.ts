import { realpathSync } from 'node:fs';
import path from 'node:path';
import { AppError } from '@cac/shared';

/**
 * Verifies that `candidate` is an existing directory contained within
 * `projectsRoot` (symlink-safe). Returns the realpath on success.
 */
export function ensureWithinProjectsRoot(candidate: string, projectsRoot: string): string {
  if (!path.isAbsolute(candidate)) {
    throw AppError.validation('rootPath must be absolute', { rootPath: candidate });
  }

  let real: string;
  try {
    real = realpathSync(candidate);
  } catch {
    throw AppError.validation('rootPath does not exist on disk', { rootPath: candidate });
  }

  const normReal = normalize(real);
  const normBase = normalize(projectsRoot);
  const sep = process.platform === 'win32' ? path.win32.sep : path.sep;
  const baseWithSep = normBase.endsWith(sep) ? normBase : normBase + sep;

  if (normReal !== normBase && !normReal.startsWith(baseWithSep)) {
    throw AppError.validation('rootPath must be within PROJECTS_ROOT', {
      rootPath: real,
      projectsRoot,
    });
  }

  return real;
}

function normalize(p: string): string {
  return process.platform === 'win32' ? path.win32.normalize(p).toLowerCase() : path.normalize(p);
}
