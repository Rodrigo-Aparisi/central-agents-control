import { expect, test } from '@playwright/test';

const projectId = '018f1a2b-0000-7000-8000-000000000001';
const runId = '018f1a2b-0000-7000-8000-000000000002';

const project = {
  id: projectId,
  name: 'alpha',
  rootPath: 'D:/Proyectos/alpha',
  description: 'Primer proyecto de prueba',
  claudeConfig: null,
  metadata: null,
  createdAt: '2026-04-23T10:00:00.000Z',
  updatedAt: '2026-04-23T10:00:00.000Z',
};

const run = {
  id: runId,
  projectId,
  parentRunId: null,
  status: 'completed' as const,
  prompt: 'hello world',
  params: { flags: [], model: 'claude-sonnet-4-6', timeoutMs: 1_800_000 },
  usage: {
    inputTokens: 10,
    outputTokens: 20,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    estimatedCostUsd: 0.01,
  },
  exitCode: 0,
  durationMs: 1500,
  error: null,
  createdAt: '2026-04-23T10:05:00.000Z',
  startedAt: '2026-04-23T10:05:00.000Z',
  finishedAt: '2026-04-23T10:05:01.500Z',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/v1/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        db: 'ok',
        redis: 'ok',
        timestamp: new Date().toISOString(),
      }),
    }),
  );

  await page.route('**/v1/projects?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [project], nextCursor: null }),
    }),
  );

  await page.route(`**/v1/projects/${projectId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(project),
    }),
  );

  await page.route(`**/v1/projects/${projectId}/runs*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [run], nextCursor: null }),
    }),
  );

  await page.route(`**/v1/runs/${runId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(run),
    }),
  );

  await page.route(`**/v1/runs/${runId}/events*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: '018f1a2b-0000-7000-8000-00000000000a',
            runId,
            seq: 0,
            type: 'assistant_message',
            payload: { type: 'assistant_message', content: 'hola desde el fake' },
            timestamp: '2026-04-23T10:05:00.500Z',
          },
        ],
        nextFromSeq: null,
      }),
    }),
  );

  await page.route(`**/v1/runs/${runId}/artifacts`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );

  // Silence the Socket.IO handshake so it doesn't spam errors.
  await page.route('**/ws/**', (route) => route.abort());
});

test('golden path: projects → project detail → run detail', async ({ page }) => {
  await page.goto('/projects');

  await expect(page.getByRole('heading', { name: 'Proyectos' })).toBeVisible();
  const card = page.getByRole('link', { name: /^alpha/ }).first();
  await expect(card).toBeVisible();

  await card.click();
  await expect(page.getByRole('heading', { name: 'alpha', level: 1 })).toBeVisible();

  // Tabs that Fase 6b adds
  await expect(page.getByRole('tab', { name: 'Runs' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Graph' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Ajustes' })).toBeVisible();

  // Runs tab shows the seeded run
  await expect(page.getByText('Completado')).toBeVisible();

  // Open run detail
  await page.getByRole('link', { name: /Ver/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Run' })).toBeVisible();
  await expect(page.getByText('hola desde el fake')).toBeVisible();

  // Timeline slider present on completed runs
  await expect(page.getByLabel('Primer evento')).toBeVisible();
});
