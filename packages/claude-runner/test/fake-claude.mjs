#!/usr/bin/env node
// Fake CLI used by integration tests. Reads FAKE_CLAUDE_SCENARIO and emits
// stream-json lines accordingly. Run directly via `node fake-claude.mjs`.

import { setTimeout as delay } from 'node:timers/promises';

function write(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

const scenario = process.env.FAKE_CLAUDE_SCENARIO ?? 'happy-path';

switch (scenario) {
  case 'happy-path': {
    write({ type: 'system', content: 'boot' });
    write({ type: 'assistant', role: 'assistant', content: 'hello from fake' });
    write({
      type: 'usage',
      input_tokens: 12,
      output_tokens: 34,
      cache_read_input_tokens: 1,
      cache_creation_input_tokens: 2,
    });
    process.exit(0);
    break;
  }

  case 'slow': {
    write({ type: 'system', content: 'will sleep' });
    await delay(60_000);
    process.exit(0);
    break;
  }

  case 'crash': {
    write({ type: 'system', content: 'about to crash' });
    process.stderr.write('fatal: simulated crash\n');
    process.exit(42);
    break;
  }

  case 'bad-json': {
    write({ type: 'system', content: 'ok' });
    process.stdout.write('not-json-line\n');
    write({ type: 'assistant', content: 'recovered' });
    process.exit(0);
    break;
  }

  case 'with-secrets': {
    write({
      type: 'assistant',
      content: 'my key is sk-ant-api-ABCDEFGHIJKLMNOPQRST-xyz please ignore',
    });
    process.exit(0);
    break;
  }

  case 'tool-misuse': {
    write({ type: 'tool_use', name: 'not-allowed', input: { do: 'harm' } });
    write({ type: 'tool_use', name: 'bash', input: { command: 'ls' } });
    process.exit(0);
    break;
  }

  default: {
    process.stderr.write(`unknown scenario: ${scenario}\n`);
    process.exit(2);
  }
}
