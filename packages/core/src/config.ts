import { z } from 'zod';

export const FrameworkSchema = z.enum(['next']);
export type Framework = z.infer<typeof FrameworkSchema>;

export const CmsAdapterSchema = z.enum(['payload', 'sanity', 'none']);
export type CmsAdapter = z.infer<typeof CmsAdapterSchema>;

export const HostingAdapterSchema = z.enum(['vercel', 'other']);
export type HostingAdapter = z.infer<typeof HostingAdapterSchema>;

export const RouteTypeSchema = z.enum([
  'landing',
  'marketing',
  'legal',
  'blog',
  'other',
]);
export type RouteType = z.infer<typeof RouteTypeSchema>;

export const MetadataFieldSchema = z.enum([
  'title',
  'description',
  'canonical',
  'hreflang',
  'openGraph',
  'structuredData',
]);
export type MetadataField = z.infer<typeof MetadataFieldSchema>;

export const CmsBindingSchema = z.object({
  collection: z.string().min(1),
  slug: z.string().min(1).optional(),
});
export type CmsBinding = z.infer<typeof CmsBindingSchema>;

export const RouteAnalyticsSchema = z.object({
  requiredEvents: z.array(z.string().min(1)).default([]),
  consentSensitive: z.boolean().default(false),
});
export type RouteAnalytics = z.infer<typeof RouteAnalyticsSchema>;

export const RouteExperimentsSchema = z.object({
  allowed: z.boolean().default(false),
  requiredFallback: z.boolean().default(false),
});
export type RouteExperiments = z.infer<typeof RouteExperimentsSchema>;

export const RouteSchema = z.object({
  id: z.string().min(1),
  path: z
    .string()
    .min(1)
    .regex(/^\//, { message: 'Route path must start with "/"' }),
  type: RouteTypeSchema.default('marketing'),
  cms: CmsBindingSchema.optional(),
  requiredLocales: z.array(z.string().min(1)).optional(),
  requiredMetadata: z.array(MetadataFieldSchema).optional(),
  analytics: RouteAnalyticsSchema.optional(),
  experiments: RouteExperimentsSchema.optional(),
});
export type Route = z.infer<typeof RouteSchema>;

export const SiteDoctorConfigSchema = z
  .object({
    framework: FrameworkSchema.default('next'),
    cms: CmsAdapterSchema.default('none'),
    hosting: HostingAdapterSchema.default('vercel'),
    locales: z.array(z.string().min(1)).min(1),
    defaultLocale: z.string().min(1),
    routes: z.array(RouteSchema).default([]),
  })
  .superRefine((cfg, ctx) => {
    if (!cfg.locales.includes(cfg.defaultLocale)) {
      ctx.addIssue({
        code: 'custom',
        path: ['defaultLocale'],
        message: `defaultLocale "${cfg.defaultLocale}" is not present in locales [${cfg.locales.join(', ')}]`,
      });
    }

    const seenIds = new Set<string>();
    for (const [index, route] of cfg.routes.entries()) {
      if (seenIds.has(route.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['routes', index, 'id'],
          message: `Duplicate route id "${route.id}"`,
        });
      }
      seenIds.add(route.id);
    }
  });

export type SiteDoctorConfigInput = z.input<typeof SiteDoctorConfigSchema>;
export type SiteDoctorConfig = z.output<typeof SiteDoctorConfigSchema>;

export function defineSiteDoctor(
  config: SiteDoctorConfigInput,
): SiteDoctorConfig {
  return SiteDoctorConfigSchema.parse(config);
}
