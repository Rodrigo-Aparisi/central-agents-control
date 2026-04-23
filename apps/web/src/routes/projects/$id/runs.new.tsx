import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { qk } from '@/lib/queryKeys';
import { LaunchRunInput } from '@cac/shared';
import { useMutation } from '@tanstack/react-query';
import { Link, createRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Play } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Route as rootRoute } from '../../__root';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$id/runs/new',
  component: LaunchRunPage,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData({
      queryKey: qk.project(params.id),
      queryFn: () => api.projects.get(params.id),
    }),
});

function LaunchRunPage() {
  const { id: projectId } = Route.useParams();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('');
  const [timeoutMin, setTimeoutMin] = useState('30');
  const [error, setError] = useState<string | null>(null);

  const launch = useMutation({
    mutationFn: () => {
      const parsed = LaunchRunInput.parse({
        prompt,
        params:
          model || timeoutMin
            ? {
                ...(model ? { model } : {}),
                ...(timeoutMin ? { timeoutMs: Number(timeoutMin) * 60_000 } : {}),
              }
            : undefined,
      });
      return api.runs.launch(projectId, parsed);
    },
    onSuccess: ({ runId }) => {
      toast.success('Run encolado');
      navigate({ to: '/runs/$id', params: { id: runId } });
    },
    onError: (e) => setError(humanizeError(e)),
  });

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/projects/$id" params={{ id: projectId }}>
            <ArrowLeft className="size-4" />
            Volver al proyecto
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo run</CardTitle>
          <CardDescription>
            El prompt se envuelve automáticamente con la plantilla anti-inyección.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe lo que debe hacer el agente…"
              rows={10}
              className="font-mono text-sm"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model">Modelo (opcional)</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="claude-sonnet-4-6"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (minutos)</Label>
              <Input
                id="timeout"
                type="number"
                min={1}
                max={120}
                value={timeoutMin}
                onChange={(e) => setTimeoutMin(e.target.value)}
              />
            </div>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={() => launch.mutate()} disabled={launch.isPending || !prompt.trim()}>
              <Play className="size-4" />
              {launch.isPending ? 'Encolando…' : 'Lanzar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
