# نظام الإنتاج (Production System)

## Overview

نظام الإنتاج هو أداة داخلية خاصة لإدارة المحتوى. يقوم بتجميع الأخبار التقنية ثنائية اللغة من خلاصات RSS، ويقوم بترجمتها/إعادة كتابتها إلى العربية باستخدام الذكاء الاصطناعي بأسلوب "سعودي كاجوال تقني"، وينشر تلقائياً إلى تيليجرام وسلاك. يتميز بواجهة تشبه Feedly مع شريط جانبي للمصادر، ونظام تحديث تلقائي، وتركيز على السرعة والموثوقية والأتمتة لنشر المحتوى الحصري. دعم كامل لـ RTL (من اليمين إلى اليسار) للمحتوى العربي.

## User Preferences

Preferred communication style: Simple, everyday language.
Developer: حسام تيك فيلد (Hossam TechField)

## System Architecture

### Frontend Architecture

**Framework & Tooling**
- React 18 with TypeScript for type safety and modern component patterns
- Vite as the build tool and dev server for fast development experience
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and caching

**UI Component System**
- shadcn/ui components (New York variant) built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom RTL-aware configuration
- Custom design system following Linear-inspired productivity patterns
- Arabic fonts: Cairo and Tajawal from Google Fonts for optimal Arabic readability

**State Management**
- React Query handles all server state (folders, sources, content, ideas)
- React Hook Form with Zod validation for form state and validation
- Local component state with React hooks for UI interactions
- Context API for theme management (light/dark/system modes)
- AutoRefreshProvider context for managing automatic content updates

**Key Features**
- Drag-and-drop Kanban board using @dnd-kit for idea workflow management
- RTL-aware layouts with mirrored navigation and content flow
- Responsive design with mobile-first breakpoints
- Real-time progress tracking for AI idea generation
- Auto-refresh system with configurable intervals (10/30/60 minutes)
- Feedly-style sources sidebar with date-grouped content feed

### Backend Architecture

**Runtime & Framework**
- Node.js with Express.js for the HTTP server
- TypeScript throughout for type safety
- ESBuild for production bundling with selective dependency bundling

**API Design**
- RESTful API endpoints under `/api` namespace
- CRUD operations for folders, sources, content, and ideas
- Specialized endpoints for RSS fetching and AI idea generation
- Session-based architecture (infrastructure in place via connect-pg-simple)

**RSS & Content Fetching**
- RSS Parser library for feed parsing with 10-second timeout
- p-limit for concurrent request limiting (3 parallel requests)
- p-retry for fault tolerance (2 retries with exponential backoff)
- Automatic deduplication of content items by URL
- Content freshness filter: 14-day threshold for all sources
- Twitter/X: Multi-instance Nitter fallback (xcancel, nitter.poast.org, nitter.privacyredirect.com, lightbrd.com)
- TikTok: Multi-bridge RSS fallback (rsshub.app, proxitok, feedmirror.com)
- YouTube: Standard Atom RSS feed with channel ID extraction
- "View All" folder filter: Shows content from last 7 days across all sources

**AI Integration**
- OpenAI API integration for generating video ideas from content
- Custom AI persona from Settings (`ai_system_prompt` key) applied to ALL AI functions: rewrite, summary, translation, and explanation
- Structured prompts in Arabic for generating 3-5 ideas per request
- Returns categorized ideas with titles, descriptions, duration estimates, and target audience
- Configurable content window (last N days) for idea generation
- Arabic summary generation for non-Arabic content during fetch
- Detailed AI-powered Arabic explanations for individual news items via `/api/content/:id/explain`

**Content Display Features**
- Feedly-style horizontal content cards with thumbnails
- News/Videos tab organization based on source types
- Auto-refresh content when entering a folder (fetches latest from sources)
- AI explanation popup for each content item with sparkles button
- Keyword-based filtering to exclude promotional/discount content at fetch time

### Data Storage

**Database**
- PostgreSQL as the primary relational database
- Drizzle ORM for type-safe database queries and schema management
- Connection pooling via node-postgres (pg) for performance

**Schema Design**

*Folders Table*
- Represents content categories (e.g., "Android", "Apple", "AI")
- Fields: id, name, description, color (for UI theming), timestamps
- One-to-many relationships with sources, content, and ideas

*Sources Table*
- Represents external content sources within folders
- Types: RSS, website, YouTube, Twitter/X, TikTok
- Fields: id, folderId, name, url, type, isActive, lastFetched, timestamps
- Cascade delete when parent folder is removed

*Content Table*
- Stores fetched articles/news items from sources
- Fields: id, folderId, sourceId, title, summary, originalUrl, imageUrl, publishedAt, usedForIdeas, timestamps
- Links to both folder and source with cascade delete
- Supports AI-generated summaries
- `usedForIdeas` boolean flag: marks content as consumed after idea generation (one-time use policy - news never reused for AI)

*Ideas Table*
- Video ideas generated by AI or manually created
- Workflow states: raw_idea → needs_research → ready_for_script → script_in_progress → ready_for_filming → completed
- Categories: thalathiyat (shorts), leh (why), tech_i_use, news_roundup, deep_dive, comparison, tutorial, other
- Fields: id, folderId, title, description, category, status, estimatedDuration, targetAudience, notes, scheduledDate, thumbnailText, script, sourceContentIds, sourceContentTitles, sourceContentUrls, templateId, timestamps
- Optional folder association for organization
- scheduledDate field for content calendar integration
- Smart generation fields: thumbnailText (thumbnail text suggestion), script (video script), sourceContentIds/Titles/Urls (arrays linking to real news sources), templateId (which content template generated this idea)

*Settings Table*
- Key-value configuration store for all platform settings
- Fields: key (primary key), value (text), updatedAt
- Stores: notification config (Telegram/Slack tokens, URLs, toggles), AI provider config, system prompt

*Prompt Templates Table*
- Custom AI prompt templates for idea generation (renamed to "Content Templates" in UI)
- Fields: id, name, description, promptContent, isDefault, defaultCount, timestamps
- Template prompt content is plain text instructions (no placeholders needed) - the system auto-injects folder names, content, and count
- defaultCount field sets the default number of ideas to generate per template (1-10)

*Idea Comments Table*
- Comment threads on ideas for team collaboration
- Fields: id, ideaId, authorName, content, createdAt
- Cascade delete when parent idea is removed

*Idea Assignments Table*
- Team member assignments for ideas
- Fields: id, ideaId, assigneeName, role (optional), createdAt
- Cascade delete when parent idea is removed

*Style Examples Table*
- Past successful video ideas used as style reference for AI learning
- Fields: id, title, description, thumbnailText, createdAt
- Managed via Settings page; fed to AI during idea generation (Stage 1: Style Learning)

### External Dependencies

**AI Services (Provider-Agnostic)**
- Provider-agnostic AI engine via `getAIClient()` in `server/openai.ts`
- Supports two modes: "Production Cloud" (default, uses integrated AI) or "Custom/Local" (Ollama, LM Studio, etc.)
- Custom mode configurable via Settings page: Base URL, optional API Key, Model Name
- All AI functions dynamically create OpenAI SDK client based on settings from database
- `rewriteContent()` function for "نظام الإنتاج" style rewriting with custom system prompts
- `generateSmartView()` function for batch content rewriting into Smart View cards (catchy title, story, thumbnail suggestion, original image)
- Smart View state persists per folder via localStorage; auto-fetches on load if previously active
- Idea cards are clickable → opens IdeaDetailModal with full editable fields (title, thumbnailText, description, script, sources, notes)
- 3-Stage Idea Generation Engine:
  - Stage 1 (Style Learning): AI reads past successful ideas from style_examples table to learn user's writing style
  - Stage 2 (News Reading): AI reads current news from selected folders
  - Stage 3 (Knowledge Expansion): AI uses its own knowledge to complete/expand ideas when news alone is insufficient
- Uses GPT models for Arabic content understanding and generation

**Notification Pipeline**
- `server/notifier.ts` handles automated notifications to Telegram and Slack
- Post-fetch pipeline: new content → AI rewrite → send to channels → mark as notified
- `notifiedAt` column on content table prevents duplicate notifications
- `rewrittenContent` column stores AI-rewritten text for reference
- Telegram: Bot API with HTML formatting
- Slack: Webhook integration with Markdown formatting
- Test functions for verifying connections from Settings page

**Database**
- PostgreSQL database (Relational storage)
- Drizzle Kit for schema migrations in `/migrations` directory

**Third-Party Libraries**
- RSS Parser: Feed parsing and content extraction
- date-fns: Date formatting and manipulation with Arabic locale support
- Radix UI: Accessible component primitives (dialogs, dropdowns, popovers, etc.)
- Lucide React: Icon library for UI elements

**Development Tools**
- TypeScript for compile-time type checking
- PostCSS with Autoprefixer for CSS processing

**Session Management**
- connect-pg-simple: PostgreSQL session store for Express sessions
- Session infrastructure configured but authentication not yet implemented

### Design Principles

**RTL-First Approach**
- All layouts mirror horizontally for Arabic reading direction
- Navigation positioned on right side
- Text right-aligned by default
- Icons and directional indicators reversed appropriately
- Folder cards, content feeds, and Kanban columns flow right-to-left

**Content-Density Focus**
- Minimal visual noise for fast decision-making
- Strong information hierarchy
- Tailwind spacing scale (3, 4, 6, 8, 12, 16) for consistent rhythm
- Card-based layouts for grouping related content

**Responsive Grid System**
- Dashboard folders: 3 columns (desktop) → 2 (tablet) → 1 (mobile)
- Content feed: Single column full-width for readability
- Kanban board: Horizontal scroll with fixed-width columns (min-w-80)
- Ideas table: Full-width responsive table with overflow handling