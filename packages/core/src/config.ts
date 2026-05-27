import { z } from 'zod';

export const FrameworkSchema = z.enum(['next']);
export type Framework = z.infer<typeof FrameworkSchema>;

export const BusinessImpactSchema = z.enum(['high', 'medium', 'low']);
export type BusinessImpact = z.infer<typeof BusinessImpactSchema>;

export const ConsentSchema = z.enum([
  'analytics',
  'marketing',
  'preferences',
  'none',
]);
export type Consent = z.infer<typeof ConsentSchema>;

export const SeveritySchema = z.enum(['critical', 'warning', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const PreviewSourceSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('vercel') }),
  z.object({ source: z.literal('manual'), url: z.string().url() }),
]);
export type PreviewSource = z.infer<typeof PreviewSourceSchema>;

export const RouteCmsSchema = z.object({
  collection: z.string().min(1),
  slug: z.string().min(1).optional(),
});
export type RouteCms = z.infer<typeof RouteCmsSchema>;

export const RouteSchema = z.object({
  id: z.string().min(1),
  path: z
    .string()
    .min(1)
    .regex(/^\//, { message: 'Route path must start with "/"' }),
  businessImpact: BusinessImpactSchema.default('medium'),
  locales: z.array(z.string().min(1)).optional(),
  cms: RouteCmsSchema.optional(),
});
export type Route = z.infer<typeof RouteSchema>;

export const SuccessStateSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('route'), value: z.string().min(1) }),
  z.object({ type: z.literal('selector'), value: z.string().min(1) }),
  z.object({ type: z.literal('text'), value: z.string().min(1) }),
]);
export type SuccessState = z.infer<typeof SuccessStateSchema>;

export const FormSchema = z.object({
  id: z.string().min(1),
  onRoute: z.string().min(1),
  selector: z.string().min(1),
  successState: SuccessStateSchema,
});
export type Form = z.infer<typeof FormSchema>;

export const EventSchema = z
  .object({
    name: z.string().min(1),
    onForm: z.string().min(1).optional(),
    onRoute: z.string().min(1).optional(),
    consent: ConsentSchema.default('none'),
    requiredPayload: z.array(z.string().min(1)).default([]),
  })
  .refine((e) => Boolean(e.onForm) !== Boolean(e.onRoute), {
    message: 'Event must specify exactly one of `onForm` or `onRoute`',
  });
export type Event = z.infer<typeof EventSchema>;

export const RuleConfigSchema = z.object({
  severity: SeveritySchema.optional(),
  confidence: ConfidenceSchema.optional(),
  autoMuteAfter: z.number().int().nonnegative().optional(),
});
export type RuleConfig = z.infer<typeof RuleConfigSchema>;

export const PayloadAdapterConfigSchema = z.object({
  config: z.string().min(1),
});
export type PayloadAdapterConfig = z.infer<typeof PayloadAdapterConfigSchema>;

export const AdaptersSchema = z.object({
  payload: PayloadAdapterConfigSchema.optional(),
});
export type Adapters = z.infer<typeof AdaptersSchema>;

export const ReleaseLensConfigSchema = z
  .object({
    framework: FrameworkSchema.default('next'),
    appDir: z.string().min(1).default('./app'),
    frontendDirs: z
      .array(z.string().min(1))
      .default(['./app', './components']),
    previewUrl: PreviewSourceSchema.default({ source: 'vercel' }),
    locales: z.array(z.string().min(1)).default([]),
    defaultLocale: z.string().min(1).optional(),
    routes: z.array(RouteSchema).default([]),
    forms: z.array(FormSchema).default([]),
    events: z.array(EventSchema).default([]),
    rules: z.record(z.string().min(1), RuleConfigSchema).default({}),
    adapters: AdaptersSchema.default({}),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.defaultLocale && !cfg.locales.includes(cfg.defaultLocale)) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultLocale'],
        message: `defaultLocale "${cfg.defaultLocale}" is not present in locales [${cfg.locales.join(', ')}]`,
      });
    }

    assertUniqueIds(ctx, cfg.routes, 'routes', 'route id');
    assertUniqueIds(ctx, cfg.forms, 'forms', 'form id');

    const seenEventNames = new Set<string>();
    for (const [index, event] of cfg.events.entries()) {
      if (seenEventNames.has(event.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['events', index, 'name'],
          message: `Duplicate event name "${event.name}"`,
        });
      }
      seenEventNames.add(event.name);
    }
  });

export type ReleaseLensConfigInput = z.input<typeof ReleaseLensConfigSchema>;
export type ReleaseLensConfig = z.output<typeof ReleaseLensConfigSchema>;

export function defineReleaseLens(
  config: ReleaseLensConfigInput,
): ReleaseLensConfig {
  return ReleaseLensConfigSchema.parse(config);
}

function assertUniqueIds<T extends { id: string }>(
  ctx: z.RefinementCtx,
  items: T[],
  path: string,
  label: string,
): void {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (seen.has(item.id)) {
      ctx.addIssue({
        code: 'custom',
        path: [path, index, 'id'],
        message: `Duplicate ${label} "${item.id}"`,
      });
    }
    seen.add(item.id);
  }
}
