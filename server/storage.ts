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
    return db.select().from(content).where(eq(content.folderId, folderId)).orderBy(content.fetchedAt);
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
}

export const storage = new DatabaseStorage();
