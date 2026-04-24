import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { useAuthStore } from '@/stores/auth';
import { createRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { Route as rootRoute } from './__root';

const searchSchema = z.object({
  redirect: z
    .string()
    .optional()
    .transform((v) => (v?.startsWith('/') ? v : undefined)),
});

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const dest = search.redirect ?? '/projects';
    if (useAuthStore.getState().isAuthenticated()) {
      throw redirect({ to: dest });
    }
    // Silent refresh: when AUTH_ENABLED=false the server always returns a synthetic
    // token, so we can skip the login form entirely. Also handles the case where a
    // valid httpOnly cookie is already set (page reload while logged in).
    let tokens: Awaited<ReturnType<typeof api.auth.refresh>> | undefined;
    try {
      tokens = await api.auth.refresh();
    } catch {
      return; // no cookie or real auth mode — show the login form
    }
    if (tokens) {
      useAuthStore.getState().setTokens(tokens.accessToken, tokens.userId, tokens.role, tokens.expiresIn);
      throw redirect({ to: dest });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const setTokens = useAuthStore((s) => s.setTokens);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setIsPending(true);

    try {
      const tokens = await api.auth.login({ email, password });
      setTokens(tokens.accessToken, tokens.userId, tokens.role, tokens.expiresIn);
      await navigate({ to: search.redirect ?? '/projects' });
    } catch (err) {
      setErrorMsg(humanizeError(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-2">
          <div className="mb-2 flex items-center gap-2">
            <div className="size-6 rounded-md bg-primary/20 ring-1 ring-primary/40" />
            <span className="text-base font-semibold tracking-tight">CAC</span>
          </div>
          <CardTitle className="text-xl">Iniciar sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">Contraseña</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isPending}
              />
            </div>

            {errorMsg && (
              <p role="alert" className="text-sm text-destructive">
                {errorMsg}
              </p>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
