import type { Check } from '../types.js';
import { eventTargetValidCheck } from './event-target-valid.js';
import { formReferencesRouteCheck } from './form-references-route.js';
import { requiredLocalesExistCheck } from './required-locales-exist.js';
import { seoStaticCheck } from './seo-static.js';

export const defaultChecks: Check[] = [
  requiredLocalesExistCheck,
  formReferencesRouteCheck,
  eventTargetValidCheck,
  seoStaticCheck,
];

export {
  eventTargetValidCheck,
  formReferencesRouteCheck,
  requiredLocalesExistCheck,
  seoStaticCheck,
};
