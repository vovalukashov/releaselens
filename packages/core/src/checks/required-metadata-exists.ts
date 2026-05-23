import type { Check, CheckResult } from '../types.js';

export const requiredMetadataExistsCheck: Check = {
  id: 'required-metadata-exists',
  description:
    'Confirm that every route declares its required metadata contract (stub: will parse generateMetadata in Week 2).',
  run({ config }) {
    const results: CheckResult[] = [];
    for (const route of config.routes) {
      const required = route.requiredMetadata ?? [];
      if (required.length === 0) {
        results.push({
          checkId: 'required-metadata-exists',
          severity: 'warning',
          message: `Route "${route.id}" declares no required metadata. Consider adding at least title, description, canonical.`,
          route: route.id,
        });
        continue;
      }
      results.push({
        checkId: 'required-metadata-exists',
        severity: 'info',
        message: `Route "${route.id}" requires metadata: ${required.join(', ')}.`,
        route: route.id,
        data: { required },
      });
    }
    return results;
  },
};
