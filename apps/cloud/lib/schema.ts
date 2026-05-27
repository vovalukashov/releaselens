import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: varchar('github_id', { length: 255 }).unique(),
  email: varchar('email', { length: 255 }),
  name: varchar('name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 255 }).notNull(),
    apiToken: varchar('api_token', { length: 64 }).notNull().unique(),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
    plan: varchar('plan', { length: 32 }).default('free').notNull(),
    slackWebhookUrl: text('slack_webhook_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    apiTokenIdx: index('projects_api_token_idx').on(table.apiToken),
    slugIdx: index('projects_slug_idx').on(table.slug),
  }),
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    prNumber: text('pr_number'),
    branch: text('branch'),
    commit: text('commit'),
    passed: boolean('passed').notNull(),
    criticalCount: integer('critical_count').notNull().default(0),
    warningCount: integer('warning_count').notNull().default(0),
    infoCount: integer('info_count').notNull().default(0),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('reports_project_idx').on(table.projectId),
    createdAtIdx: index('reports_created_at_idx').on(table.createdAt),
  }),
);

export const baselines = pgTable('baselines', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: 'cascade' }),
  fingerprints: jsonb('fingerprints').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Baseline = typeof baselines.$inferSelect;
