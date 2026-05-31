import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadPayloadModel } from '../adapters/payload/load-payload.js';
import type { Check, CheckResult } from '../types.js';

const CHECK_ID = 'payload-locales-consistency';

export const payloadLocalesConsistencyCheck: Check = {
  id: CHECK_ID,
  description:
    'Verify config.locales matches the locales declared in the Payload localization config.',
  defaultSeverity: 'critical',
  defaultConfidence: 'high',
  async run({ config, cwd }) {
    const payloadCfg = config.adapters.payload;
    if (!payloadCfg) return [];

    const absConfig = resolve(cwd, payloadCfg.config);
    if (!existsSync(absConfig)) return [];

    let model;
    try {
      model = await loadPayloadModel(payloadCfg.config, cwd);
    } catch {
      return [];
    }

    if (!model.localization) return [];

    const results: CheckResult[] = [];
    const payloadLocales = new Set(model.localization.locales);
    const configLocales = new Set(config.locales);

    for (const locale of configLocales) {
      if (!payloadLocales.has(locale)) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'payload-locale-config-only',
          severity: 'critical',
          confidence: 'high',
          message: `Locale "${locale}" declared in releaselens.config.locales but not present in Payload localization.locales [${[...payloadLocales].join(', ')}].`,
          locale,
        });
      }
    }

    for (const locale of payloadLocales) {
      if (!configLocales.has(locale)) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'payload-locale-payload-only',
          severity: 'warning',
          confidence: 'high',
          message: `Locale "${locale}" exists in Payload localization but is not declared in releaselens.config.locales — checks will skip it.`,
          locale,
        });
      }
    }

    if (
      model.localization.defaultLocale &&
      config.defaultLocale &&
      model.localization.defaultLocale !== config.defaultLocale
    ) {
      results.push({
        checkId: CHECK_ID,
        issueKey: 'payload-default-locale-mismatch',
        severity: 'critical',
        confidence: 'high',
        message: `defaultLocale mismatch: releaselens.config has "${config.defaultLocale}" but Payload has "${model.localization.defaultLocale}".`,
      });
    }

    return results;
  },
};
