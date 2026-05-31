import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadPayloadModel } from '../adapters/payload/load-payload.js';
import type { Check, CheckResult } from '../types.js';

const CHECK_ID = 'payload-route-cms-entry';

export const payloadRouteCmsEntryCheck: Check = {
  id: CHECK_ID,
  description:
    'For routes declaring a CMS collection binding, verify the collection exists in the Payload schema.',
  defaultSeverity: 'critical',
  defaultConfidence: 'high',
  async run({ config, cwd }) {
    const payloadCfg = config.adapters.payload;
    if (!payloadCfg) return [];

    const routesNeedingCms = config.routes.filter((r) => r.cms);
    if (routesNeedingCms.length === 0) return [];

    const absConfig = resolve(cwd, payloadCfg.config);
    if (!existsSync(absConfig)) {
      return [
        {
          checkId: CHECK_ID,
          issueKey: 'payload-config-not-found',
          severity: 'critical',
          confidence: 'high',
          message: `adapters.payload.config "${payloadCfg.config}" not found at ${absConfig}.`,
        },
      ];
    }

    let model;
    try {
      model = await loadPayloadModel(payloadCfg.config, cwd);
    } catch (err) {
      return [
        {
          checkId: CHECK_ID,
          issueKey: 'payload-load-failed',
          severity: 'warning',
          confidence: 'low',
          message: `Failed to load Payload config: ${(err as Error).message}`,
        },
      ];
    }

    const collectionSlugs = new Set(model.collections.map((c) => c.slug));
    const results: CheckResult[] = [];

    for (const route of routesNeedingCms) {
      const cms = route.cms;
      if (!cms) continue;
      if (!collectionSlugs.has(cms.collection)) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'cms-collection-missing',
          severity: 'critical',
          confidence: 'high',
          message: `Route "${route.id}" binds to CMS collection "${cms.collection}" but no such collection exists in the Payload config (${payloadCfg.config}).`,
          route: route.id,
        });
      }
    }

    return results;
  },
};
