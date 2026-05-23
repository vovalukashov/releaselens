import type { Check, CheckResult } from '../types.js';

export const routeHasCmsEntryCheck: Check = {
  id: 'route-has-cms-entry',
  description:
    'Warn when a route declares a CMS collection but no slug binding (stub: will verify entry existence in Week 2).',
  run({ config }) {
    const results: CheckResult[] = [];
    for (const route of config.routes) {
      if (!route.cms) continue;
      if (!route.cms.slug) {
        results.push({
          checkId: 'route-has-cms-entry',
          severity: 'warning',
          message: `Route "${route.id}" is bound to CMS collection "${route.cms.collection}" but has no slug.`,
          route: route.id,
          data: { collection: route.cms.collection },
        });
      }
    }
    return results;
  },
};
