import { eq, and, desc, isNull, gt } from "drizzle-orm";
import crypto from "crypto";
import { db } from "./db";
import {
  folders,
  sources,
  content,
  ideas,
  users,
  otpCodes,
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
  type OtpCode,
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
  userPlatformIds,
  type UserPlatformId,
  type PlatformType,
  systemSettings,
  type SystemSetting,
  apiUsageLogs,
  type ApiUsageLog,
  type InsertApiUsageLog,
  trainingSamples,
  type TrainingSample,
  type InsertTrainingSample,
  type TrainingSampleType,
  integrationChannels,
  type IntegrationChannel,
  type InsertIntegrationChannel,
  folderChannelMappings,
  type FolderChannelMapping,
  type InsertFolderChannelMapping,
  announcements,
  type Announcement,
  type InsertAnnouncement,
  announcementViews,
  type AnnouncementView,
  topBanners,
  type TopBanner,
  type InsertTopBanner,
  adminAuditLogs,
  type AdminAuditLog,
  type AdminRole,
  welcomeCards,
  type WelcomeCard,
  welcomeCardViews,
  type WelcomeCardView,
  supportTickets,
  type SupportTicket,
  type InsertSupportTicket,
  type TicketStatus,
  type TicketCategory,
  ticketReplies,
  type TicketReply,
} from "@shared/schema";

const ENCRYPTED_PREFIX = "enc:v1:";
const SENSITIVE_SETTING_KEYS = new Set([
  "ai_custom_api_key",
  "llm_api_key",
  "web_search_api_key",
  "telegram_bot_token",
  "slack_webhook_url",
  "slack_bot_token",
  "slack_signing_secret",
]);

function getEncryptionKey(): Buffer {
  const source = process.env.SETTINGS_ENCRYPTION_KEY || process.env.SESSION_SECRET || "fallback-secret-change-in-production";
  return crypto.createHash("sha256").update(source).digest();
}

function encryptIfSensitive(key: string, value: string | null): string | null {
  if (value === null || !SENSITIVE_SETTING_KEYS.has(key)) return value;
  if (value.startsWith(ENCRYPTED_PREFIX)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptIfNeeded(key: string, value: string | null): string | null {
  if (value === null) return null;
  if (!SENSITIVE_SETTING_KEYS.has(key)) return value;
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;

  try {
    const payload = value.slice(ENCRYPTED_PREFIX.length);
    const [ivB64, tagB64, dataB64] = payload.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

function encryptRawValue(value: string): string {
  if (value.startsWith(ENCRYPTED_PREFIX)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptRawValue(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;
  try {
    const payload = value.slice(ENCRYPTED_PREFIX.length);
    const [ivB64, tagB64, dataB64] = payload.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return value;
  }
}

export interface IStorage {
  // Auth / Users
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserBySlackUserId(slackUserId: string): Promise<User | undefined>;
  createUser(user: Partial<InsertUser>): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  // OTP
  createOTP(email: string, code: string, expiresAt: Date): Promise<OtpCode>;
  getValidOTP(email: string, code: string): Promise<OtpCode | undefined>;
  markOTPUsed(id: string): Promise<void>;
  invalidateOTPsForEmail(email: string): Promise<void>;

  // Folders (user-scoped)
  getAllFolders(userId: string): Promise<Folder[]>;
  getAllFoldersSystem(): Promise<Folder[]>;
  getFolderById(id: string): Promise<Folder | undefined>;
  getFolderByContentId(contentId: string): Promise<Folder | undefined>;
  createFolder(folder: InsertFolder & { userId: string }): Promise<Folder>;
  updateFolder(id: string, folder: Partial<InsertFolder>): Promise<Folder | undefined>;
  deleteFolder(id: string): Promise<boolean>;

  getSourcesByFolderId(folderId: string): Promise<Source[]>;
  getSourceById(id: string): Promise<Source | undefined>;
  createSource(source: InsertSource): Promise<Source>;
  updateSource(id: string, source: Partial<InsertSource>): Promise<Source | undefined>;
  deleteSource(id: string): Promise<boolean>;

  getAllContent(userId: string): Promise<Content[]>;
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

  getAllIdeas(userId: string): Promise<Idea[]>;
  getIdeasByFolderId(folderId: string): Promise<Idea[]>;
  getIdeaById(id: string): Promise<Idea | undefined>;
  createIdea(idea: InsertIdea & { userId: string }): Promise<Idea>;
  updateIdea(id: string, idea: UpdateIdea): Promise<Idea | undefined>;
  deleteIdea(id: string): Promise<boolean>;

  getAllPromptTemplates(userId: string): Promise<PromptTemplate[]>;
  getPromptTemplateById(id: string, userId: string): Promise<PromptTemplate | undefined>;
  getDefaultPromptTemplate(userId: string): Promise<PromptTemplate | undefined>;
  createPromptTemplate(template: InsertPromptTemplate & { userId: string }): Promise<PromptTemplate>;
  updatePromptTemplate(id: string, template: UpdatePromptTemplate, userId: string): Promise<PromptTemplate | undefined>;
  deletePromptTemplate(id: string, userId: string): Promise<boolean>;
  setDefaultPromptTemplate(id: string, userId: string): Promise<PromptTemplate | undefined>;

  getCommentsByIdeaId(ideaId: string): Promise<IdeaComment[]>;
  getCommentById(id: string): Promise<IdeaComment | undefined>;
  createComment(comment: InsertIdeaComment): Promise<IdeaComment>;
  deleteComment(id: string): Promise<boolean>;

  getAssignmentsByIdeaId(ideaId: string): Promise<IdeaAssignment[]>;
  getAssignmentById(id: string): Promise<IdeaAssignment | undefined>;
  createAssignment(assignment: InsertIdeaAssignment): Promise<IdeaAssignment>;
  deleteAssignment(id: string): Promise<boolean>;

  getSetting(key: string, userId: string): Promise<Setting | undefined>;
  getAllSettings(userId: string): Promise<Setting[]>;
  upsertSetting(key: string, value: string | null, userId: string): Promise<Setting>;
  upsertSettings(entries: Record<string, string | null>, userId: string): Promise<Setting[]>;

  getUnnotifiedContent(): Promise<Content[]>;
  markContentNotified(id: string): Promise<Content | undefined>;
  updateContentRewrite(id: string, rewrittenContent: string): Promise<Content | undefined>;

  getUnusedContentByFolderId(folderId: string): Promise<Content[]>;
  markContentUsedForIdeas(ids: string[]): Promise<void>;
  markContentRead(id: string): Promise<Content | undefined>;

  getAssistantConversations(userId: string): Promise<AssistantConversation[]>;
  getAssistantConversationById(id: string): Promise<AssistantConversation | undefined>;
  createAssistantConversation(conversation: InsertAssistantConversation): Promise<AssistantConversation>;
  updateAssistantConversation(id: string, patch: Partial<InsertAssistantConversation>): Promise<AssistantConversation | undefined>;
  deleteAssistantConversation(id: string): Promise<boolean>;
  getAssistantMessagesByConversationId(conversationId: string): Promise<AssistantMessage[]>;
  createAssistantMessage(message: InsertAssistantMessage): Promise<AssistantMessage>;

  getAllStyleExamples(userId: string): Promise<StyleExample[]>;
  createStyleExample(example: InsertStyleExample & { userId: string }): Promise<StyleExample>;
  deleteStyleExample(id: string, userId: string): Promise<boolean>;

  // Platform IDs (multi-ID support)
  getPlatformIds(userId: string, platform?: PlatformType): Promise<UserPlatformId[]>;
  addPlatformId(userId: string, platform: PlatformType, platformId: string, label?: string): Promise<UserPlatformId>;
  removePlatformId(id: string, userId: string): Promise<boolean>;
  getUserByPlatformId(platform: PlatformType, platformId: string): Promise<User | undefined>;

  // System Settings (global admin controls)
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  getAllSystemSettings(): Promise<SystemSetting[]>;
  upsertSystemSetting(key: string, value: string | null, description?: string): Promise<SystemSetting>;

  // Training Samples
  getTrainingSamples(userId: string): Promise<TrainingSample[]>;
  createTrainingSample(sample: InsertTrainingSample & { userId: string; extractedStyle?: string | null }): Promise<TrainingSample>;
  deleteTrainingSample(id: string, userId: string): Promise<boolean>;

  // API Usage Logging
  logApiUsage(entry: Omit<InsertApiUsageLog, "id" | "createdAt">): Promise<ApiUsageLog>;

  // User Activity
  updateUserLastActive(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ─── Auth / Users ────────────────────────────────────────────────────────
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    return user;
  }

  async getUserBySlackUserId(slackUserId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.slackUserId, slackUserId));
    return user;
  }

  async createUser(data: Partial<InsertUser>): Promise<User> {
    const [user] = await db.insert(users).values(data as any).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  // ─── OTP ─────────────────────────────────────────────────────────────────
  async createOTP(email: string, code: string, expiresAt: Date): Promise<OtpCode> {
    const [otp] = await db.insert(otpCodes).values({ email: email.toLowerCase().trim(), code, expiresAt }).returning();
    return otp;
  }

  async getValidOTP(email: string, code: string): Promise<OtpCode | undefined> {
    const now = new Date();
    const [otp] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.email, email.toLowerCase().trim()),
          eq(otpCodes.code, code),
          eq(otpCodes.used, false),
          gt(otpCodes.expiresAt, now)
        )
      )
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);
    return otp;
  }

  async markOTPUsed(id: string): Promise<void> {
    await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, id));
  }

  async invalidateOTPsForEmail(email: string): Promise<void> {
    await db
      .update(otpCodes)
      .set({ used: true })
      .where(and(eq(otpCodes.email, email.toLowerCase().trim()), eq(otpCodes.used, false)));
  }

  // ─── Folders ─────────────────────────────────────────────────────────────
  async getAllFolders(userId: string): Promise<Folder[]> {
    return db.select().from(folders).where(eq(folders.userId, userId)).orderBy(folders.createdAt);
  }

  // Used by scheduler only — fetches all folders across all users
  async getAllFoldersSystem(): Promise<Folder[]> {
    return db.select().from(folders).orderBy(folders.createdAt);
  }

  async getFolderById(id: string): Promise<Folder | undefined> {
    const [folder] = await db.select().from(folders).where(eq(folders.id, id));
    return folder;
  }

  async getFolderByContentId(contentId: string): Promise<Folder | undefined> {
    const item = await this.getContentById(contentId);
    if (!item?.folderId) return undefined;
    return this.getFolderById(item.folderId);
  }

  async createFolder(folder: InsertFolder): Promise<Folder> {
    const [created] = await db.insert(folders).values(folder as any).returning();
    return created;
  }

  async updateFolder(id: string, folder: Partial<InsertFolder>): Promise<Folder | undefined> {
    const [updated] = await db.update(folders).set(folder as any).where(eq(folders.id, id)).returning();
    return updated;
  }

  async deleteFolder(id: string): Promise<boolean> {
    const deleted = await db.delete(folders).where(eq(folders.id, id)).returning();
    return deleted.length > 0;
  }

  // ─── Sources ─────────────────────────────────────────────────────────────
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

  // ─── Content ─────────────────────────────────────────────────────────────
  async getAllContent(userId: string): Promise<Content[]> {
    const userFolders = await this.getAllFolders(userId);
    const folderIds = userFolders.map((f) => f.id);
    if (folderIds.length === 0) return [];
    const { inArray } = await import("drizzle-orm");
    return db.select().from(content).where(inArray(content.folderId, folderIds)).orderBy(content.fetchedAt);
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
    if (existing) return null;
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

  async updateContentSentiment(id: string, sentiment: SentimentType, sentimentScore: number, keywords: string[]): Promise<Content | undefined> {
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

  // ─── Ideas ────────────────────────────────────────────────────────────────
  async getAllIdeas(userId: string): Promise<Idea[]> {
    return db.select().from(ideas).where(eq(ideas.userId, userId)).orderBy(ideas.createdAt);
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

  // ─── Prompt Templates ─────────────────────────────────────────────────────
  async getAllPromptTemplates(userId: string): Promise<PromptTemplate[]> {
    return db.select().from(promptTemplates).where(eq(promptTemplates.userId, userId)).orderBy(promptTemplates.createdAt);
  }

  async getPromptTemplateById(id: string, userId: string): Promise<PromptTemplate | undefined> {
    const [template] = await db.select().from(promptTemplates).where(and(eq(promptTemplates.id, id), eq(promptTemplates.userId, userId)));
    return template;
  }

  async getDefaultPromptTemplate(userId: string): Promise<PromptTemplate | undefined> {
    const [template] = await db.select().from(promptTemplates).where(and(eq(promptTemplates.isDefault, true), eq(promptTemplates.userId, userId)));
    return template;
  }

  async createPromptTemplate(template: InsertPromptTemplate & { userId: string }): Promise<PromptTemplate> {
    const [created] = await db.insert(promptTemplates).values(template as any).returning();
    return created;
  }

  async updatePromptTemplate(id: string, template: UpdatePromptTemplate, userId: string): Promise<PromptTemplate | undefined> {
    const [updated] = await db.update(promptTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(and(eq(promptTemplates.id, id), eq(promptTemplates.userId, userId)))
      .returning();
    return updated;
  }

  async deletePromptTemplate(id: string, userId: string): Promise<boolean> {
    const deleted = await db.delete(promptTemplates).where(and(eq(promptTemplates.id, id), eq(promptTemplates.userId, userId))).returning();
    return deleted.length > 0;
  }

  async setDefaultPromptTemplate(id: string, userId: string): Promise<PromptTemplate | undefined> {
    await db.update(promptTemplates).set({ isDefault: false }).where(and(eq(promptTemplates.isDefault, true), eq(promptTemplates.userId, userId)));
    const [updated] = await db.update(promptTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(promptTemplates.id, id), eq(promptTemplates.userId, userId)))
      .returning();
    return updated;
  }

  // ─── Comments & Assignments ───────────────────────────────────────────────
  async getCommentsByIdeaId(ideaId: string): Promise<IdeaComment[]> {
    return db.select().from(ideaComments).where(eq(ideaComments.ideaId, ideaId)).orderBy(desc(ideaComments.createdAt));
  }

  async getCommentById(id: string): Promise<IdeaComment | undefined> {
    const [comment] = await db.select().from(ideaComments).where(eq(ideaComments.id, id));
    return comment;
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

  async getAssignmentById(id: string): Promise<IdeaAssignment | undefined> {
    const [assignment] = await db.select().from(ideaAssignments).where(eq(ideaAssignments.id, id));
    return assignment;
  }

  async createAssignment(assignment: InsertIdeaAssignment): Promise<IdeaAssignment> {
    const [created] = await db.insert(ideaAssignments).values(assignment).returning();
    return created;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    const deleted = await db.delete(ideaAssignments).where(eq(ideaAssignments.id, id)).returning();
    return deleted.length > 0;
  }

  // ─── Settings ─────────────────────────────────────────────────────────────
  async getSetting(key: string, userId: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(and(eq(settings.key, key), eq(settings.userId, userId)));
    if (!setting) return undefined;
    return { ...setting, value: decryptIfNeeded(setting.key, setting.value) };
  }

  async getAllSettings(userId: string): Promise<Setting[]> {
    const all = await db.select().from(settings).where(eq(settings.userId, userId));
    return all.map((s) => ({ ...s, value: decryptIfNeeded(s.key, s.value) }));
  }

  async upsertSetting(key: string, value: string | null, userId: string): Promise<Setting> {
    const persistedValue = encryptIfSensitive(key, value);
    const [result] = await db
      .insert(settings)
      .values({ userId, key, value: persistedValue, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [settings.userId, settings.key],
        set: { value: persistedValue, updatedAt: new Date() },
      })
      .returning();
    return { ...result, value: decryptIfNeeded(result.key, result.value) };
  }

  async upsertSettings(entries: Record<string, string | null>, userId: string): Promise<Setting[]> {
    const results: Setting[] = [];
    for (const [key, value] of Object.entries(entries)) {
      const result = await this.upsertSetting(key, value, userId);
      results.push(result);
    }
    return results;
  }

  // ─── Notifications ────────────────────────────────────────────────────────
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

  // ─── Assistant Conversations ──────────────────────────────────────────────
  async getAssistantConversations(userId: string): Promise<AssistantConversation[]> {
    return db
      .select()
      .from(assistantConversations)
      .where(eq(assistantConversations.userId, userId))
      .orderBy(desc(assistantConversations.updatedAt));
  }

  async getAssistantConversationById(id: string): Promise<AssistantConversation | undefined> {
    const [conversation] = await db.select().from(assistantConversations).where(eq(assistantConversations.id, id));
    return conversation;
  }

  async createAssistantConversation(conversation: InsertAssistantConversation): Promise<AssistantConversation> {
    const [created] = await db.insert(assistantConversations).values(conversation as any).returning();
    return created;
  }

  async updateAssistantConversation(id: string, patch: Partial<InsertAssistantConversation>): Promise<AssistantConversation | undefined> {
    const [updated] = await db
      .update(assistantConversations)
      .set({ ...patch, updatedAt: new Date() } as any)
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
    const [created] = await db
      .insert(assistantMessages)
      .values({ ...message, role: message.role as "user" | "assistant", metadata: (message as any).metadata ?? null })
      .returning();
    await db
      .update(assistantConversations)
      .set({ updatedAt: new Date() })
      .where(eq(assistantConversations.id, message.conversationId));
    return created;
  }

  // ─── Style Examples ───────────────────────────────────────────────────────
  async getAllStyleExamples(userId: string): Promise<StyleExample[]> {
    return db.select().from(styleExamples).where(eq(styleExamples.userId, userId)).orderBy(desc(styleExamples.createdAt));
  }

  async createStyleExample(example: InsertStyleExample & { userId: string }): Promise<StyleExample> {
    const [created] = await db.insert(styleExamples).values(example as any).returning();
    return created;
  }

  async deleteStyleExample(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(styleExamples).where(and(eq(styleExamples.id, id), eq(styleExamples.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // ─── Platform IDs (Multi-ID) ──────────────────────────────────────────────
  async getPlatformIds(userId: string, platform?: PlatformType): Promise<UserPlatformId[]> {
    if (platform) {
      return db.select().from(userPlatformIds)
        .where(and(eq(userPlatformIds.userId, userId), eq(userPlatformIds.platform, platform)))
        .orderBy(desc(userPlatformIds.createdAt));
    }
    return db.select().from(userPlatformIds)
      .where(eq(userPlatformIds.userId, userId))
      .orderBy(desc(userPlatformIds.createdAt));
  }

  async addPlatformId(userId: string, platform: PlatformType, platformId: string, label?: string): Promise<UserPlatformId> {
    const [created] = await db.insert(userPlatformIds).values({
      userId,
      platform,
      platformId,
      label: label || null,
    }).returning();
    return created;
  }

  async removePlatformId(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(userPlatformIds)
      .where(and(eq(userPlatformIds.id, id), eq(userPlatformIds.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getUserByPlatformId(platform: PlatformType, platformId: string): Promise<User | undefined> {
    const [record] = await db.select().from(userPlatformIds)
      .where(and(eq(userPlatformIds.platform, platform), eq(userPlatformIds.platformId, platformId)));
    if (record) {
      return this.getUserById(record.userId);
    }
    if (platform === "slack") {
      return this.getUserBySlackUserId(platformId);
    }
    return undefined;
  }

  // ─── System Settings (Global Admin Controls) ──────────────────────────────
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting;
  }

  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return db.select().from(systemSettings).orderBy(systemSettings.key);
  }

  async upsertSystemSetting(key: string, value: string | null, description?: string): Promise<SystemSetting> {
    const updateSet: any = { value, updatedAt: new Date() };
    if (description !== undefined) updateSet.description = description;
    const [result] = await db
      .insert(systemSettings)
      .values({ key, value, description: description || null, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: updateSet,
      })
      .returning();
    return result;
  }

  // ─── Training Samples ─────────────────────────────────────────────────────
  async getTrainingSamples(userId: string): Promise<TrainingSample[]> {
    return db.select().from(trainingSamples)
      .where(eq(trainingSamples.userId, userId))
      .orderBy(desc(trainingSamples.createdAt));
  }

  async createTrainingSample(sample: InsertTrainingSample & { userId: string; extractedStyle?: string | null }): Promise<TrainingSample> {
    const [created] = await db.insert(trainingSamples).values({
      userId: sample.userId,
      sampleTitle: sample.sampleTitle,
      contentType: sample.contentType as TrainingSampleType,
      textContent: sample.textContent,
      extractedStyle: sample.extractedStyle || null,
    }).returning();
    return created;
  }

  async deleteTrainingSample(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(trainingSamples)
      .where(and(eq(trainingSamples.id, id), eq(trainingSamples.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // ─── API Usage Logging ─────────────────────────────────────────────────────
  async logApiUsage(entry: Omit<InsertApiUsageLog, "id" | "createdAt">): Promise<ApiUsageLog> {
    const [log] = await db.insert(apiUsageLogs).values(entry as any).returning();
    return log;
  }

  // ─── User Activity ─────────────────────────────────────────────────────────
  async updateUserLastActive(userId: string): Promise<void> {
    await db.update(users).set({ lastActiveAt: new Date() } as any).where(eq(users.id, userId));
  }

  // ─── Integration Channels ──────────────────────────────────────────────────
  async getIntegrationChannels(userId: string): Promise<IntegrationChannel[]> {
    return db.select().from(integrationChannels).where(eq(integrationChannels.userId, userId)).orderBy(desc(integrationChannels.createdAt));
  }

  async getIntegrationChannelById(id: string, userId: string): Promise<IntegrationChannel | undefined> {
    const [channel] = await db.select().from(integrationChannels).where(and(eq(integrationChannels.id, id), eq(integrationChannels.userId, userId)));
    return channel;
  }

  async createIntegrationChannel(data: { userId: string; platform: string; name: string; credentials: Record<string, string> }): Promise<IntegrationChannel> {
    const encryptedCreds: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.credentials)) {
      encryptedCreds[k] = encryptRawValue(v);
    }
    const [created] = await db.insert(integrationChannels).values({
      userId: data.userId,
      platform: data.platform,
      name: data.name,
      credentials: encryptedCreds,
      isActive: true,
    } as any).returning();
    return created;
  }

  async updateIntegrationChannel(id: string, userId: string, updates: { name?: string; credentials?: Record<string, string>; isActive?: boolean }): Promise<IntegrationChannel | undefined> {
    const setData: any = {};
    if (updates.name !== undefined) setData.name = updates.name;
    if (updates.isActive !== undefined) setData.isActive = updates.isActive;
    if (updates.credentials) {
      const encryptedCreds: Record<string, string> = {};
      for (const [k, v] of Object.entries(updates.credentials)) {
        encryptedCreds[k] = encryptRawValue(v);
      }
      setData.credentials = encryptedCreds;
    }
    const [updated] = await db.update(integrationChannels).set(setData).where(and(eq(integrationChannels.id, id), eq(integrationChannels.userId, userId))).returning();
    return updated;
  }

  async deleteIntegrationChannel(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(integrationChannels).where(and(eq(integrationChannels.id, id), eq(integrationChannels.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  getDecryptedCredentials(channel: IntegrationChannel): Record<string, string> {
    const decrypted: Record<string, string> = {};
    const creds = channel.credentials as Record<string, string>;
    for (const [k, v] of Object.entries(creds)) {
      decrypted[k] = decryptRawValue(v);
    }
    return decrypted;
  }

  // ─── Folder-Channel Mappings ───────────────────────────────────────────────
  async getFolderChannelMappings(userId: string): Promise<FolderChannelMapping[]> {
    return db.select().from(folderChannelMappings).where(eq(folderChannelMappings.userId, userId));
  }

  async getMappingsForFolder(folderId: string, userId?: string): Promise<FolderChannelMapping[]> {
    if (userId) {
      return db.select().from(folderChannelMappings).where(and(eq(folderChannelMappings.folderId, folderId), eq(folderChannelMappings.userId, userId)));
    }
    return db.select().from(folderChannelMappings).where(eq(folderChannelMappings.folderId, folderId));
  }

  async createFolderChannelMapping(data: { userId: string; folderId: string; integrationChannelId: string; targetId: string }): Promise<FolderChannelMapping> {
    const [created] = await db.insert(folderChannelMappings).values(data as any).returning();
    return created;
  }

  async deleteFolderChannelMapping(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(folderChannelMappings).where(and(eq(folderChannelMappings.id, id), eq(folderChannelMappings.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getActiveIntegrationChannelById(id: string, userId?: string): Promise<IntegrationChannel | undefined> {
    const conditions = [eq(integrationChannels.id, id), eq(integrationChannels.isActive, true)];
    if (userId) conditions.push(eq(integrationChannels.userId, userId));
    const [channel] = await db.select().from(integrationChannels).where(and(...conditions));
    return channel;
  }

  // ─── Admin Management ──────────────────────────────────────────────────────
  async getAdminUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.isAdmin, true));
  }

  async setAdminStatus(userId: string, isAdmin: boolean, role: AdminRole): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ isAdmin, adminRole: role, updatedAt: new Date() } as any)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async setAdminPassword(userId: string, passwordHash: string): Promise<void> {
    await db.update(users)
      .set({ adminPasswordHash: passwordHash, updatedAt: new Date() } as any)
      .where(eq(users.id, userId));
  }

  async getAdminPasswordHash(userId: string): Promise<string | null> {
    const [user] = await db.select({ hash: users.adminPasswordHash }).from(users).where(eq(users.id, userId));
    return user?.hash ?? null;
  }

  // ─── Announcements ────────────────────────────────────────────────────────
  async getAllAnnouncements(): Promise<Announcement[]> {
    return db.select().from(announcements).orderBy(desc(announcements.createdAt));
  }

  async getActiveAnnouncements(): Promise<Announcement[]> {
    return db.select().from(announcements).where(eq(announcements.isActive, true)).orderBy(desc(announcements.createdAt));
  }

  async getAnnouncementById(id: string): Promise<Announcement | undefined> {
    const [ann] = await db.select().from(announcements).where(eq(announcements.id, id));
    return ann;
  }

  async createAnnouncement(data: InsertAnnouncement): Promise<Announcement> {
    const [created] = await db.insert(announcements).values(data as any).returning();
    return created;
  }

  async updateAnnouncement(id: string, data: Partial<InsertAnnouncement>): Promise<Announcement | undefined> {
    const [updated] = await db.update(announcements)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(announcements.id, id))
      .returning();
    return updated;
  }

  async deleteAnnouncement(id: string): Promise<boolean> {
    const result = await db.delete(announcements).where(eq(announcements.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAnnouncementViewsForUser(userId: string): Promise<AnnouncementView[]> {
    return db.select().from(announcementViews).where(eq(announcementViews.userId, userId));
  }

  async getUnseenAnnouncements(userId: string): Promise<Announcement[]> {
    const active = await this.getActiveAnnouncements();
    const views = await this.getAnnouncementViewsForUser(userId);
    const viewMap = new Map(views.map(v => [v.announcementId, v.viewCount]));
    return active.filter(a => {
      const seen = viewMap.get(a.id) || 0;
      return seen < a.maxViews;
    });
  }

  async recordAnnouncementView(userId: string, announcementId: string): Promise<void> {
    const existing = await db.select().from(announcementViews)
      .where(and(eq(announcementViews.userId, userId), eq(announcementViews.announcementId, announcementId)));
    if (existing.length > 0) {
      await db.update(announcementViews)
        .set({ viewCount: existing[0].viewCount + 1, lastViewedAt: new Date() })
        .where(eq(announcementViews.id, existing[0].id));
    } else {
      await db.insert(announcementViews).values({
        userId,
        announcementId,
        viewCount: 1,
        lastViewedAt: new Date(),
      } as any);
    }
  }

  // ─── Top Banners ──────────────────────────────────────────────────────────
  async getAllTopBanners(): Promise<TopBanner[]> {
    return db.select().from(topBanners).orderBy(desc(topBanners.createdAt));
  }

  async getActiveTopBanner(): Promise<TopBanner | undefined> {
    const [banner] = await db.select().from(topBanners)
      .where(eq(topBanners.isActive, true))
      .orderBy(desc(topBanners.createdAt))
      .limit(1);
    return banner;
  }

  async createTopBanner(data: InsertTopBanner): Promise<TopBanner> {
    const [created] = await db.insert(topBanners).values(data as any).returning();
    return created;
  }

  async updateTopBanner(id: string, data: Partial<InsertTopBanner>): Promise<TopBanner | undefined> {
    const [updated] = await db.update(topBanners)
      .set(data as any)
      .where(eq(topBanners.id, id))
      .returning();
    return updated;
  }

  async deleteTopBanner(id: string): Promise<boolean> {
    const result = await db.delete(topBanners).where(eq(topBanners.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ─── Admin Audit Logs ─────────────────────────────────────────────────────
  async createAuditLog(userId: string, action: string, details?: string, ipAddress?: string): Promise<AdminAuditLog> {
    const [log] = await db.insert(adminAuditLogs).values({
      userId,
      action,
      details: details || null,
      ipAddress: ipAddress || null,
    } as any).returning();
    return log;
  }

  async getAuditLogs(limit: number = 100): Promise<AdminAuditLog[]> {
    return db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(limit);
  }

  // ─── Admin Analytics ──────────────────────────────────────────────────────
  async getAnalytics(): Promise<{
    totalUsers: number;
    totalFolders: number;
    totalSources: number;
    totalContent: number;
    totalIdeas: number;
    adminCount: number;
  }> {
    const { count, sql: sqlFn } = await import("drizzle-orm");
    const [userCount] = await db.select({ count: count() }).from(users);
    const [folderCount] = await db.select({ count: count() }).from(folders);
    const [sourceCount] = await db.select({ count: count() }).from(sources);
    const [contentCount] = await db.select({ count: count() }).from(content);
    const [ideaCount] = await db.select({ count: count() }).from(ideas);
    const [adminCount] = await db.select({ count: count() }).from(users).where(eq(users.isAdmin, true));
    return {
      totalUsers: Number(userCount.count),
      totalFolders: Number(folderCount.count),
      totalSources: Number(sourceCount.count),
      totalContent: Number(contentCount.count),
      totalIdeas: Number(ideaCount.count),
      adminCount: Number(adminCount.count),
    };
  }
  // ─── Welcome Cards ──────────────────────────────────────────────────────

  async getActiveWelcomeCards(): Promise<WelcomeCard[]> {
    return db.select().from(welcomeCards).where(eq(welcomeCards.isActive, true)).orderBy(welcomeCards.sortOrder);
  }

  async getAllWelcomeCards(): Promise<WelcomeCard[]> {
    return db.select().from(welcomeCards).orderBy(welcomeCards.sortOrder);
  }

  async getWelcomeCardById(id: string): Promise<WelcomeCard | undefined> {
    const [card] = await db.select().from(welcomeCards).where(eq(welcomeCards.id, id));
    return card;
  }

  async createWelcomeCard(data: { sortOrder: number; title: string; body: string; emoji?: string; showUserName?: boolean; isFinal?: boolean; isActive?: boolean }): Promise<WelcomeCard> {
    const [card] = await db.insert(welcomeCards).values(data as any).returning();
    return card;
  }

  async updateWelcomeCard(id: string, data: Partial<{ sortOrder: number; title: string; body: string; emoji: string; showUserName: boolean; isFinal: boolean; isActive: boolean }>): Promise<WelcomeCard> {
    const [card] = await db.update(welcomeCards).set({ ...data, updatedAt: new Date() } as any).where(eq(welcomeCards.id, id)).returning();
    return card;
  }

  async deleteWelcomeCard(id: string): Promise<void> {
    await db.delete(welcomeCards).where(eq(welcomeCards.id, id));
  }

  async hasUserSeenWelcome(userId: string): Promise<boolean> {
    const [view] = await db.select().from(welcomeCardViews).where(eq(welcomeCardViews.userId, userId));
    return !!view;
  }

  async markWelcomeSeen(userId: string): Promise<void> {
    await db.insert(welcomeCardViews).values({ userId } as any).onConflictDoNothing();
  }

  async resetWelcomeViews(): Promise<void> {
    await db.delete(welcomeCardViews);
  }

  // ─── Support Tickets ─────────────────────────────────────────────────────

  async createTicket(data: InsertSupportTicket): Promise<SupportTicket> {
    const [ticket] = await db.insert(supportTickets).values(data as any).returning();
    return ticket;
  }

  async getTicketsByUser(userId: string): Promise<SupportTicket[]> {
    return db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.createdAt));
  }

  async getTicketById(id: string): Promise<SupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return ticket;
  }

  async getAllTickets(): Promise<SupportTicket[]> {
    return db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
  }

  async updateTicketStatus(id: string, status: TicketStatus): Promise<SupportTicket> {
    const [ticket] = await db.update(supportTickets)
      .set({ status, updatedAt: new Date() } as any)
      .where(eq(supportTickets.id, id))
      .returning();
    return ticket;
  }

  async getTicketReplies(ticketId: string): Promise<TicketReply[]> {
    return db.select().from(ticketReplies).where(eq(ticketReplies.ticketId, ticketId)).orderBy(ticketReplies.createdAt);
  }

  async createTicketReply(ticketId: string, userId: string, message: string, isAdmin: boolean): Promise<TicketReply> {
    const [reply] = await db.insert(ticketReplies).values({
      ticketId,
      userId,
      message,
      isAdmin,
    } as any).returning();
    await db.update(supportTickets).set({ updatedAt: new Date() } as any).where(eq(supportTickets.id, ticketId));
    return reply;
  }
}

export const storage = new DatabaseStorage();
