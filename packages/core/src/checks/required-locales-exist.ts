import type { Check, CheckResult } from '../types.js';

export const requiredLocalesExistCheck: Check = {
  id: 'required-locales-exist',
  description:
    'Verify that defaultLocale and per-route required locales are declared in the top-level locales list.',
  run({ config }) {
    const results: CheckResult[] = [];
    const declared = new Set(config.locales);

    if (!declared.has(config.defaultLocale)) {
      results.push({
        checkId: 'required-locales-exist',
        severity: 'error',
        message: `defaultLocale "${config.defaultLocale}" is not present in locales [${config.locales.join(', ')}].`,
      });
    }

    for (const route of config.routes) {
      const required = route.requiredLocales ?? config.locales;
      for (const locale of required) {
        if (!declared.has(locale)) {
          results.push({
            checkId: 'required-locales-exist',
            severity: 'error',
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
