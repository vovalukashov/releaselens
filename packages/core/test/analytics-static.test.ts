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
    expect(calls[0]?.method).toBe('gtag');
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
});
