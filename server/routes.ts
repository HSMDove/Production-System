import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchRSSFeed, fetchMultipleSources } from "./fetcher";
import { generateIdeasFromContent } from "./openai";
import {
  insertFolderSchema,
  insertSourceSchema,
  insertIdeaSchema,
  updateIdeaSchema,
  insertPromptTemplateSchema,
  updatePromptTemplateSchema,
  insertIdeaCommentSchema,
  insertIdeaAssignmentSchema,
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/folders", async (req, res) => {
    try {
      const folders = await storage.getAllFolders();
      res.json(folders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  app.post("/api/folders", async (req, res) => {
    try {
      const parsed = insertFolderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const folder = await storage.createFolder(parsed.data);
      res.status(201).json(folder);
    } catch (error) {
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  app.get("/api/folders/:id", async (req, res) => {
    try {
      const folder = await storage.getFolderById(req.params.id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      res.json(folder);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch folder" });
    }
  });

  app.patch("/api/folders/:id", async (req, res) => {
    try {
      const parsed = insertFolderSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const folder = await storage.updateFolder(req.params.id, parsed.data);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      res.json(folder);
    } catch (error) {
      res.status(500).json({ error: "Failed to update folder" });
    }
  });

  app.delete("/api/folders/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteFolder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Folder not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });

  app.get("/api/folders/:id/sources", async (req, res) => {
    try {
      const sources = await storage.getSourcesByFolderId(req.params.id);
      res.json(sources);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  app.get("/api/folders/:id/content", async (req, res) => {
    try {
      const content = await storage.getContentByFolderId(req.params.id);
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });

  app.post("/api/folders/:id/fetch-all", async (req, res) => {
    try {
      const sources = await storage.getSourcesByFolderId(req.params.id);
      const results = await fetchMultipleSources(sources);
      
      let totalAdded = 0;
      let skipped = 0;
      const errors: string[] = [];
      
      for (const result of results) {
        if (result.error) {
          errors.push(`Source ${result.sourceId}: ${result.error}`);
          continue;
        }
        
        for (const item of result.items) {
          try {
            const created = await storage.createContentIfNotExists(item);
            if (created) {
              totalAdded++;
            } else {
              skipped++;
            }
          } catch (e) {
            console.error("Error creating content:", e);
          }
        }
        
        await storage.updateSource(result.sourceId, { lastFetched: new Date() } as any);
      }
      
      res.json({ 
        success: true, 
        itemsAdded: totalAdded,
        skipped,
        errors: errors.length > 0 ? errors : undefined 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content from sources" });
    }
  });

  app.post("/api/folders/:id/generate-ideas", async (req, res) => {
    try {
      const folder = await storage.getFolderById(req.params.id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      
      const content = await storage.getContentByFolderId(req.params.id);
      if (content.length === 0) {
        return res.status(400).json({ error: "No content available to generate ideas from" });
      }
      
      // Get custom template if specified
      // "builtin" = use built-in prompt (no template)
      // undefined = use user's default template if exists
      // any other value = use the specified template ID
      let template = null;
      const templateId = req.body.templateId as string | undefined;
      if (templateId && templateId !== "builtin") {
        template = await storage.getPromptTemplateById(templateId);
      } else if (!templateId) {
        // No template specified - use user's default if exists
        template = await storage.getDefaultPromptTemplate();
      }
      // If templateId === "builtin", template stays null (use built-in prompt)
      
      const generatedIdeas = await generateIdeasFromContent(content, folder.name, folder.id, template);
      
      const savedIdeas = [];
      const validationErrors = [];
      
      for (const idea of generatedIdeas) {
        const parsed = insertIdeaSchema.safeParse(idea);
        if (!parsed.success) {
          validationErrors.push(`Invalid idea: ${parsed.error.message}`);
          continue;
        }
        try {
          const saved = await storage.createIdea(parsed.data);
          savedIdeas.push(saved);
        } catch (e) {
          console.error("Error saving idea:", e);
        }
      }
      
      res.json({ 
        success: true, 
        ideas: savedIdeas,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined
      });
    } catch (error) {
      console.error("Error generating ideas:", error);
      res.status(500).json({ error: "Failed to generate ideas" });
    }
  });

  app.post("/api/sources", async (req, res) => {
    try {
      const parsed = insertSourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const source = await storage.createSource(parsed.data);
      res.status(201).json(source);
    } catch (error) {
      res.status(500).json({ error: "Failed to create source" });
    }
  });

  app.get("/api/sources/:id", async (req, res) => {
    try {
      const source = await storage.getSourceById(req.params.id);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      res.json(source);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch source" });
    }
  });

  app.patch("/api/sources/:id", async (req, res) => {
    try {
      const parsed = insertSourceSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const source = await storage.updateSource(req.params.id, parsed.data);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      res.json(source);
    } catch (error) {
      res.status(500).json({ error: "Failed to update source" });
    }
  });

  app.delete("/api/sources/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSource(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Source not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete source" });
    }
  });

  app.post("/api/sources/:id/fetch", async (req, res) => {
    try {
      const source = await storage.getSourceById(req.params.id);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      
      const result = await fetchRSSFeed(source);
      
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      
      let addedCount = 0;
      let skipped = 0;
      for (const item of result.items) {
        try {
          const created = await storage.createContentIfNotExists(item);
          if (created) {
            addedCount++;
          } else {
            skipped++;
          }
        } catch (e) {
          console.error("Error creating content:", e);
        }
      }
      
      await storage.updateSource(source.id, { lastFetched: new Date() } as any);
      
      res.json({ success: true, itemsAdded: addedCount, skipped });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content from source" });
    }
  });

  app.get("/api/ideas", async (req, res) => {
    try {
      const folderId = req.query.folderId as string | undefined;
      let ideas;
      if (folderId) {
        ideas = await storage.getIdeasByFolderId(folderId);
      } else {
        ideas = await storage.getAllIdeas();
      }
      res.json(ideas);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ideas" });
    }
  });

  app.post("/api/ideas", async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.scheduledDate && typeof body.scheduledDate === 'string') {
        body.scheduledDate = new Date(body.scheduledDate);
      }
      const parsed = insertIdeaSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const idea = await storage.createIdea(parsed.data);
      res.status(201).json(idea);
    } catch (error) {
      res.status(500).json({ error: "Failed to create idea" });
    }
  });

  app.get("/api/ideas/:id", async (req, res) => {
    try {
      const idea = await storage.getIdeaById(req.params.id);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }
      res.json(idea);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch idea" });
    }
  });

  app.patch("/api/ideas/:id", async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.scheduledDate && typeof body.scheduledDate === 'string') {
        body.scheduledDate = new Date(body.scheduledDate);
      }
      const parsed = updateIdeaSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const idea = await storage.updateIdea(req.params.id, parsed.data);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }
      res.json(idea);
    } catch (error) {
      res.status(500).json({ error: "Failed to update idea" });
    }
  });

  app.delete("/api/ideas/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteIdea(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Idea not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete idea" });
    }
  });

  // Prompt Templates routes
  app.get("/api/prompt-templates", async (req, res) => {
    try {
      const templates = await storage.getAllPromptTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch prompt templates" });
    }
  });

  app.get("/api/prompt-templates/default", async (req, res) => {
    try {
      const template = await storage.getDefaultPromptTemplate();
      res.json(template || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch default template" });
    }
  });

  app.get("/api/prompt-templates/:id", async (req, res) => {
    try {
      const template = await storage.getPromptTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.post("/api/prompt-templates", async (req, res) => {
    try {
      const parsed = insertPromptTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const template = await storage.createPromptTemplate(parsed.data);
      res.status(201).json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/prompt-templates/:id", async (req, res) => {
    try {
      const parsed = updatePromptTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const template = await storage.updatePromptTemplate(req.params.id, parsed.data);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.post("/api/prompt-templates/:id/set-default", async (req, res) => {
    try {
      const template = await storage.setDefaultPromptTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to set default template" });
    }
  });

  app.delete("/api/prompt-templates/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePromptTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Idea Comments routes
  app.get("/api/ideas/:id/comments", async (req, res) => {
    try {
      const comments = await storage.getCommentsByIdeaId(req.params.id);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/ideas/:id/comments", async (req, res) => {
    try {
      const parsed = insertIdeaCommentSchema.safeParse({
        ...req.body,
        ideaId: req.params.id,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const comment = await storage.createComment(parsed.data);
      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.delete("/api/comments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteComment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Comment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // Idea Assignments routes
  app.get("/api/ideas/:id/assignments", async (req, res) => {
    try {
      const assignments = await storage.getAssignmentsByIdeaId(req.params.id);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });

  app.post("/api/ideas/:id/assignments", async (req, res) => {
    try {
      const parsed = insertIdeaAssignmentSchema.safeParse({
        ...req.body,
        ideaId: req.params.id,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const assignment = await storage.createAssignment(parsed.data);
      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create assignment" });
    }
  });

  app.delete("/api/assignments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAssignment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete assignment" });
    }
  });

  // Analytics endpoints
  app.get("/api/analytics/overview", async (req, res) => {
    try {
      const [folders, allIdeas, allContent, allSources] = await Promise.all([
        storage.getAllFolders(),
        storage.getAllIdeas(),
        storage.getAllContent(),
        storage.getAllSources(),
      ]);

      // Ideas by status
      const ideasByStatus: Record<string, number> = {};
      for (const idea of allIdeas) {
        ideasByStatus[idea.status] = (ideasByStatus[idea.status] || 0) + 1;
      }

      // Ideas by category
      const ideasByCategory: Record<string, number> = {};
      for (const idea of allIdeas) {
        ideasByCategory[idea.category] = (ideasByCategory[idea.category] || 0) + 1;
      }

      // Content by folder
      const contentByFolder: { folderId: string; folderName: string; count: number }[] = [];
      for (const folder of folders) {
        const folderContent = allContent.filter(c => c.folderId === folder.id);
        contentByFolder.push({
          folderId: folder.id,
          folderName: folder.name,
          count: folderContent.length,
        });
      }

      // Sources by type
      const sourcesByType: Record<string, number> = {};
      for (const source of allSources) {
        sourcesByType[source.type] = (sourcesByType[source.type] || 0) + 1;
      }

      // Ideas created over time (last 30 days)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const ideasOverTime: { date: string; count: number }[] = [];
      const dateMap: Record<string, number> = {};
      
      for (const idea of allIdeas) {
        const createdDate = new Date(idea.createdAt);
        if (createdDate >= thirtyDaysAgo) {
          const dateStr = createdDate.toISOString().split('T')[0];
          dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
        }
      }
      
      // Fill in missing days with 0 - clone date each iteration
      for (let i = 0; i <= 30; i++) {
        const d = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        ideasOverTime.push({
          date: dateStr,
          count: dateMap[dateStr] || 0,
        });
      }

      // Content fetched over time (last 30 days)
      const contentOverTime: { date: string; count: number }[] = [];
      const contentDateMap: Record<string, number> = {};
      
      for (const contentItem of allContent) {
        const fetchedDate = new Date(contentItem.fetchedAt);
        if (fetchedDate >= thirtyDaysAgo) {
          const dateStr = fetchedDate.toISOString().split('T')[0];
          contentDateMap[dateStr] = (contentDateMap[dateStr] || 0) + 1;
        }
      }
      
      for (let i = 0; i <= 30; i++) {
        const d = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        contentOverTime.push({
          date: dateStr,
          count: contentDateMap[dateStr] || 0,
        });
      }

      // Completion rate
      const completedCount = allIdeas.filter(i => i.status === 'completed').length;
      const completionRate = allIdeas.length > 0 ? Math.round((completedCount / allIdeas.length) * 100) : 0;

      res.json({
        totalFolders: folders.length,
        totalIdeas: allIdeas.length,
        totalContent: allContent.length,
        totalSources: allSources.length,
        completionRate,
        ideasByStatus,
        ideasByCategory,
        contentByFolder,
        sourcesByType,
        ideasOverTime,
        contentOverTime,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  return httpServer;
}
