import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunStatusBadge } from './run-status-badge';

describe('RunStatusBadge', () => {
  it('renders the label for each status', () => {
    const cases = [
      ['queued', 'En cola'],
      ['running', 'Corriendo'],
      ['completed', 'Completado'],
      ['cancelled', 'Cancelado'],
      ['failed', 'Fallido'],
      ['timeout', 'Timeout'],
    ] as const;
    for (const [status, label] of cases) {
      const { unmount } = render(<RunStatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });
});
