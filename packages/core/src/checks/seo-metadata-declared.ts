import type { Check, CheckResult } from '../types.js';

export const seoMetadataDeclaredCheck: Check = {
  id: 'seo-metadata-declared',
  description:
    'Placeholder for the SEO static pack. Real Next.js metadata parsing lands later in Month 1.',
  defaultSeverity: 'info',
  defaultConfidence: 'low',
  run({ config }) {
    const results: CheckResult[] = [];
    for (const route of config.routes) {
      results.push({
        checkId: 'seo-metadata-declared',
        severity: 'info',
        confidence: 'low',
        message: `Route "${route.id}" awaits SEO static analysis (title, description, canonical, hreflang, noindex).`,
        route: route.id,
        data: { businessImpact: route.businessImpact },
      });
    }
    return results;
  },
};
