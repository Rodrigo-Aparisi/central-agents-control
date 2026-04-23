import { realpathSync } from 'node:fs';
import path from 'node:path';
import { RunnerError } from './errors';

export interface ValidateCwdOptions {
  projectRoot: string;
  projectsRoot: string;
}

function ensureAbsolute(p: string, label: string): string {
  if (!path.isAbsolute(p)) {
    throw new RunnerError('INVALID_CWD', `${label} must be absolute: ${p}`);
  }
  return p;
}

function resolveReal(p: string, label: string): string {
  try {
    return realpathSync(p);
  } catch (err) {
    throw new RunnerError('INVALID_CWD', `${label} does not exist: ${p}`, { cause: String(err) });
  }
}

function normalize(p: string): string {
  return process.platform === 'win32' ? path.win32.normalize(p).toLowerCase() : path.normalize(p);
}

export function validateProjectRoot({ projectRoot, projectsRoot }: ValidateCwdOptions): string {
  const absRoot = ensureAbsolute(projectRoot, 'projectRoot');
  const absBase = ensureAbsolute(projectsRoot, 'projectsRoot');

  const realRoot = resolveReal(absRoot, 'projectRoot');
  const realBase = resolveReal(absBase, 'projectsRoot');

  const sep = process.platform === 'win32' ? path.win32.sep : path.sep;
  const normRoot = normalize(realRoot);
  const normBase = normalize(realBase);

  const baseWithSep = normBase.endsWith(sep) ? normBase : normBase + sep;
  if (normRoot !== normBase && !normRoot.startsWith(baseWithSep)) {
    throw new RunnerError(
      'INVALID_CWD',
      `projectRoot (${realRoot}) is not within projectsRoot (${realBase})`,
    );
  }

  return realRoot;
}
