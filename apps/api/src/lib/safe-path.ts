import { realpathSync } from 'node:fs';
import path from 'node:path';
import { AppError } from '@cac/shared';

/**
 * Joins `relative` to `rootPath` and returns the resolved realpath, guaranteeing
 * it still lives inside the root. Symlink-safe. Uses POSIX/native path per platform.
 */
export function resolveWithinRoot(rootPath: string, relative: string): string {
  const rel = (relative ?? '').replace(/^[\\/]+/, '');
  if (rel.includes('\x00')) {
    throw AppError.validation('path contains null byte');
  }
  const candidate = path.resolve(rootPath, rel);

  let realCandidate: string;
  let realRoot: string;
  try {
    realRoot = realpathSync(rootPath);
  } catch {
    throw AppError.notFound('project root not available');
  }
  try {
    realCandidate = realpathSync(candidate);
  } catch {
    throw AppError.notFound(`path not found: ${rel || '/'}`);
  }

  const sep = process.platform === 'win32' ? path.win32.sep : path.sep;
  const normRoot = normalize(realRoot);
  const normCandidate = normalize(realCandidate);
  const rootWithSep = normRoot.endsWith(sep) ? normRoot : normRoot + sep;

  if (normCandidate !== normRoot && !normCandidate.startsWith(rootWithSep)) {
    throw AppError.validation('path escapes project root');
  }

  return realCandidate;
}

function normalize(p: string): string {
  return process.platform === 'win32' ? path.win32.normalize(p).toLowerCase() : path.normalize(p);
}
