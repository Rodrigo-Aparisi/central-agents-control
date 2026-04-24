import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { redirect } from '@tanstack/react-router';

/**
 * Checks auth state. If the user is not authenticated, tries a silent token
 * refresh via the httpOnly cookie. If that also fails, throws a redirect to
 * /login. Intended for use in TanStack Router `beforeLoad` callbacks.
 *
 * @param currentPath - The current pathname, used to build the redirect query param.
 */
export async function guardAuth(currentPath: string): Promise<void> {
  const store = useAuthStore.getState();

  if (store.isAuthenticated()) return;

  try {
    const tokens = await api.auth.refresh();
    store.setTokens(tokens.accessToken, tokens.userId, tokens.role, tokens.expiresIn);
  } catch {
    throw redirect({
      to: '/login',
      search: { redirect: currentPath },
    });
  }
}

/**
 * Checks that the current user has the admin role. Redirects to /projects if
 * the user is authenticated but not an admin.
 */
export function guardAdmin(): void {
  const store = useAuthStore.getState();
  if (!store.isAdmin()) {
    throw redirect({ to: '/projects' });
  }
}
