import { describe, expect, it } from 'vitest';
import { parseTrackingCalls } from '../src/analytics/parse-tracking-calls.js';

describe('parseTrackingCalls', () => {
  it('detects track() calls', () => {
    const source = `
      function onClick() {
        track('button_click', { id: 'cta' });
      }
    `;
    const calls = parseTrackingCalls(source);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('button_click');
    expect(calls[0]?.method).toBe('track');
  });

  it('detects posthog.capture()', () => {
    const source = `
      import posthog from 'posthog-js';
      posthog.capture('signup_completed');
    `;
    const calls = parseTrackingCalls(source);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('signup_completed');
    expect(calls[0]?.method).toBe('posthog.capture');
  });

  it('detects analytics.track()', () => {
    const source = `
      analytics.track('page_view');
    `;
    const calls = parseTrackingCalls(source);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('page_view');
    expect(calls[0]?.method).toBe('analytics.track');
  });

  it('detects gtag("event", name)', () => {
    const source = `
      gtag('event', 'purchase', { value: 99 });
    `;
    const calls = parseTrackingCalls(source);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('purchase');
    expect(calls[0]?.method).toBe('gtag:event');
  });

  it('skips dynamic event names', () => {
    const source = `
      const name = 'click';
      track(name);
    `;
    const calls = parseTrackingCalls(source);
    expect(calls).toHaveLength(0);
  });

  it('returns empty when no tracking calls', () => {
    const source = `console.log('hello');`;
    const calls = parseTrackingCalls(source);
    expect(calls).toHaveLength(0);
  });

  it('matches a custom identifier tracker (`sendEvent`)', () => {
    const source = `sendEvent('cta_click', { ctaId: 'plan-pro' });`;
    const calls = parseTrackingCalls(source, 'x.ts', ['sendEvent']);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('cta_click');
    expect(calls[0]?.method).toBe('sendEvent');
  });

  it('matches a custom member-access tracker (`mixpanel.track`)', () => {
    const source = `mixpanel.track('signed_up');`;
    const calls = parseTrackingCalls(source, 'x.ts', ['mixpanel.track']);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('signed_up');
    expect(calls[0]?.method).toBe('mixpanel.track');
  });

  it('matches a multi-level chain (`window.dataLayer.push` is recognised by callee path)', () => {
    const source = `window.dataLayer.push('purchase_complete');`;
    const calls = parseTrackingCalls(source, 'x.ts', ['window.dataLayer.push']);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('purchase_complete');
  });

  it('skips a custom tracker call whose first arg is not a string literal', () => {
    const source = `sendEvent(eventName, payload);`;
    const calls = parseTrackingCalls(source, 'x.ts', ['sendEvent']);
    expect(calls).toHaveLength(0);
  });

  it('extracts name from a non-default argIndex via `@N` syntax', () => {
    const source = `_sendEvent('host.example.com', 'page-load', { user: 1 });`;
    const calls = parseTrackingCalls(source, 'x.ts', ['_sendEvent@1']);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('page-load');
    expect(calls[0]?.method).toBe('_sendEvent@1');
  });

  it('built-in trackers stay recognised when extra trackers are supplied', () => {
    const source = `
      posthog.capture('built_in');
      sendEvent('custom');
    `;
    const calls = parseTrackingCalls(source, 'x.ts', ['sendEvent']);
    const names = calls.map((c) => c.name).sort();
    expect(names).toEqual(['built_in', 'custom']);
  });

  it('reads the event name from an object property (`callee#prop`)', () => {
    const source = `
      sendEvent({ eventName: 'slide_change', type: 'click' });
      sendEvent({ eventName: 'tools_click' });
    `;
    const calls = parseTrackingCalls(source, 'x.ts', ['sendEvent#eventName']);
    expect(calls.map((c) => c.name).sort()).toEqual([
      'slide_change',
      'tools_click',
    ]);
  });

  it('combines `@n#prop` to read the object at a non-zero arg index', () => {
    const source = `track(ctx, { event: 'signup' });`;
    const calls = parseTrackingCalls(source, 'x.ts', ['track@1#event']);
    expect(calls.map((c) => c.name)).toEqual(['signup']);
  });

  it('ignores a `#prop` call when the property is absent or non-literal', () => {
    const source = `
      sendEvent({ type: 'click' });
      sendEvent({ eventName: dynamicName });
    `;
    const calls = parseTrackingCalls(source, 'x.ts', ['sendEvent#eventName']);
    expect(calls).toHaveLength(0);
  });

  it('reads a `#prop` name from a string-literal key', () => {
    const source = `logEvent({ 'name': 'purchase' });`;
    const calls = parseTrackingCalls(source, 'x.ts', ['logEvent#name']);
    expect(calls.map((c) => c.name)).toEqual(['purchase']);
  });
});
