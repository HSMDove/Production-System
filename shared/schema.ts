import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Folders - represents content categories like "Android", "Apple", "AI"
export const folders = pgTable("folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3b82f6"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const foldersRelations = relations(folders, ({ many }) => ({
  sources: many(sources),
  content: many(content),
  ideas: many(ideas),
}));

// Sources - news websites, YouTube channels, X accounts, RSS feeds within folders
export const sourceTypes = ["rss", "website", "youtube", "twitter"] as const;
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
export const content = pgTable("content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  folderId: varchar("folder_id").notNull().references(() => folders.id, { onDelete: "cascade" }),
  sourceId: varchar("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary"),
  originalUrl: text("original_url").notNull(),
  imageUrl: text("image_url"),
  publishedAt: timestamp("published_at"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
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

export const ideaCategories = [
  "thalathiyat",
  "leh",
  "tech_i_use",
  "news_roundup",
  "deep_dive",
  "comparison",
  "tutorial",
  "other"
] as const;
export type IdeaCategory = typeof ideaCategories[number];

export const ideas = pgTable("ideas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  folderId: varchar("folder_id").references(() => folders.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().$type<IdeaCategory>(),
  status: text("status").notNull().$type<IdeaStatus>().default("raw_idea"),
  estimatedDuration: text("estimated_duration"),
  targetAudience: text("target_audience"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ideasRelations = relations(ideas, ({ one }) => ({
  folder: one(folders, {
    fields: [ideas.folderId],
    references: [folders.id],
  }),
}));

// Insert schemas
export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,
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
});

export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  createdAt: true,
}).partial();

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

// Keep users table for compatibility
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
