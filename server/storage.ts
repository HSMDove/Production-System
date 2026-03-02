import { eq, and, desc, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  folders,
  sources,
  content,
  ideas,
  users,
  promptTemplates,
  ideaComments,
  ideaAssignments,
  type Folder,
  type InsertFolder,
  type Source,
  type InsertSource,
  type Content,
  type InsertContent,
  type Idea,
  type InsertIdea,
  type UpdateIdea,
  type User,
  type InsertUser,
  type PromptTemplate,
  type InsertPromptTemplate,
  type UpdatePromptTemplate,
  type IdeaComment,
  type InsertIdeaComment,
  type IdeaAssignment,
  type InsertIdeaAssignment,
  type SentimentType,
  settings,
  type Setting,
  type InsertSetting,
  styleExamples,
  type StyleExample,
  type InsertStyleExample,
  assistantConversations,
  assistantMessages,
  type AssistantConversation,
  type InsertAssistantConversation,
  type AssistantMessage,
  type InsertAssistantMessage,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllFolders(): Promise<Folder[]>;
  getFolderById(id: string): Promise<Folder | undefined>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(id: string, folder: Partial<InsertFolder>): Promise<Folder | undefined>;
  deleteFolder(id: string): Promise<boolean>;
  
  getSourcesByFolderId(folderId: string): Promise<Source[]>;
  getSourceById(id: string): Promise<Source | undefined>;
  createSource(source: InsertSource): Promise<Source>;
  updateSource(id: string, source: Partial<InsertSource>): Promise<Source | undefined>;
  deleteSource(id: string): Promise<boolean>;
  
  getAllContent(): Promise<Content[]>;
  getContentByFolderId(folderId: string): Promise<Content[]>;
  getContentBySourceId(sourceId: string): Promise<Content[]>;
  getContentById(id: string): Promise<Content | undefined>;
  createContent(contentItem: InsertContent): Promise<Content>;
  createContentIfNotExists(contentItem: InsertContent): Promise<Content | null>;
  deleteContentBySourceId(sourceId: string): Promise<boolean>;
  updateContentSentiment(id: string, sentiment: SentimentType, sentimentScore: number, keywords: string[]): Promise<Content | undefined>;
  updateContentArabicSummary(id: string, arabicSummary: string): Promise<Content | undefined>;
  updateContentTranslation(id: string, arabicTitle: string, arabicFullSummary: string): Promise<Content | undefined>;
  getUnanalyzedContent(limit?: number): Promise<Content[]>;
  
  getAllSources(): Promise<Source[]>;
  
  getAllIdeas(): Promise<Idea[]>;
  getIdeasByFolderId(folderId: string): Promise<Idea[]>;
  getIdeaById(id: string): Promise<Idea | undefined>;
  createIdea(idea: InsertIdea): Promise<Idea>;
  updateIdea(id: string, idea: UpdateIdea): Promise<Idea | undefined>;
  deleteIdea(id: string): Promise<boolean>;
  
  getAllPromptTemplates(): Promise<PromptTemplate[]>;
  getPromptTemplateById(id: string): Promise<PromptTemplate | undefined>;
  getDefaultPromptTemplate(): Promise<PromptTemplate | undefined>;
  createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate>;
  updatePromptTemplate(id: string, template: UpdatePromptTemplate): Promise<PromptTemplate | undefined>;
  deletePromptTemplate(id: string): Promise<boolean>;
  setDefaultPromptTemplate(id: string): Promise<PromptTemplate | undefined>;
  
  getCommentsByIdeaId(ideaId: string): Promise<IdeaComment[]>;
  createComment(comment: InsertIdeaComment): Promise<IdeaComment>;
  deleteComment(id: string): Promise<boolean>;
  
  getAssignmentsByIdeaId(ideaId: string): Promise<IdeaAssignment[]>;
  createAssignment(assignment: InsertIdeaAssignment): Promise<IdeaAssignment>;
  deleteAssignment(id: string): Promise<boolean>;

  getSetting(key: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;
  upsertSetting(key: string, value: string | null): Promise<Setting>;
  upsertSettings(entries: Record<string, string | null>): Promise<Setting[]>;

  getUnnotifiedContent(): Promise<Content[]>;
  markContentNotified(id: string): Promise<Content | undefined>;
  updateContentRewrite(id: string, rewrittenContent: string): Promise<Content | undefined>;
  
  getUnusedContentByFolderId(folderId: string): Promise<Content[]>;
  markContentUsedForIdeas(ids: string[]): Promise<void>;
  markContentRead(id: string): Promise<Content | undefined>;



  getAssistantConversations(): Promise<AssistantConversation[]>;
  getAssistantConversationById(id: string): Promise<AssistantConversation | undefined>;
  createAssistantConversation(conversation: InsertAssistantConversation): Promise<AssistantConversation>;
  updateAssistantConversation(id: string, patch: Partial<InsertAssistantConversation>): Promise<AssistantConversation | undefined>;
  deleteAssistantConversation(id: string): Promise<boolean>;
  getAssistantMessagesByConversationId(conversationId: string): Promise<AssistantMessage[]>;
  createAssistantMessage(message: InsertAssistantMessage): Promise<AssistantMessage>;

    getAllStyleExamples(): Promise<StyleExample[]>;
  createStyleExample(example: InsertStyleExample): Promise<StyleExample>;
  deleteStyleExample(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllFolders(): Promise<Folder[]> {
    return db.select().from(folders).orderBy(folders.createdAt);
  }

  async getFolderById(id: string): Promise<Folder | undefined> {
    const [folder] = await db.select().from(folders).where(eq(folders.id, id));
    return folder;
  }

  async createFolder(folder: InsertFolder): Promise<Folder> {
    const [created] = await db.insert(folders).values(folder).returning();
    return created;
  }

  async updateFolder(id: string, folder: Partial<InsertFolder>): Promise<Folder | undefined> {
    const [updated] = await db.update(folders).set(folder).where(eq(folders.id, id)).returning();
    return updated;
  }

  async deleteFolder(id: string): Promise<boolean> {
    const deleted = await db.delete(folders).where(eq(folders.id, id)).returning();
    return deleted.length > 0;
  }

  async getSourcesByFolderId(folderId: string): Promise<Source[]> {
    return db.select().from(sources).where(eq(sources.folderId, folderId)).orderBy(sources.createdAt);
  }

  async getSourceById(id: string): Promise<Source | undefined> {
    const [source] = await db.select().from(sources).where(eq(sources.id, id));
    return source;
  }

  async createSource(source: InsertSource): Promise<Source> {
    const [created] = await db.insert(sources).values(source as any).returning();
    return created;
  }

  async updateSource(id: string, source: Partial<InsertSource>): Promise<Source | undefined> {
    const [updated] = await db.update(sources).set(source as any).where(eq(sources.id, id)).returning();
    return updated;
  }

  async deleteSource(id: string): Promise<boolean> {
    const deleted = await db.delete(sources).where(eq(sources.id, id)).returning();
    return deleted.length > 0;
  }

  async getAllContent(): Promise<Content[]> {
    return db.select().from(content).orderBy(content.fetchedAt);
  }

  async getContentByFolderId(folderId: string): Promise<Content[]> {
    return db.select().from(content).where(eq(content.folderId, folderId)).orderBy(desc(content.publishedAt), desc(content.fetchedAt));
  }

  async getAllSources(): Promise<Source[]> {
    return db.select().from(sources).orderBy(sources.createdAt);
  }

  async getContentBySourceId(sourceId: string): Promise<Content[]> {
    return db.select().from(content).where(eq(content.sourceId, sourceId)).orderBy(content.fetchedAt);
  }

  async createContent(contentItem: InsertContent): Promise<Content> {
    const [created] = await db.insert(content).values(contentItem as any).returning();
    return created;
  }

  async createContentIfNotExists(contentItem: InsertContent): Promise<Content | null> {
    const [existing] = await db.select().from(content).where(
      and(
        eq(content.sourceId, contentItem.sourceId),
        eq(content.originalUrl, contentItem.originalUrl)
      )
    );
    if (existing) {
      return null;
    }
    const [created] = await db.insert(content).values(contentItem as any).returning();
    return created;
  }

  async deleteContentBySourceId(sourceId: string): Promise<boolean> {
    const deleted = await db.delete(content).where(eq(content.sourceId, sourceId)).returning();
    return deleted.length > 0;
  }

  async getContentById(id: string): Promise<Content | undefined> {
    const [item] = await db.select().from(content).where(eq(content.id, id));
    return item;
  }

  async updateContentSentiment(
    id: string,
    sentiment: SentimentType,
    sentimentScore: number,
    keywords: string[]
  ): Promise<Content | undefined> {
    const [updated] = await db
      .update(content)
      .set({ sentiment, sentimentScore, keywords })
      .where(eq(content.id, id))
      .returning();
    return updated;
  }

  async updateContentArabicSummary(id: string, arabicSummary: string): Promise<Content | undefined> {
    const [updated] = await db
      .update(content)
      .set({ arabicSummary })
      .where(eq(content.id, id))
      .returning();
    return updated;
  }

  async updateContentTranslation(id: string, arabicTitle: string, arabicFullSummary: string): Promise<Content | undefined> {
    const [updated] = await db
      .update(content)
      .set({ arabicTitle, arabicFullSummary })
      .where(eq(content.id, id))
      .returning();
    return updated;
  }

  async getUnanalyzedContent(limit: number = 20): Promise<Content[]> {
    return db
      .select()
      .from(content)
      .where(isNull(content.sentiment))
      .orderBy(desc(content.fetchedAt))
      .limit(limit);
  }

  async getAllIdeas(): Promise<Idea[]> {
    return db.select().from(ideas).orderBy(ideas.createdAt);
  }

  async getIdeasByFolderId(folderId: string): Promise<Idea[]> {
    return db.select().from(ideas).where(eq(ideas.folderId, folderId)).orderBy(ideas.createdAt);
  }

  async getIdeaById(id: string): Promise<Idea | undefined> {
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
    return idea;
  }

  async createIdea(idea: InsertIdea): Promise<Idea> {
    const [created] = await db.insert(ideas).values(idea as any).returning();
    return created;
  }

  async updateIdea(id: string, idea: UpdateIdea): Promise<Idea | undefined> {
    const [updated] = await db.update(ideas).set({ ...idea, updatedAt: new Date() } as any).where(eq(ideas.id, id)).returning();
    return updated;
  }

  async deleteIdea(id: string): Promise<boolean> {
    const deleted = await db.delete(ideas).where(eq(ideas.id, id)).returning();
    return deleted.length > 0;
  }

  async getAllPromptTemplates(): Promise<PromptTemplate[]> {
    return db.select().from(promptTemplates).orderBy(promptTemplates.createdAt);
  }

  async getPromptTemplateById(id: string): Promise<PromptTemplate | undefined> {
    const [template] = await db.select().from(promptTemplates).where(eq(promptTemplates.id, id));
    return template;
  }

  async getDefaultPromptTemplate(): Promise<PromptTemplate | undefined> {
    const [template] = await db.select().from(promptTemplates).where(eq(promptTemplates.isDefault, true));
    return template;
  }

  async createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate> {
    const [created] = await db.insert(promptTemplates).values(template).returning();
    return created;
  }

  async updatePromptTemplate(id: string, template: UpdatePromptTemplate): Promise<PromptTemplate | undefined> {
    const [updated] = await db.update(promptTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(promptTemplates.id, id))
      .returning();
    return updated;
  }

  async deletePromptTemplate(id: string): Promise<boolean> {
    const deleted = await db.delete(promptTemplates).where(eq(promptTemplates.id, id)).returning();
    return deleted.length > 0;
  }

  async setDefaultPromptTemplate(id: string): Promise<PromptTemplate | undefined> {
    await db.update(promptTemplates).set({ isDefault: false }).where(eq(promptTemplates.isDefault, true));
    const [updated] = await db.update(promptTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(promptTemplates.id, id))
      .returning();
    return updated;
  }

  async getCommentsByIdeaId(ideaId: string): Promise<IdeaComment[]> {
    return db.select().from(ideaComments).where(eq(ideaComments.ideaId, ideaId)).orderBy(desc(ideaComments.createdAt));
  }

  async createComment(comment: InsertIdeaComment): Promise<IdeaComment> {
    const [created] = await db.insert(ideaComments).values(comment).returning();
    return created;
  }

  async deleteComment(id: string): Promise<boolean> {
    const deleted = await db.delete(ideaComments).where(eq(ideaComments.id, id)).returning();
    return deleted.length > 0;
  }

  async getAssignmentsByIdeaId(ideaId: string): Promise<IdeaAssignment[]> {
    return db.select().from(ideaAssignments).where(eq(ideaAssignments.ideaId, ideaId)).orderBy(ideaAssignments.createdAt);
  }

  async createAssignment(assignment: InsertIdeaAssignment): Promise<IdeaAssignment> {
    const [created] = await db.insert(ideaAssignments).values(assignment).returning();
    return created;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    const deleted = await db.delete(ideaAssignments).where(eq(ideaAssignments.id, id)).returning();
    return deleted.length > 0;
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async getAllSettings(): Promise<Setting[]> {
    return db.select().from(settings);
  }

  async upsertSetting(key: string, value: string | null): Promise<Setting> {
    const [result] = await db
      .insert(settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      })
      .returning();
    return result;
  }

  async upsertSettings(entries: Record<string, string | null>): Promise<Setting[]> {
    const results: Setting[] = [];
    for (const [key, value] of Object.entries(entries)) {
      const result = await this.upsertSetting(key, value);
      results.push(result);
    }
    return results;
  }

  async getUnnotifiedContent(): Promise<Content[]> {
    return db
      .select()
      .from(content)
      .where(isNull(content.notifiedAt))
      .orderBy(desc(content.fetchedAt));
  }

  async markContentNotified(id: string): Promise<Content | undefined> {
    const [updated] = await db
      .update(content)
      .set({ notifiedAt: new Date() })
      .where(eq(content.id, id))
      .returning();
    return updated;
  }

  async updateContentRewrite(id: string, rewrittenContent: string): Promise<Content | undefined> {
    const [updated] = await db
      .update(content)
      .set({ rewrittenContent })
      .where(eq(content.id, id))
      .returning();
    return updated;
  }

  async getUnusedContentByFolderId(folderId: string): Promise<Content[]> {
    return db
      .select()
      .from(content)
      .where(and(eq(content.folderId, folderId), eq(content.usedForIdeas, false)))
      .orderBy(desc(content.fetchedAt));
  }

  async markContentUsedForIdeas(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { inArray } = await import("drizzle-orm");
    await db
      .update(content)
      .set({ usedForIdeas: true })
      .where(inArray(content.id, ids));
  }

  async markContentRead(id: string): Promise<Content | undefined> {
    const [updated] = await db
      .update(content)
      .set({ readAt: new Date() })
      .where(eq(content.id, id))
      .returning();
    return updated;
  }



  async getAssistantConversations(): Promise<AssistantConversation[]> {
    return db.select().from(assistantConversations).orderBy(desc(assistantConversations.updatedAt));
  }

  async getAssistantConversationById(id: string): Promise<AssistantConversation | undefined> {
    const [conversation] = await db.select().from(assistantConversations).where(eq(assistantConversations.id, id));
    return conversation;
  }

  async createAssistantConversation(conversation: InsertAssistantConversation): Promise<AssistantConversation> {
    const [created] = await db.insert(assistantConversations).values(conversation).returning();
    return created;
  }

  async updateAssistantConversation(id: string, patch: Partial<InsertAssistantConversation>): Promise<AssistantConversation | undefined> {
    const [updated] = await db
      .update(assistantConversations)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(assistantConversations.id, id))
      .returning();
    return updated;
  }

  async deleteAssistantConversation(id: string): Promise<boolean> {
    const deleted = await db
      .delete(assistantConversations)
      .where(eq(assistantConversations.id, id))
      .returning();
    return deleted.length > 0;
  }

  async getAssistantMessagesByConversationId(conversationId: string): Promise<AssistantMessage[]> {
    return db
      .select()
      .from(assistantMessages)
      .where(eq(assistantMessages.conversationId, conversationId))
      .orderBy(assistantMessages.createdAt);
  }

  async createAssistantMessage(message: InsertAssistantMessage): Promise<AssistantMessage> {
    const [created] = await db.insert(assistantMessages).values({ ...message, role: message.role as "user" | "assistant", metadata: (message as any).metadata ?? null }).returning();
    await db
      .update(assistantConversations)
      .set({ updatedAt: new Date() })
      .where(eq(assistantConversations.id, message.conversationId));
    return created;
  }

    async getAllStyleExamples(): Promise<StyleExample[]> {
    return db.select().from(styleExamples).orderBy(desc(styleExamples.createdAt));
  }

  async createStyleExample(example: InsertStyleExample): Promise<StyleExample> {
    const [created] = await db.insert(styleExamples).values(example).returning();
    return created;
  }

  async deleteStyleExample(id: string): Promise<boolean> {
    const result = await db.delete(styleExamples).where(eq(styleExamples.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();
