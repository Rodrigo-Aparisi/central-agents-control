import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const healthMock = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    health: () => healthMock(),
  },
  ApiError: class ApiError extends Error {},
}));

import { HealthBadge } from './health-badge';

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  healthMock.mockReset();
});

describe('HealthBadge', () => {
  it('renders ok when the API reports ok', async () => {
    healthMock.mockResolvedValueOnce({
      status: 'ok',
      db: 'ok',
      redis: 'ok',
      timestamp: '2026-04-23T10:00:00.000Z',
    });
    render(wrap(<HealthBadge />));
    await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());
  });

  it('renders degraded when redis is down', async () => {
    healthMock.mockResolvedValueOnce({
      status: 'degraded',
      db: 'ok',
      redis: 'error',
      timestamp: '2026-04-23T10:00:00.000Z',
    });
    render(wrap(<HealthBadge />));
    await waitFor(() => expect(screen.getByText('degraded')).toBeInTheDocument());
  });

  it('renders offline when the request fails', async () => {
    healthMock.mockRejectedValueOnce(new Error('network'));
    render(wrap(<HealthBadge />));
    await waitFor(() => expect(screen.getByText('offline')).toBeInTheDocument());
  });
});
