# نَسَق (NasaqApp)

## Overview

نَسَق (NasaqApp) is an internal content management tool designed to aggregate bilingual tech news from RSS feeds. It translates and rewrites content into "Saudi Casual Tech" Arabic using AI, then automatically publishes it to Telegram and Slack. The application features a Feedly-like interface with a sidebar for sources, an automatic update system, and a strong focus on speed, reliability, and automation for exclusive content publishing. It includes full RTL support for Arabic content. The project aims to provide a streamlined solution for content curators to gather, localize, and distribute tech news efficiently, enhancing engagement with a uniquely tailored Arabic voice.

## User Preferences

Preferred communication style: Simple, everyday language.
Developer: حسام تيك فيلد (Hossam TechField)

## System Architecture

### Frontend Architecture

The frontend is built with React 18 and TypeScript, using Vite for fast development. It employs Wouter for routing and TanStack Query for server state management. The UI utilizes shadcn/ui components (New York variant) based on Radix UI, styled with Tailwind CSS, and incorporates custom RTL-aware configurations. Arabic fonts Cairo and Tajawal are used for optimal readability. State is managed via React Query for server data, React Hook Form with Zod for form validation, and React hooks for local component state. A Context API manages theme and an AutoRefreshProvider handles automatic content updates. Key features include a drag-and-drop Kanban board, responsive design, real-time AI progress tracking, and a Feedly-style sources sidebar.

### Backend Architecture

The backend is built with Node.js and Express.js, entirely in TypeScript, and bundled with ESBuild. It provides RESTful API endpoints for CRUD operations on folders, sources, content, and ideas. The system integrates an RSS Parser with concurrency limits and retry mechanisms for robust content fetching, including fallbacks for Twitter/X and TikTok. AI integration leverages the OpenAI API for generating video ideas, rewriting content, summarizing, translating, and explaining news items, with a customizable AI persona. The system features a provider-agnostic AI engine that supports both "Production Cloud" and "Custom/Local" AI configurations, with strict API key enforcement and system defaults. Feature flags and administrative controls are managed via a `system_settings` table, allowing for dynamic feature enablement and AI provider configuration. API usage, including AI and search requests, is meticulously tracked in an `api_usage_logs` table.

### Fikri Kashshaf Feature

AI-powered source discovery assistant. Found in:
- **Frontend**: `client/src/components/sources/fikri-kashshaf-dialog.tsx` — a 6-step wizard dialog (field → language → source types → depth → content nature → count) that calls the discovery API and displays added sources.
- **Backend**: `POST /api/folders/:folderId/discover-sources` in `server/routes.ts` — builds targeted Brave Search queries, runs them in parallel, passes results to the AI for evaluation and ranking, then auto-creates the selected sources in the folder.
- **Entry point**: "فكري الكشّاف" button in `source-list.tsx` header (Sources tab of folder detail page).

### Data Storage

The application uses PostgreSQL hosted on Neon, accessed via Drizzle ORM for type-safe queries and schema management. The schema includes tables for `folders`, `sources`, `content`, `ideas`, `settings`, `prompt_templates` (renamed to "Content Templates" in UI), `idea_comments`, `idea_assignments`, `style_examples`, `training_samples`, `integration_channels`, and `folder_channel_mappings`. This design supports multi-tenancy by scoping resources like folders, ideas, and conversations by user ID. The `content` table includes a `usedForIdeas` flag to prevent duplicate use of news items for AI generation.

### Fikri 2.0 Personal Training System

Users can submit text samples (scripts, video descriptions, notes) via the Settings → "فكري 2.0" tab. Content can be pasted directly, uploaded as a text file, or imported from Google Docs via URL. Each sample is analyzed by AI to extract a style fingerprint. All sample fingerprints are then merged into a single "style profile" (`style_profile` setting) — a compressed style profile covering tone, title patterns, narrative structure, recurring terms, and explanation style. This profile is automatically injected into idea generation prompts to produce ideas that match the user's personal writing style. The old "أمثلة أسلوبية سابقة" (style examples) system has been merged into this unified training system. The system includes:
- `training_samples` table: stores user-uploaded text samples with extracted style per sample
- `style_profile` setting: the merged style fingerprint used in all idea generation
- Google Docs integration: `server/google-docs.ts` — fetches public Google Doc content via export URL (no account linking needed; user must enable "Anyone with the link can view")
- Training APIs: `POST /api/training/submit`, `POST /api/training/analyze`, `POST /api/training/fetch-gdoc`, `GET /api/training/samples`, `DELETE /api/training/samples/:id`, `PUT /api/training/style-matrix`
- AI functions: `analyzeTrainingSampleStyle()` and `generateStyleMatrix()` in `server/openai.ts`
- Content type selector includes a disabled "مقطع (قريباً)" option for future video clip support

### Design Principles

The design adopts an RTL-first approach, mirroring layouts for Arabic reading direction, positioning navigation on the right, and using right-aligned text. It emphasizes content density with minimal visual clutter, strong information hierarchy, and consistent spacing. A responsive grid system ensures adaptability across devices, with specific layouts for dashboards, content feeds, and Kanban boards.

## External Dependencies

### AI Services

- **OpenAI API**: Used for all AI functionalities including content rewriting, summarization, translation, explanation, and video idea generation. The architecture is provider-agnostic, allowing configuration of custom API endpoints (e.g., for Ollama, LM Studio).
- **Customizable AI Providers**: Supports dynamic configuration of AI base URLs, API keys, and models via user settings.

### Multi-Integration Smart Routing

Users can add multiple Telegram bots or Slack connections as "integration channels", then map specific folders to specific channels. When new content arrives in a folder, the notifier checks for folder-channel mappings first (smart routing); if none exist, it falls back to the legacy global settings. Key components:
- `integration_channels` table: stores platform, name, encrypted credentials (bot_token for Telegram, bot_token/webhook_url for Slack), and active status
- `folder_channel_mappings` table: maps a folder to an integration channel with a target ID (chat_id for Telegram, Slack channel ID for Slack)
- Storage methods in `server/storage.ts`: full CRUD for channels and mappings with credential encryption via `encryptRawValue`/`decryptRawValue`
- API routes: `GET/POST/PUT/DELETE /api/integrations/channels`, `POST /api/integrations/channels/:id/test`, `GET/POST/DELETE /api/integrations/folder-mappings`
- **Slack OAuth flow**: `GET /api/integrations/slack/oauth/start` (redirects to Slack auth), `GET /api/integrations/slack/oauth/callback` (exchanges code for bot_token, stores in integration_channels with `connection_type: "oauth"`), `GET /api/integrations/slack/channels` (fetches workspace channels via conversations.list from both OAuth and manual tokens). Requires `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, optional `SLACK_REDIRECT_URI` env vars.
- Smart routing logic in `server/notifier.ts` (`processNewContentNotificationsForFolder`): checks folder mappings first, uses `chat.postMessage` for OAuth bot tokens or webhook for legacy, falls back to legacy settings
- Settings UI: Slack section has "ربط تلقائي" (OAuth one-click) and "ربط يدوي" (manual setup) tabs. Folder mapping uses Slack channel dropdown (from API) instead of manual text input when Slack is selected.

### Admin Dashboard System

A password-protected admin layer built on top of the OTP auth system. Key components:
- **Auth flow**: Admin users (identified by `isAdmin` flag on `users` table) must enter a separate admin password after OTP login to access the dashboard. Session tracks `adminMode`.
- **Database tables**: `announcements` (modal cards shown to users), `announcement_views` (per-user view tracking), `top_banners` (colored banners at top of app), `admin_audit_logs` (all admin actions logged)
- **User fields**: `is_admin`, `admin_role` (super_admin/admin), `admin_password_hash` on `users` table
- **Admin API routes**: All under `/api/admin/*` protected by `requireAdmin` middleware. Includes analytics, user management, announcement CRUD, banner CRUD, system settings management, admin management, and audit logs.
- **Frontend pages**: `admin-login.tsx` (password entry), `admin-dashboard.tsx` (full dashboard with sidebar navigation and 7 panels: Analytics, Users, Announcements, Banners, System Settings, Admin Management, Audit Logs)
- **User-facing components**: `AnnouncementModal` (shows unseen announcements as modal cards on app open), `TopBannerDisplay` (colored banner at top of app with optional link)
- **Super admin**: `hylf.111@gmail.com` — password set via DB seed (change on first login via Admin Management panel)
- **Shield icon**: Admin users see a shield icon in the header navigation linking to `/admin/login`
- **Dynamic version**: App version shown at bottom of settings page is read from `app_version` system setting via `/api/version` endpoint (public, no auth required)

### Welcome Cards System

Animated welcome card slideshow displayed to users after login. Replaces the old TeaserBanner. Key components:
- **Database tables**: `welcome_cards` (sort_order, title, body, emoji, show_user_name, is_final, is_active), `welcome_card_views` (per-user completion tracking)
- **Display modes** via `welcome_display_mode` system setting: `once` (show once per user), `always` (every login), `disabled` (off)
- **Name interpolation**: Cards with `show_user_name=true` replace `{name}` in title/body with the user's name
- **User API**: `GET /api/welcome-cards` (returns active cards + show flag based on mode/view status), `POST /api/welcome-cards/seen` (mark as seen)
- **Admin API**: Full CRUD under `/api/admin/welcome-cards`, `PUT /api/admin/welcome-display-mode`, `POST /api/admin/welcome-cards/reset-views`
- **Frontend component**: `client/src/components/welcome-cards.tsx` — fullscreen modal overlay with card pagination, dot indicators, and animated transitions
- **Admin dashboard**: "بطاقات الترحيب" panel with card management, display mode toggle, and view reset

### Support Ticket System

Users can submit support tickets ("عندي مشكلة") from the Settings → Account tab. Key components:
- **Database tables**: `support_tickets` (title, description, optional image_urls, status), `ticket_replies` (threaded conversation between user and admin)
- **Ticket statuses**: `open` (خامل), `in_progress` (جارٍ العمل عليها), `resolved` (تم العمل عليها)
- **User API**: `POST /api/tickets` (create), `GET /api/tickets` (list own), `GET /api/tickets/:id` (detail + replies), `POST /api/tickets/:id/reply` (user reply)
- **Admin API**: `GET /api/admin/tickets` (all tickets with user info), `GET /api/admin/tickets/:id` (detail), `PATCH /api/admin/tickets/:id/status` (change status), `POST /api/admin/tickets/:id/reply` (reply + email notification)
- **Email notification**: When admin replies, user receives a branded email via Resend from `noreply@nasaqapp.net`
- **Admin dashboard**: "الشكاوى والتذاكر" panel with ticket list, status management dropdown, and reply textarea
- **User UI**: "عندي مشكلة" card in Settings → Account tab with new ticket form (title, description, image upload), ticket list, and conversation view

### Smart View & Red Dot System

The Smart View is an instant toggle that switches between original content (English title/summary) and AI-processed content (arabicTitle/arabicFullSummary). Key design:
- **Sequential Pipeline (Extract → Transform → Load)**: Content goes through a mandatory 3-stage pipeline in `folder-fetcher.ts`:
  1. **Extract**: Content fetched and saved with `processingStatus: 'processing'` — invisible to frontend
  2. **Transform**: AI (فكري) generates `arabicTitle` + `arabicFullSummary` sequentially (awaited, not fire-and-forget). Retry up to 2 attempts; if all fail, content publishes with original text as fallback
  3. **Load**: Content marked `processingStatus: 'ready'` — now visible to users
- **Schema field**: `content.processing_status` text ('processing' | 'ready' | 'failed'), default 'ready'
- **Frontend filter**: All content queries (`getContentByFolderId`, `getAllContent`, `getUndisplayedContentCount`, `markContentDisplayed`) filter by `processingStatus = 'ready'`
- **Instant toggle**: No API call needed — Smart View just reads pre-computed fields from content data. Toggle state persisted in localStorage per folder
- **Red dot indicator**: New content inserted with `displayedToUser: false`. A polling query (`/api/folders/:id/new-content-count`) checks every 60s. Only counts `ready` content. Red dot appears on refresh button with count. Clicking marks all as displayed (`/api/folders/:id/mark-displayed`) and refreshes the feed
- **Removed UI**: translate button, summarize popover, explain dialog — all replaced by the single Smart View toggle

### Notification Pipeline

- **Telegram Bot API**: For automated content notifications with HTML formatting.
- **Slack Webhook Integration**: For automated content notifications with Markdown formatting.

### Database

- **PostgreSQL**: The primary relational database, hosted on Neon.
- **Drizzle ORM**: Used for interacting with the PostgreSQL database.
- **connect-pg-simple**: For PostgreSQL-backed session storage.

### Headless Browser Scraping Engine

For protected websites that block normal HTTP requests (403/anti-bot), a Puppeteer-based headless browser engine provides fallback scraping. Key components:
- **File**: `server/browser-scraper.ts` — shared browser pool with lazy launch, singleton lock, 60s idle auto-close
- **Dependencies**: `puppeteer-core`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth` + system Chromium via Nix
- **CHROMIUM_PATH**: `/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium` (override with `CHROMIUM_PATH` env var if Nix path changes)
- **Functions**: `scrapePageWithBrowser(url)` returns rendered HTML, `scrapeArticlesWithBrowser(url)` extracts article links/titles via DOM queries, `scrapeTwitterWithBrowser(url)` extracts tweets
- **Fallback chain** in `server/fetcher.ts`: normal fetch → retry with different User-Agent → headless browser page render → browser article extraction
- **Important**: `page.evaluate` calls use raw JS strings (not TypeScript functions) to avoid esbuild's `__name` injection breaking browser context. URLs are passed safely via `JSON.stringify` + `window.__extractBaseUrl`.

### Third-Party Libraries

- **RSS Parser**: For parsing RSS feeds.
- **date-fns**: For date formatting and manipulation, with Arabic locale support.
- **Radix UI**: Provides accessible component primitives for the UI.
- **Lucide React**: Icon library.
- **Puppeteer Extra + Stealth**: Headless browser scraping with bot detection bypass.

### Development Tools

- **TypeScript**: For type-safe development.
- **PostCSS with Autoprefixer**: For CSS processing.