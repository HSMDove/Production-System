import type { Folder, Source, Content, Idea, IdeaStatus, SourceType, IdeaComment, IdeaAssignment } from "@shared/schema";

export type { Folder, Source, Content, Idea, IdeaStatus, SourceType, IdeaComment, IdeaAssignment };

// Extended types with relations
export interface FolderWithSources extends Folder {
  sources: Source[];
  _count?: {
    sources: number;
    content: number;
    ideas: number;
  };
}

export interface ContentWithSource extends Content {
  source: Source | null;
  folder?: { id: string; name: string } | null;
}

export interface IdeaWithFolder extends Idea {
  folder?: Folder | null;
}

// Status labels in Arabic
export const ideaStatusLabels: Record<string, string> = {
  raw_idea: "فكرة خام",
  needs_research: "تحتاج بحث",
  ready_for_script: "جاهزة للكتابة",
  script_in_progress: "قيد الكتابة",
  ready_for_filming: "جاهزة للتصوير",
  completed: "مكتملة",
};


export const sourceTypeLabels: Record<string, string> = {
  rss: "RSS",
  website: "موقع",
  youtube: "يوتيوب",
  twitter: "تويتر/X",
  tiktok: "تيك توك",
};

const CATEGORY_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300" },
  { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300" },
  { bg: "bg-lime-100 dark:bg-lime-900/30", text: "text-lime-700 dark:text-lime-300" },
  { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300" },
];

export function getCategoryColor(category: string): { bg: string; text: string } {
  if (!category) return { bg: "bg-gray-100 dark:bg-gray-900/30", text: "text-gray-700 dark:text-gray-300" };
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

// Status colors
export const statusColors: Record<string, { bg: string; text: string }> = {
  raw_idea: { bg: "bg-muted", text: "text-muted-foreground" },
  needs_research: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
  ready_for_script: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300" },
  script_in_progress: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
  ready_for_filming: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300" },
  completed: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
};

