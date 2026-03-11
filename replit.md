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

The application uses PostgreSQL hosted on Neon, accessed via Drizzle ORM for type-safe queries and schema management. The schema includes tables for `folders`, `sources`, `content`, `ideas`, `settings`, `prompt_templates` (renamed to "Content Templates" in UI), `idea_comments`, `idea_assignments`, and `style_examples`. This design supports multi-tenancy by scoping resources like folders, ideas, and conversations by user ID. The `content` table includes a `usedForIdeas` flag to prevent duplicate use of news items for AI generation.

### Design Principles

The design adopts an RTL-first approach, mirroring layouts for Arabic reading direction, positioning navigation on the right, and using right-aligned text. It emphasizes content density with minimal visual clutter, strong information hierarchy, and consistent spacing. A responsive grid system ensures adaptability across devices, with specific layouts for dashboards, content feeds, and Kanban boards.

## External Dependencies

### AI Services

- **OpenAI API**: Used for all AI functionalities including content rewriting, summarization, translation, explanation, and video idea generation. The architecture is provider-agnostic, allowing configuration of custom API endpoints (e.g., for Ollama, LM Studio).
- **Customizable AI Providers**: Supports dynamic configuration of AI base URLs, API keys, and models via user settings.

### Notification Pipeline

- **Telegram Bot API**: For automated content notifications with HTML formatting.
- **Slack Webhook Integration**: For automated content notifications with Markdown formatting.

### Database

- **PostgreSQL**: The primary relational database, hosted on Neon.
- **Drizzle ORM**: Used for interacting with the PostgreSQL database.
- **connect-pg-simple**: For PostgreSQL-backed session storage.

### Third-Party Libraries

- **RSS Parser**: For parsing RSS feeds.
- **date-fns**: For date formatting and manipulation, with Arabic locale support.
- **Radix UI**: Provides accessible component primitives for the UI.
- **Lucide React**: Icon library.

### Development Tools

- **TypeScript**: For type-safe development.
- **PostCSS with Autoprefixer**: For CSS processing.