import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, real, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users - auth-capable user accounts
export const genderTypes = ["male", "female", "other"] as const;
export type GenderType = typeof genderTypes[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  age: integer("age"),
  gender: text("gender").$type<GenderType>(),
  slackUserId: text("slack_user_id").unique(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// User Platform IDs - multiple external platform identifiers per user (Slack/Telegram)
export const platformTypes = ["slack", "telegram"] as const;
export type PlatformType = typeof platformTypes[number];

export const userPlatformIds = pgTable("user_platform_ids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull().$type<PlatformType>(),
  platformId: text("platform_id").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserPlatformIdSchema = createInsertSchema(userPlatformIds).omit({
  id: true,
  createdAt: true,
});

export type UserPlatformId = typeof userPlatformIds.$inferSelect;
export type InsertUserPlatformId = z.infer<typeof insertUserPlatformIdSchema>;

// OTP Codes - for email-based authentication
export const otpCodes = pgTable("otp_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OtpCode = typeof otpCodes.$inferSelect;

// Folders - represents content categories like "Android", "Apple", "AI"
export const folders = pgTable("folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3b82f6"),
  isBackgroundActive: boolean("is_background_active").default(false).notNull(),
  refreshInterval: real("refresh_interval").default(60).notNull(),
  notifySlack: boolean("notify_slack").default(true).notNull(),
  notifyTelegram: boolean("notify_telegram").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const foldersRelations = relations(folders, ({ many }) => ({
  sources: many(sources),
  content: many(content),
  ideas: many(ideas),
}));

// Sources - news websites, YouTube channels, X accounts, RSS feeds within folders
export const sourceTypes = ["rss", "website", "youtube", "twitter", "tiktok"] as const;
export type SourceType = typeof sourceTypes[number];

export const sources = pgTable("sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  folderId: varchar("folder_id").notNull().references(() => folders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull().$type<SourceType>(),
  isActive: boolean("is_active").default(true).notNull(),
  lastFetched: timestamp("last_fetched"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  folder: one(folders, {
    fields: [sources.folderId],
    references: [folders.id],
  }),
  content: many(content),
}));

// Content - fetched news/articles from sources
export const sentimentTypes = ["positive", "negative", "neutral"] as const;
export type SentimentType = typeof sentimentTypes[number];

export const content = pgTable("content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  folderId: varchar("folder_id").notNull().references(() => folders.id, { onDelete: "cascade" }),
  sourceId: varchar("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary"),
  arabicSummary: text("arabic_summary"),
  arabicTitle: text("arabic_title"),
  arabicFullSummary: text("arabic_full_summary"),
  originalUrl: text("original_url").notNull(),
  imageUrl: text("image_url"),
  publishedAt: timestamp("published_at"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  sentiment: text("sentiment").$type<SentimentType>(),
  sentimentScore: integer("sentiment_score"),
  keywords: text("keywords").array(),
  notifiedAt: timestamp("notified_at"),
  rewrittenContent: text("rewritten_content"),
  usedForIdeas: boolean("used_for_ideas").default(false).notNull(),
  readAt: timestamp("read_at"),
});

export const contentRelations = relations(content, ({ one }) => ({
  folder: one(folders, {
    fields: [content.folderId],
    references: [folders.id],
  }),
  source: one(sources, {
    fields: [content.sourceId],
    references: [sources.id],
  }),
}));

// Ideas - generated video ideas with workflow states
export const ideaStatuses = [
  "raw_idea",
  "needs_research",
  "ready_for_script",
  "script_in_progress",
  "ready_for_filming",
  "completed"
] as const;
export type IdeaStatus = typeof ideaStatuses[number];

export const ideas = pgTable("ideas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  folderId: varchar("folder_id").references(() => folders.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default(""),
  status: text("status").notNull().$type<IdeaStatus>().default("raw_idea"),
  estimatedDuration: text("estimated_duration"),
  targetAudience: text("target_audience"),
  notes: text("notes"),
  thumbnailText: text("thumbnail_text"),
  script: text("script"),
  sourceContentIds: text("source_content_ids").array(),
  sourceContentTitles: text("source_content_titles").array(),
  sourceContentUrls: text("source_content_urls").array(),
  templateId: varchar("template_id"),
  scheduledDate: timestamp("scheduled_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ideasRelations = relations(ideas, ({ one, many }) => ({
  user: one(users, {
    fields: [ideas.userId],
    references: [users.id],
  }),
  folder: one(folders, {
    fields: [ideas.folderId],
    references: [folders.id],
  }),
  comments: many(ideaComments),
  assignments: many(ideaAssignments),
}));

// Idea Comments - comment threads on ideas
export const ideaComments = pgTable("idea_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ideaCommentsRelations = relations(ideaComments, ({ one }) => ({
  idea: one(ideas, {
    fields: [ideaComments.ideaId],
    references: [ideas.id],
  }),
}));

// Idea Assignments - team member assignments for ideas
export const ideaAssignments = pgTable("idea_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  assigneeName: text("assignee_name").notNull(),
  role: text("role"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ideaAssignmentsRelations = relations(ideaAssignments, ({ one }) => ({
  idea: one(ideas, {
    fields: [ideaAssignments.ideaId],
    references: [ideas.id],
  }),
}));

// Insert schemas
export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertSourceSchema = createInsertSchema(sources).omit({
  id: true,
  createdAt: true,
  lastFetched: true,
});

export const insertContentSchema = createInsertSchema(content).omit({
  id: true,
  fetchedAt: true,
  notifiedAt: true,
  rewrittenContent: true,
});

export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  userId: z.string().optional(),
});

export const updateIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  createdAt: true,
}).partial();

export const insertIdeaCommentSchema = createInsertSchema(ideaComments).omit({
  id: true,
  createdAt: true,
});

export const insertIdeaAssignmentSchema = createInsertSchema(ideaAssignments).omit({
  id: true,
  createdAt: true,
});

// Types
export type Folder = typeof folders.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;

export type Source = typeof sources.$inferSelect;
export type InsertSource = z.infer<typeof insertSourceSchema>;

export type Content = typeof content.$inferSelect;
export type InsertContent = z.infer<typeof insertContentSchema>;

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type UpdateIdea = z.infer<typeof updateIdeaSchema>;

export type IdeaComment = typeof ideaComments.$inferSelect;
export type InsertIdeaComment = z.infer<typeof insertIdeaCommentSchema>;

export type IdeaAssignment = typeof ideaAssignments.$inferSelect;
export type InsertIdeaAssignment = z.infer<typeof insertIdeaAssignmentSchema>;

// Assistant Conversations - persistent chat sessions
export const assistantConversations = pgTable("assistant_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("محادثة جديدة"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const assistantMessages = pgTable("assistant_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => assistantConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull().$type<"user" | "assistant">(),
  content: text("content").notNull(),
  action: text("action"),
  statusLabel: text("status_label"),
  metadata: jsonb("metadata").$type<Record<string, any> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAssistantConversationSchema = createInsertSchema(assistantConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssistantMessageSchema = createInsertSchema(assistantMessages).omit({
  id: true,
  createdAt: true,
});

export type AssistantConversation = typeof assistantConversations.$inferSelect;
export type InsertAssistantConversation = z.infer<typeof insertAssistantConversationSchema>;
export type AssistantMessage = typeof assistantMessages.$inferSelect;
export type InsertAssistantMessage = z.infer<typeof insertAssistantMessageSchema>;

// Prompt Templates - custom AI prompt templates for idea generation
export const promptTemplates = pgTable("prompt_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  promptContent: text("prompt_content").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  defaultCount: integer("default_count").default(2).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPromptTemplateSchema = createInsertSchema(promptTemplates).omit({
  id: true,
  userId: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePromptTemplateSchema = createInsertSchema(promptTemplates).omit({
  id: true,
  userId: true,
  isDefault: true,
  createdAt: true,
}).partial();

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;
export type UpdatePromptTemplate = z.infer<typeof updatePromptTemplateSchema>;

// Settings - key-value configuration store, scoped per user
export const settings = pgTable("settings", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  key: varchar("key").notNull(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.key], name: "settings_pkey" }),
}));

export const insertSettingSchema = createInsertSchema(settings);
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type SettingKey = string;

// Style Examples - past successful video ideas for AI learning
export const styleExamples = pgTable("style_examples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  thumbnailText: text("thumbnail_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStyleExampleSchema = createInsertSchema(styleExamples).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type StyleExample = typeof styleExamples.$inferSelect;
export type InsertStyleExample = z.infer<typeof insertStyleExampleSchema>;
