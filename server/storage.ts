import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  folders,
  sources,
  content,
  ideas,
  users,
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
  
  getContentByFolderId(folderId: string): Promise<Content[]>;
  getContentBySourceId(sourceId: string): Promise<Content[]>;
  createContent(contentItem: InsertContent): Promise<Content>;
  createContentIfNotExists(contentItem: InsertContent): Promise<Content | null>;
  deleteContentBySourceId(sourceId: string): Promise<boolean>;
  
  getAllIdeas(): Promise<Idea[]>;
  getIdeasByFolderId(folderId: string): Promise<Idea[]>;
  getIdeaById(id: string): Promise<Idea | undefined>;
  createIdea(idea: InsertIdea): Promise<Idea>;
  updateIdea(id: string, idea: UpdateIdea): Promise<Idea | undefined>;
  deleteIdea(id: string): Promise<boolean>;
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
    const [created] = await db.insert(sources).values(source).returning();
    return created;
  }

  async updateSource(id: string, source: Partial<InsertSource>): Promise<Source | undefined> {
    const [updated] = await db.update(sources).set(source).where(eq(sources.id, id)).returning();
    return updated;
  }

  async deleteSource(id: string): Promise<boolean> {
    const deleted = await db.delete(sources).where(eq(sources.id, id)).returning();
    return deleted.length > 0;
  }

  async getContentByFolderId(folderId: string): Promise<Content[]> {
    return db.select().from(content).where(eq(content.folderId, folderId)).orderBy(content.fetchedAt);
  }

  async getContentBySourceId(sourceId: string): Promise<Content[]> {
    return db.select().from(content).where(eq(content.sourceId, sourceId)).orderBy(content.fetchedAt);
  }

  async createContent(contentItem: InsertContent): Promise<Content> {
    const [created] = await db.insert(content).values(contentItem).returning();
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
    const [created] = await db.insert(content).values(contentItem).returning();
    return created;
  }

  async deleteContentBySourceId(sourceId: string): Promise<boolean> {
    const deleted = await db.delete(content).where(eq(content.sourceId, sourceId)).returning();
    return deleted.length > 0;
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
    const [created] = await db.insert(ideas).values(idea).returning();
    return created;
  }

  async updateIdea(id: string, idea: UpdateIdea): Promise<Idea | undefined> {
    const [updated] = await db.update(ideas).set({ ...idea, updatedAt: new Date() }).where(eq(ideas.id, id)).returning();
    return updated;
  }

  async deleteIdea(id: string): Promise<boolean> {
    const deleted = await db.delete(ideas).where(eq(ideas.id, id)).returning();
    return deleted.length > 0;
  }
}

export const storage = new DatabaseStorage();
