import { z } from "zod";

const authPageSectionSchema = z.object({
  eyebrow: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
  panelTitle: z.string().default(""),
  panelDescription: z.string().default(""),
  footerNote: z.string().default(""),
  highlights: z.array(z.string()).max(3).default([]),
});

export const loginPageContentSchema = z.object({
  login: authPageSectionSchema,
  verify: authPageSectionSchema,
});

export const loginPageContentAdminSchema = z.object({
  login: authPageSectionSchema.extend({
    eyebrow: z.string().min(1).max(80),
    title: z.string().min(1).max(160),
    description: z.string().max(500),
    panelTitle: z.string().min(1).max(80),
    panelDescription: z.string().min(1).max(240),
    footerNote: z.string().max(180),
    highlights: z.array(z.string().max(180)).max(3),
  }),
  verify: authPageSectionSchema.extend({
    eyebrow: z.string().min(1).max(80),
    title: z.string().min(1).max(160),
    description: z.string().max(500),
    panelTitle: z.string().min(1).max(80),
    panelDescription: z.string().min(1).max(240),
    footerNote: z.string().max(180),
    highlights: z.array(z.string().max(180)).max(3),
  }),
});

export type LoginPageContent = z.infer<typeof loginPageContentSchema>;

export const defaultLoginPageContent: LoginPageContent = {
  login: {
    eyebrow: "بوابة الدخول",
    title: "ادخل إلى نَسَق بسرعة وأناقة",
    description: "سجّل الدخول ببريدك الإلكتروني فقط، وسنرسل لك رمز تحقق صالح لمدة خمس دقائق لإكمال الدخول بأقل خطوات ممكنة.",
    panelTitle: "تسجيل الدخول",
    panelDescription: "أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق صالح لمدة خمس دقائق.",
    footerNote: "سيتم إرسال رمز مكوّن من 6 أرقام صالح لمدة 5 دقائق",
    highlights: [
      "دخول سريع برمز تحقق يصل إلى بريدك الإلكتروني",
      "واجهة متجاوبة ومهيأة للهاتف واللابتوب",
      "خطوات واضحة تقلل التشتت أثناء تسجيل الدخول",
    ],
  },
  verify: {
    eyebrow: "تحقق آمن",
    title: "أكمل الدخول خلال ثوانٍ",
    description: "أدخل رمز التحقق الذي أرسلناه إلى بريدك الإلكتروني للمتابعة إلى حسابك.",
    panelTitle: "تأكيد البريد الإلكتروني",
    panelDescription: "أدخل الرمز المكوّن من 6 أرقام، أو أعد الإرسال إذا لم يصلك البريد بعد.",
    footerNote: "",
    highlights: [],
  },
};

const partialSectionSchema = authPageSectionSchema.partial();
const partialContentSchema = z.object({
  login: partialSectionSchema.optional(),
  verify: partialSectionSchema.optional(),
});

function normalizeSection(
  defaults: LoginPageContent["login"],
  incoming?: Partial<LoginPageContent["login"]>,
): LoginPageContent["login"] {
  return {
    eyebrow: incoming?.eyebrow ?? defaults.eyebrow,
    title: incoming?.title ?? defaults.title,
    description: incoming?.description ?? defaults.description,
    panelTitle: incoming?.panelTitle ?? defaults.panelTitle,
    panelDescription: incoming?.panelDescription ?? defaults.panelDescription,
    footerNote: incoming?.footerNote ?? defaults.footerNote,
    highlights: (incoming?.highlights ?? defaults.highlights).filter((item) => item.trim().length > 0).slice(0, 3),
  };
}

export function parseLoginPageContent(value: unknown): LoginPageContent {
  const parsed = partialContentSchema.safeParse(value);
  if (!parsed.success) {
    return defaultLoginPageContent;
  }

  return {
    login: normalizeSection(defaultLoginPageContent.login, parsed.data.login),
    verify: normalizeSection(defaultLoginPageContent.verify, parsed.data.verify),
  };
}
