import { z } from "zod";

const featureSchema = z.object({
  emoji: z.string().max(4).default("✨"),
  title: z.string().max(80).default(""),
  description: z.string().max(300).default(""),
});

const landingHeroSchema = z.object({
  eyebrow: z.string().max(80).default("منصة نَسَق"),
  title: z.string().max(160).default("أدِر محتواك وطوِّر أفكارك بالذكاء الاصطناعي"),
  subtitle: z.string().max(400).default(""),
  ctaText: z.string().max(40).default("ابدأ الآن"),
});

const landingAboutSchema = z.object({
  title: z.string().max(120).default("ما هي نَسَق؟"),
  body: z.string().max(1000).default(""),
});

const landingSeoSchema = z.object({
  metaTitle: z.string().max(80).default("نَسَق — منصة إدارة المحتوى للمبدعين العرب"),
  metaDescription: z.string().max(300).default(""),
});

export const landingPageContentSchema = z.object({
  hero: landingHeroSchema,
  about: landingAboutSchema,
  features: z.array(featureSchema).max(6).default([]),
  seo: landingSeoSchema,
});

export const landingPageContentAdminSchema = z.object({
  hero: landingHeroSchema.extend({
    eyebrow: z.string().min(1).max(80),
    title: z.string().min(1).max(160),
    subtitle: z.string().max(400),
    ctaText: z.string().min(1).max(40),
  }),
  about: landingAboutSchema.extend({
    title: z.string().min(1).max(120),
    body: z.string().max(1000),
  }),
  features: z.array(
    featureSchema.extend({
      emoji: z.string().max(4),
      title: z.string().min(1).max(80),
      description: z.string().max(300),
    }),
  ).max(6),
  seo: landingSeoSchema.extend({
    metaTitle: z.string().min(1).max(80),
    metaDescription: z.string().max(300),
  }),
});

export type LandingPageContent = z.infer<typeof landingPageContentSchema>;

export const defaultLandingPageContent: LandingPageContent = {
  hero: {
    eyebrow: "منصة نَسَق",
    title: "أدِر محتواك وطوِّر أفكارك بالذكاء الاصطناعي",
    subtitle: "نَسَق هي منصة ذكية لمنشئي المحتوى العربي — تجمع مصادرك، تلخّص لك الأخبار، وتساعدك على توليد أفكار فيديوهات احترافية بالذكاء الاصطناعي.",
    ctaText: "ابدأ الآن",
  },
  about: {
    title: "ما هي نَسَق؟",
    body: "نَسَق منصة متكاملة تُمكّن منشئي المحتوى العرب من متابعة مصادر الأخبار والمحتوى بشكل مُنظَّم، والاستفادة من الذكاء الاصطناعي لتوليد أفكار فيديوهات إبداعية وجاهزة للتنفيذ. سواء كنت صاحب قناة يوتيوب أو منشئ محتوى على منصات التواصل الاجتماعي، نَسَق توفّر لك كل الأدوات في مكان واحد.",
  },
  features: [
    { emoji: "📂", title: "تنظيم المصادر في مجلدات", description: "رتّب مصادر RSS ويوتيوب وتويتر وغيرها في مجلدات ذكية مصنّفة بحسب اهتماماتك ومجال عملك." },
    { emoji: "🤖", title: "ذكاء اصطناعي حقيقي", description: "المساعد الذكي فِكري يساعدك على توليد أفكار فيديوهات احترافية وكتابة سكريبتات جاهزة للتنفيذ." },
    { emoji: "📊", title: "تحليل وإحصائيات", description: "تابع توجهات المجال، حلّل مشاعر المحتوى، واحصل على رؤى بيانية شاملة لاتخاذ قرارات أذكى." },
    { emoji: "🔔", title: "إشعارات فورية", description: "تلقّ تنبيهات تلقائية عبر سلاك وتيليجرام حين يصدر محتوى جديد يناسب اهتماماتك." },
  ],
  seo: {
    metaTitle: "نَسَق — منصة إدارة المحتوى للمبدعين العرب",
    metaDescription: "منصة نَسَق لمنشئي المحتوى العربي: تجميع RSS ويوتيوب وتويتر، تلخيص بالذكاء الاصطناعي، وتوليد أفكار فيديوهات احترافية.",
  },
};

export function parseLandingPageContent(value: unknown): LandingPageContent {
  try {
    const parsed = landingPageContentSchema.safeParse(value);
    if (!parsed.success) return defaultLandingPageContent;
    return parsed.data;
  } catch {
    return defaultLandingPageContent;
  }
}
