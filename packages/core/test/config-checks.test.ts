import { describe, expect, it } from 'vitest';
import { defineReleaseLens, eventTargetValidCheck } from '../src/index.js';

describe('eventTargetValidCheck', () => {
  it('flags an event whose onRoute references an undeclared route', async () => {
    const cfg = defineReleaseLens({
      appDir: './does-not-exist',
      routes: [{ id: 'pricing', path: '/pricing' }],
      events: [{ name: 'ghost_view', onRoute: 'ghost' }],
    });
    const out = await eventTargetValidCheck.run({ config: cfg, cwd: '/tmp' });
    const finding = out.find((r) => r.issueKey === 'event-route-undeclared');
    expect(finding).toBeDefined();
    expect(finding?.checkId).toBe('event-target-valid');
    expect(finding?.severity).toBe('critical');
    expect(finding?.confidence).toBe('high');
    expect(finding?.event).toBe('ghost_view');
    expect(finding?.data).toEqual({ onRoute: 'ghost' });
    expect(finding?.message).toContain(
      'targets route "ghost" which is not declared',
    );
  });

  it('passes when onRoute references a declared route', async () => {
    const cfg = defineReleaseLens({
      appDir: './does-not-exist',
      routes: [{ id: 'pricing', path: '/pricing' }],
      events: [{ name: 'pricing_view', onRoute: 'pricing' }],
    });
    const out = await eventTargetValidCheck.run({ config: cfg, cwd: '/tmp' });
    expect(out).toHaveLength(0);
  });
});
