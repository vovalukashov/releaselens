import type { Check } from '../types.js';
import { requiredLocalesExistCheck } from './required-locales-exist.js';
import { requiredMetadataExistsCheck } from './required-metadata-exists.js';
import { routeHasCmsEntryCheck } from './route-has-cms-entry.js';

export const defaultChecks: Check[] = [
  routeHasCmsEntryCheck,
  requiredLocalesExistCheck,
  requiredMetadataExistsCheck,
];

export {
  requiredLocalesExistCheck,
  requiredMetadataExistsCheck,
  routeHasCmsEntryCheck,
};
