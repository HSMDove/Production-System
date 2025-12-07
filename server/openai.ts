import OpenAI from "openai";
import type { Content, IdeaCategory, InsertIdea, PromptTemplate } from "@shared/schema";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface GeneratedIdea {
  title: string;
  description: string;
  category: IdeaCategory;
  estimatedDuration: string;
  targetAudience: string;
}

const DEFAULT_PROMPT = `أنت منتج محتوى تقني عربي متخصص في إنشاء أفكار فيديوهات لقناة يوتيوب تقنية عربية تُدعى "Tech Voice".

بناءً على الأخبار التقنية التالية في مجال "{{FOLDER_NAME}}":

{{CONTENT_SUMMARY}}

قم بإنشاء 3-5 أفكار فيديو مبتكرة. لكل فكرة، قدم:
- عنوان جذاب بالعربية
- وصف مختصر (2-3 جمل)
- نوع الفيديو من القائمة التالية فقط: thalathiyat (ثلاثيات - فيديوهات قصيرة), leh (ليه - شرح أسباب), tech_i_use (تقنية أستخدمها), news_roundup (ملخص أخبار), deep_dive (تعمق), comparison (مقارنة), tutorial (شرح), other (أخرى)
- المدة التقريبية (مثل: 5-8 دقائق)
- الجمهور المستهدف

أجب بصيغة JSON فقط بالشكل التالي:
{
  "ideas": [
    {
      "title": "العنوان",
      "description": "الوصف",
      "category": "نوع الفيديو",
      "estimatedDuration": "المدة",
      "targetAudience": "الجمهور"
    }
  ]
}`;

export function getDefaultPromptContent(): string {
  return DEFAULT_PROMPT;
}

export async function generateIdeasFromContent(
  contentItems: Content[],
  folderName: string,
  folderId: string,
  customTemplate?: PromptTemplate | null
): Promise<InsertIdea[]> {
  if (contentItems.length === 0) {
    return [];
  }

  const contentSummary = contentItems
    .slice(0, 10)
    .map((item, i) => `${i + 1}. ${item.title}${item.summary ? `: ${item.summary}` : ""}`)
    .join("\n");

  const promptTemplate = customTemplate?.promptContent || DEFAULT_PROMPT;
  const prompt = promptTemplate
    .replace("{{FOLDER_NAME}}", folderName)
    .replace("{{CONTENT_SUMMARY}}", contentSummary);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "أنت مساعد متخصص في إنشاء أفكار محتوى تقني عربي. أجب دائماً بصيغة JSON صالحة."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    const parsed = JSON.parse(content) as { ideas: GeneratedIdea[] };
    
    return parsed.ideas.map((idea) => ({
      folderId,
      title: idea.title,
      description: idea.description,
      category: idea.category,
      status: "raw_idea" as const,
      estimatedDuration: idea.estimatedDuration,
      targetAudience: idea.targetAudience,
    }));
  } catch (error) {
    console.error("Error generating ideas:", error);
    throw new Error("Failed to generate ideas from AI");
  }
}
