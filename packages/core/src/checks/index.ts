import type { Check } from '../types.js';
import { eventTargetValidCheck } from './event-target-valid.js';
import { formReferencesRouteCheck } from './form-references-route.js';
import { requiredLocalesExistCheck } from './required-locales-exist.js';
import { seoMetadataDeclaredCheck } from './seo-metadata-declared.js';

export const defaultChecks: Check[] = [
  requiredLocalesExistCheck,
  formReferencesRouteCheck,
  eventTargetValidCheck,
  seoMetadataDeclaredCheck,
];

export {
  eventTargetValidCheck,
  formReferencesRouteCheck,
  requiredLocalesExistCheck,
  seoMetadataDeclaredCheck,
};
