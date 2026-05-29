# @releaselens/core

Engine behind the [`releaselens`](https://www.npmjs.com/package/releaselens) CLI: the Zod config schema, public types, the check runner, FP-budget storage, the 10 default checks (SEO, forms, analytics, locales, Payload CMS, plus config-integrity), the Payload adapter, and the AI explainer.

Most users should install the CLI (`releaselens`) rather than this package directly. Import `defineReleaseLens` from here in your config file:

```ts
// releaselens.config.ts
import { defineReleaseLens } from '@releaselens/core';

export default defineReleaseLens({
  framework: 'next',
  locales: ['en'],
  defaultLocale: 'en',
  routes: [{ id: 'pricing', path: '/pricing', businessImpact: 'high' }],
});
```

See the [project README](https://github.com/vovalukashov/releaselens#readme) for the full schema and check list.

## License

MIT.
