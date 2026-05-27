import type { Check } from '../types.js';
import { analyticsStaticCheck } from './analytics-static.js';
import { eventTargetValidCheck } from './event-target-valid.js';
import { formReferencesRouteCheck } from './form-references-route.js';
import { formsStaticCheck } from './forms-static.js';
import { localesStaticCheck } from './locales-static.js';
import { payloadBlockRendererCheck } from './payload-block-renderer.js';
import { payloadLocalesConsistencyCheck } from './payload-locales-consistency.js';
import { payloadRouteCmsEntryCheck } from './payload-route-cms-entry.js';
import { requiredLocalesExistCheck } from './required-locales-exist.js';
import { seoStaticCheck } from './seo-static.js';

export const defaultChecks: Check[] = [
  requiredLocalesExistCheck,
  formReferencesRouteCheck,
  eventTargetValidCheck,
  seoStaticCheck,
  formsStaticCheck,
  analyticsStaticCheck,
  localesStaticCheck,
  payloadRouteCmsEntryCheck,
  payloadLocalesConsistencyCheck,
  payloadBlockRendererCheck,
];

export {
  analyticsStaticCheck,
  eventTargetValidCheck,
  formReferencesRouteCheck,
  formsStaticCheck,
  localesStaticCheck,
  payloadBlockRendererCheck,
  payloadLocalesConsistencyCheck,
  payloadRouteCmsEntryCheck,
  requiredLocalesExistCheck,
  seoStaticCheck,
};
