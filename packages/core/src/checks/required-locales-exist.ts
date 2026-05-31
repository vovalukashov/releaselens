import type { Check, CheckResult } from '../types.js';

export const requiredLocalesExistCheck: Check = {
  id: 'required-locales-exist',
  description:
    'Verify each route\'s required locales are declared in the top-level locales list.',
  defaultSeverity: 'critical',
  defaultConfidence: 'high',
  run({ config }) {
    const results: CheckResult[] = [];
    if (config.locales.length === 0) return results;
    const declared = new Set(config.locales);

    for (const route of config.routes) {
      const required = route.locales ?? config.locales;
      for (const locale of required) {
        if (!declared.has(locale)) {
          results.push({
            checkId: 'required-locales-exist',
            issueKey: 'locale-not-declared',
            severity: 'critical',
            confidence: 'high',
            message: `Route "${route.id}" requires locale "${locale}" which is not declared in locales [${config.locales.join(', ')}].`,
            route: route.id,
            locale,
          });
        }
      }
    }

    return results;
  },
};
