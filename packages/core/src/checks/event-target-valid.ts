import type { Check, CheckResult } from '../types.js';

export const eventTargetValidCheck: Check = {
  id: 'event-target-valid',
  description:
    'Verify each event\'s onForm or onRoute target references an existing form or route.',
  defaultSeverity: 'critical',
  defaultConfidence: 'high',
  run({ config }) {
    const results: CheckResult[] = [];
    const routeIds = new Set(config.routes.map((r) => r.id));
    const formIds = new Set(config.forms.map((f) => f.id));

    for (const event of config.events) {
      if (event.onForm && !formIds.has(event.onForm)) {
        results.push({
          checkId: 'event-target-valid',
          severity: 'critical',
          confidence: 'high',
          message: `Event "${event.name}" targets form "${event.onForm}" which is not declared.`,
          event: event.name,
          data: { onForm: event.onForm },
        });
      }
      if (event.onRoute && !routeIds.has(event.onRoute)) {
        results.push({
          checkId: 'event-target-valid',
          severity: 'critical',
          confidence: 'high',
          message: `Event "${event.name}" targets route "${event.onRoute}" which is not declared.`,
          event: event.name,
          data: { onRoute: event.onRoute },
        });
      }
    }

    return results;
  },
};
