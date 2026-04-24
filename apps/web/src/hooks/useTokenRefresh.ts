import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useEffect } from 'react';

/**
 * Silently refreshes the access token before it expires.
 * Should be called once inside the Layout component.
 */
export function useTokenRefresh(): void {
  useEffect(() => {
    const interval = setInterval(() => {
      const store = useAuthStore.getState();
      if (store.needsRefresh() && store.isAuthenticated()) {
        api.auth
          .refresh()
          .then((tokens) => {
            useAuthStore
              .getState()
              .setTokens(tokens.accessToken, tokens.userId, tokens.role, tokens.expiresIn);
          })
          .catch(() => {
            useAuthStore.getState().clearAuth();
          });
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, []);
}
