import { describe, expect, it } from 'vitest';
import { explainFinding } from '../src/ai/explain.js';
import type { CheckResult } from '../src/types.js';

const finding: CheckResult = {
  checkId: 'seo-static',
  severity: 'critical',
  confidence: 'high',
  message: 'missing canonical',
  route: 'pricing',
};

describe('explainFinding', () => {
  it('returns explanationError when no API key is set', async () => {
    const original = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    try {
      const result = await explainFinding(finding);
      expect(result.explanation).toBeUndefined();
      expect(result.explanationError).toContain('AI_GATEWAY_API_KEY');
    } finally {
      if (original) process.env.AI_GATEWAY_API_KEY = original;
    }
  });

  it('preserves original finding fields', async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const result = await explainFinding(finding);
    expect(result.checkId).toBe(finding.checkId);
    expect(result.severity).toBe(finding.severity);
    expect(result.route).toBe('pricing');
  });
});
