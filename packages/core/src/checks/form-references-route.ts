import type { Check, CheckResult } from '../types.js';

export const formReferencesRouteCheck: Check = {
  id: 'form-references-route',
  description:
    'Verify each declared form references a route id that exists in the routes list.',
  defaultSeverity: 'critical',
  defaultConfidence: 'high',
  run({ config }) {
    const results: CheckResult[] = [];
    const routeIds = new Set(config.routes.map((r) => r.id));

    for (const form of config.forms) {
      if (!routeIds.has(form.onRoute)) {
        results.push({
          checkId: 'form-references-route',
          issueKey: 'form-route-undeclared',
          severity: 'critical',
          confidence: 'high',
          message: `Form "${form.id}" references route "${form.onRoute}" which is not declared.`,
          form: form.id,
          data: { onRoute: form.onRoute },
        });
      }
    }

    return results;
  },
};
