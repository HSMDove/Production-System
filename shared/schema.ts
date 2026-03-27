import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, real, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Admin Role Types (needed before users table)
export const adminRoles = ["super_admin", "admin"] as const;
export type AdminRole = typeof adminRoles[number];

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
  isAdmin: boolean("is_admin").default(false).notNull(),
  adminRole: text("admin_role").$type<AdminRole>(),
  adminPasswordHash: text("admin_password_hash"),
  lastActiveAt: timestamp("last_active_at"),
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
  emoji: text("emoji").default("📁"),
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

export const processingStatuses = ["processing", "ready", "failed"] as const;
export type ProcessingStatus = typeof processingStatuses[number];

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
  displayedToUser: boolean("displayed_to_user").default(true).notNull(),
  processingStatus: text("processing_status").$type<ProcessingStatus>().default("ready").notNull(),
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

// Training Samples - user-uploaded scripts/content for style analysis
export const trainingSampleTypes = ["text", "script", "description", "notes"] as const;
export type TrainingSampleType = typeof trainingSampleTypes[number];

export const trainingSamples = pgTable("training_samples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sampleTitle: text("sample_title").notNull(),
  contentType: text("content_type").notNull().$type<TrainingSampleType>(),
  textContent: text("text_content").notNull(),
  extractedStyle: text("extracted_style"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTrainingSampleSchema = createInsertSchema(trainingSamples).omit({
  id: true,
  userId: true,
  extractedStyle: true,
  createdAt: true,
});

export type TrainingSample = typeof trainingSamples.$inferSelect;
export type InsertTrainingSample = z.infer<typeof insertTrainingSampleSchema>;

// System Settings - global admin-controlled settings (feature flags, default API config)
export const systemSettings = pgTable("system_settings", {
  key: varchar("key").primaryKey(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;

// API Usage Logs - tracks every AI/Search request per user
export const apiRequestTypes = ["ai_chat", "ai_rewrite", "ai_ideas", "ai_explain", "ai_translate", "ai_summary", "ai_smart_view", "ai_sentiment", "ai_trends", "web_search"] as const;
export type ApiRequestType = typeof apiRequestTypes[number];

export const apiProviderTypes = [
  "system_default",
  "custom_api",
  "system_openai",
  "system_openrouter",
  "system_gemini",
  "system_brave",
  "system_perplexity",
  "user_custom_api",
  "user_local",
  "user_custom_search",
] as const;
export type ApiProviderType = typeof apiProviderTypes[number];

export const apiUsageLogs = pgTable("api_usage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  requestType: text("request_type").notNull().$type<ApiRequestType>(),
  providerUsed: text("provider_used").notNull().$type<ApiProviderType>(),
  model: text("model"),
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
  tokensUsed: integer("tokens_used"),
  responseTimeMs: integer("response_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;
export type InsertApiUsageLog = typeof apiUsageLogs.$inferInsert;

// Integration Channels — multiple Slack/Telegram bots per user
export const integrationPlatforms = ["slack", "telegram"] as const;
export type IntegrationPlatform = typeof integrationPlatforms[number];

export const integrationChannels = pgTable("integration_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull().$type<IntegrationPlatform>(),
  name: text("name").notNull(),
  credentials: jsonb("credentials").notNull().$type<Record<string, string>>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIntegrationChannelSchema = createInsertSchema(integrationChannels).omit({
  id: true,
  createdAt: true,
});

export type IntegrationChannel = typeof integrationChannels.$inferSelect;
export type InsertIntegrationChannel = z.infer<typeof insertIntegrationChannelSchema>;

// Folder-Channel Mappings — route folder updates to specific channels
export const folderChannelMappings = pgTable("folder_channel_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  folderId: varchar("folder_id").notNull().references(() => folders.id, { onDelete: "cascade" }),
  integrationChannelId: varchar("integration_channel_id").notNull().references(() => integrationChannels.id, { onDelete: "cascade" }),
  targetId: text("target_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFolderChannelMappingSchema = createInsertSchema(folderChannelMappings).omit({
  id: true,
  createdAt: true,
});

export type FolderChannelMapping = typeof folderChannelMappings.$inferSelect;
export type InsertFolderChannelMapping = z.infer<typeof insertFolderChannelMappingSchema>;

// ─── Admin System ────────────────────────────────────────────────────────────

export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  body: text("body").notNull(),
  imageUrl: text("image_url"),
  icon: text("icon"),
  isActive: boolean("is_active").default(true).notNull(),
  maxViews: integer("max_views").default(1).notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

export const announcementViews = pgTable("announcement_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  announcementId: varchar("announcement_id").notNull().references(() => announcements.id, { onDelete: "cascade" }),
  viewCount: integer("view_count").default(0).notNull(),
  lastViewedAt: timestamp("last_viewed_at").defaultNow().notNull(),
});
export type AnnouncementView = typeof announcementViews.$inferSelect;

export const topBanners = pgTable("top_banners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  linkUrl: text("link_url"),
  linkText: text("link_text"),
  bgColor: text("bg_color").default("#3b82f6"),
  isActive: boolean("is_active").default(false).notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertTopBannerSchema = createInsertSchema(topBanners).omit({
  id: true,
  createdAt: true,
});
export type TopBanner = typeof topBanners.$inferSelect;
export type InsertTopBanner = z.infer<typeof insertTopBannerSchema>;

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

// ─── Support Tickets ─────────────────────────────────────────────────────────

// ─── Welcome Cards ───────────────────────────────────────────────────────────

export const welcomeCards = pgTable("welcome_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sortOrder: integer("sort_order").notNull().default(0),
  title: text("title").notNull(),
  body: text("body").notNull(),
  emoji: text("emoji"),
  showUserName: boolean("show_user_name").notNull().default(false),
  isFinal: boolean("is_final").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type WelcomeCard = typeof welcomeCards.$inferSelect;

export const welcomeCardViews = pgTable("welcome_card_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});
export type WelcomeCardView = typeof welcomeCardViews.$inferSelect;

// ─── Support Tickets ─────────────────────────────────────────────────────────

export const ticketStatuses = ["open", "in_progress", "resolved", "cancelled"] as const;
export type TicketStatus = typeof ticketStatuses[number];

export const ticketCategories = ["complaint", "suggestion"] as const;
export type TicketCategory = typeof ticketCategories[number];

export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ticketNumber: integer("ticket_number").unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrls: text("image_urls").array(),
  category: text("category").notNull().$type<TicketCategory>().default("complaint"),
  status: text("status").notNull().$type<TicketStatus>().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  ticketNumber: true,
  createdAt: true,
  updatedAt: true,
});
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

export const ticketReplies = pgTable("ticket_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type TicketReply = typeof ticketReplies.$inferSelect;
