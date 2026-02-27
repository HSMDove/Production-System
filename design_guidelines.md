# Tech Voice Content Platform - Design Guidelines

## Design Approach

**Selected System**: Linear-inspired productivity design with Material Design RTL patterns
- Clean, focused interface prioritizing content density and workflow efficiency
- Minimal visual noise to support fast decision-making
- Strong information hierarchy for Arabic content consumption

## RTL Arabic-First Design Principles

**Critical RTL Implementation**:
- All layouts mirror horizontally - navigation on right, content flows right-to-left
- Icons and arrows reverse direction appropriately
- Text alignment: right-aligned by default
- Spacing and padding mirror naturally
- Folder cards, feed items, and kanban columns flow RTL
- Form labels position to the right of inputs

## Typography

**Font Stack**:
- Primary: 'Cairo' or 'Tajawal' (Google Fonts) - excellent Arabic readability
- Fallback: system Arabic fonts

**Scale**:
- Page titles: text-3xl font-bold (32px)
- Section headers: text-2xl font-semibold (24px)
- Card titles: text-lg font-medium (18px)
- Body text: text-base (16px)
- Metadata/timestamps: text-sm text-gray-600 (14px)
- Button text: text-sm font-medium

## Layout System

**Spacing Primitives**: Use Tailwind units of 3, 4, 6, 8, 12, 16
- Component padding: p-4, p-6
- Section spacing: gap-8, gap-12
- Page margins: p-8 to p-16
- Card spacing: space-y-4

**Grid Patterns**:
- Dashboard folders: 3-column grid on desktop (grid-cols-3), 2 on tablet, 1 on mobile
- Feed items: Single column full-width list
- Kanban board: Horizontal scrollable columns (flex with min-w-80 per column)
- Ideas table: Full-width responsive table

## Component Library

### Navigation
**Top Bar** (fixed, w-full):
- Right: Logo + "Tech Voice" wordmark
- Left: Settings icon, user profile
- Height: h-16
- Border bottom with subtle shadow

### Dashboard
**Folder Cards**:
- Rounded-lg border with hover:shadow-md transition
- Padding: p-6
- Display: Folder name (text-xl font-semibold), source count, last updated timestamp
- Action: Click anywhere to enter folder
- Add Folder card: Dashed border with centered "+" icon

### Folder Feed View
**Header Section**:
- Breadcrumb navigation (Dashboard > Folder Name)
- Folder title with edit icon
- "Generate Ideas" button (prominent, bg-primary)
- Filter/sort controls (dropdowns for source type, date sorting)

**Feed Items** (list layout):
- Card design: border rounded-lg p-4 mb-3
- Title: text-lg font-semibold mb-2
- AI Summary: text-base mb-3 (2-3 lines max)
- Metadata row: Source name (badge), Publication date, External link icon
- Hover state: subtle border color change

### Ideas Management
**Table View**:
- Striped rows for readability
- Columns: Idea Title, Category, Status Badge, Duration, Date Created, Actions
- Sortable headers with arrow indicators
- Row actions: Edit, View Notes, Delete (icon buttons)

**Kanban Board**:
- Horizontal columns: "Raw Idea", "Needs Research", "Ready for Script", "Script in Progress", "Ready for Filming", "Completed"
- Column width: min-w-80 max-w-sm
- Idea cards: Compact design with title, category badge, drag handle
- Drag and drop zones with visual feedback
- Column headers show count

### Forms & Inputs
**Source Addition Form**:
- Vertical form layout
- Input fields: Full-width with border, rounded, p-3
- Labels: Above inputs, font-medium text-sm mb-2
- Dropdown for source type: Custom styled select
- Submit button: Full-width on mobile, auto width on desktop

**Idea Detail Modal**:
- Overlay with centered modal (max-w-2xl)
- Sections: Idea content, Notes textarea, Status selector, Metadata
- Action buttons at bottom

### Buttons
**Primary**: Rounded-lg px-6 py-3 font-medium (Generate Ideas, Save)
**Secondary**: Rounded-lg px-4 py-2 border (Cancel, Edit)
**Icon Buttons**: Rounded-md p-2 (Delete, External Link)

### Status Badges
Small rounded-full px-3 py-1 text-xs with status-specific colors
- Raw Idea: Gray
- Needs Research: Blue
- Ready for Script: Yellow
- Script in Progress: Orange
- Ready for Filming: Purple
- Completed: Green

## Icons
Use **Heroicons** (outline style for most, solid for emphasis)
- Folders, Plus, Pencil, Trash, ExternalLink, Funnel, Bars, Sparkles (for AI features)

## Images
No images required - this is a productivity application focused on information density and workflow efficiency.

## Animations
**Minimal, purposeful motion**:
- Hover transitions: transition-all duration-200
- Kanban drag: Smooth reordering with position transitions
- Modal entry: Fade and scale animation (150ms)
- Loading states: Subtle skeleton screens for feed loading
- NO scroll animations or decorative effects

## Special Considerations
- Loading states for AI generation (progress indicator with estimated time)
- Empty states with helpful illustrations and CTAs ("No sources yet - Add your first source")
- Confirmation dialogs for destructive actions
- Toast notifications for success/error feedback (top-left corner in RTL)
- Mobile responsive: Collapsible sidebar, stacked layouts, bottom navigation consideration