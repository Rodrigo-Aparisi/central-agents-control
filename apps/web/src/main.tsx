import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { queryClient } from './lib/query';
import { router } from './router';
import { useUiStore } from './stores/ui';
import './styles/globals.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('root element not found');

// Respect the OS preference on first load; user's explicit toggle wins afterwards.
useUiStore.getState().applySystemThemeIfNeeded();

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
