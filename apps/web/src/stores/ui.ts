import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';
export type DiffView = 'split' | 'unified';
export type LogFontSize = 'xs' | 'sm' | 'md';

interface UiState {
  theme: Theme;
  /** True once we've applied the user's explicit choice (blocks prefers-color-scheme override). */
  themeInitialised: boolean;
  logFontSize: LogFontSize;
  diffView: DiffView;

  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setLogFontSize: (size: LogFontSize) => void;
  setDiffView: (view: DiffView) => void;
  /** Called once on app bootstrap to honour system preference when not explicitly set. */
  applySystemThemeIfNeeded: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      themeInitialised: false,
      logFontSize: 'xs',
      diffView: 'split',

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme, themeInitialised: true });
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ theme: next, themeInitialised: true });
      },
      setLogFontSize: (logFontSize) => set({ logFontSize }),
      setDiffView: (diffView) => set({ diffView }),
      applySystemThemeIfNeeded: () => {
        if (get().themeInitialised) return;
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        if (prefersLight) {
          applyTheme('light');
          set({ theme: 'light' });
        }
      },
    }),
    {
      name: 'cac:ui',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme);
      },
    },
  ),
);

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}
