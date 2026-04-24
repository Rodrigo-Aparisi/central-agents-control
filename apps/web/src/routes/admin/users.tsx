import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { guardAdmin, guardAuth } from '@/hooks/useAuthGuard';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { qk } from '@/lib/queryKeys';
import type { UserRow } from '@cac/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import { Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Route as rootRoute } from '../__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  beforeLoad: async ({ location }) => {
    await guardAuth(location.pathname);
    guardAdmin();
  },
  component: AdminUsersPage,
});

function RoleBadge({ role }: { role: UserRow['role'] }) {
  return (
    <Badge variant={role === 'admin' ? 'default' : 'muted'}>
      {role === 'admin' ? 'Admin' : 'Viewer'}
    </Badge>
  );
}

function DeleteUserButton({ userId, email }: { userId: string; email: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.admin.users.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.adminUsers() });
      toast.success(`Usuario ${email} eliminado`);
      setOpen(false);
    },
    onError: (err) => toast.error(humanizeError(err)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Eliminar usuario ${email}`}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar usuario</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          ¿Seguro que quieres eliminar a <strong>{email}</strong>? Esta acción no se puede deshacer.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewUserDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');

  const mutation = useMutation({
    mutationFn: () => api.admin.users.create({ email, password, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.adminUsers() });
      toast.success(`Usuario ${email} creado`);
      setOpen(false);
      setEmail('');
      setPassword('');
      setRole('viewer');
    },
    onError: (err) => toast.error(humanizeError(err)),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" aria-label="Crear nuevo usuario">
          <UserPlus />
          Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} id="new-user-form" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-email">Email</Label>
            <Input
              id="new-user-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="user@example.com"
              disabled={mutation.isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-password">Contraseña</Label>
            <Input
              id="new-user-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={mutation.isPending}
            />
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium leading-none">Rol</legend>
            <div className="flex gap-4 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="new-user-role"
                  value="viewer"
                  checked={role === 'viewer'}
                  onChange={() => setRole('viewer')}
                  disabled={mutation.isPending}
                  className="accent-primary"
                />
                Viewer
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="new-user-role"
                  value="admin"
                  checked={role === 'admin'}
                  onChange={() => setRole('admin')}
                  disabled={mutation.isPending}
                  className="accent-primary"
                />
                Admin
              </label>
            </div>
          </fieldset>
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={mutation.isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" form="new-user-form" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creando…' : 'Crear usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminUsersPage() {
  const queryClient = useQueryClient();

  const { data, isPending, isError, error } = useQuery({
    queryKey: qk.adminUsers(),
    queryFn: () => api.admin.users.list(),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'admin' | 'viewer' }) =>
      api.admin.users.updateRole(id, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.adminUsers() });
      toast.success('Rol actualizado');
    },
    onError: (err) => toast.error(humanizeError(err)),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Gestiona los accesos al panel CAC.</p>
        </div>
        <NewUserDialog />
      </div>

      {isPending && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          Cargando usuarios…
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {humanizeError(error)}
        </div>
      )}

      {data && (
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm" aria-label="Tabla de usuarios">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Último acceso</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No hay usuarios todavía.
                  </td>
                </tr>
              )}
              {data.items.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">{user.email}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        updateRoleMutation.mutate({
                          id: user.id,
                          role: user.role === 'admin' ? 'viewer' : 'admin',
                        })
                      }
                      disabled={updateRoleMutation.isPending}
                      aria-label={`Cambiar rol de ${user.email}, actualmente ${user.role}`}
                      className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Click para cambiar rol"
                    >
                      <RoleBadge role={user.role} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString('es-ES', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteUserButton userId={user.id} email={user.email} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
