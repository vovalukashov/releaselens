const config = {
  collections: [
    {
      slug: 'pages',
      versions: { drafts: true },
      fields: [
        { name: 'title', type: 'text', required: true, localized: true },
        { name: 'slug', type: 'text', required: true },
        {
          name: 'blocks',
          type: 'blocks',
          blocks: [
            {
              slug: 'PricingHero',
              fields: [
                {
                  name: 'headline',
                  type: 'text',
                  required: true,
                  localized: true,
                },
                { name: 'subhead', type: 'text', localized: true },
              ],
            },
            {
              slug: 'TestimonialGrid',
              fields: [
                { name: 'items', type: 'array', required: true },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'leads',
      fields: [
        { name: 'email', type: 'email', required: true },
        { name: 'plan', type: 'text' },
      ],
    },
  ],
  globals: [
    {
      slug: 'site-settings',
      fields: [
        { name: 'siteName', type: 'text', required: true },
      ],
    },
  ],
  localization: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
  },
};

export default config;
