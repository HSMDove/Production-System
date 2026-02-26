import { storage } from "./storage";
import { rewriteContent } from "./openai";
import type { Content, Folder } from "@shared/schema";

async function getSettingsMap(): Promise<Map<string, string | null>> {
  const allSettings = await storage.getAllSettings();
  const map = new Map<string, string | null>();
  for (const s of allSettings) {
    map.set(s.key, s.value);
  }
  return map;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });
    const data = await response.json() as any;
    if (!data.ok) {
      console.error("Telegram API error:", data.description);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

async function sendSlackMessage(
  webhookUrl: string,
  message: string
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    return response.ok;
  } catch (error) {
    console.error("Error sending Slack message:", error);
    return false;
  }
}

function formatTelegramMessage(contentItem: Content, rewrittenText: string): string {
  const title = contentItem.arabicTitle || contentItem.title;
  const text = rewrittenText || contentItem.arabicSummary || contentItem.summary || "";
  
  let message = "";
  if (text !== title) {
    message += `<b>${escapeHtml(title)}</b>\n\n`;
  }
  message += escapeHtml(text);
  if (contentItem.originalUrl) {
    message += `\n\n<a href="${contentItem.originalUrl}">المصدر</a>`;
  }
  message += `\n\n#نظام_الإنتاج`;
  return message;
}

function formatSlackMessage(contentItem: Content, rewrittenText: string): string {
  const title = contentItem.arabicTitle || contentItem.title;
  const text = rewrittenText || contentItem.arabicSummary || contentItem.summary || "";
  
  let message = `*${title}*\n\n${text}`;
  if (contentItem.originalUrl) {
    message += `\n\n<${contentItem.originalUrl}|المصدر>`;
  }
  return message;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function processNewContentNotifications(newContentIds: string[]): Promise<{
  processed: number;
  notified: number;
  errors: string[];
}> {
  if (newContentIds.length === 0) {
    return { processed: 0, notified: 0, errors: [] };
  }

  const settingsMap = await getSettingsMap();
  const notificationsEnabled = settingsMap.get("notifications_enabled") === "true";
  
  if (!notificationsEnabled) {
    return { processed: 0, notified: 0, errors: [] };
  }

  const telegramEnabled = settingsMap.get("telegram_enabled") === "true";
  const slackEnabled = settingsMap.get("slack_enabled") === "true";
  
  if (!telegramEnabled && !slackEnabled) {
    return { processed: 0, notified: 0, errors: [] };
  }

  const telegramToken = settingsMap.get("telegram_bot_token") || "";
  const telegramChatId = settingsMap.get("telegram_chat_id") || "";
  const slackWebhookUrl = settingsMap.get("slack_webhook_url") || "";
  const systemPrompt = settingsMap.get("ai_system_prompt");
  if (systemPrompt) {
    console.log(`[Notifier] Custom AI system prompt loaded: "${systemPrompt.substring(0, 50)}${systemPrompt.length > 50 ? '...' : ''}"`);
  }

  let processed = 0;
  let notified = 0;
  const errors: string[] = [];

  for (const contentId of newContentIds) {
    try {
      const contentItem = await storage.getContentById(contentId);
      if (!contentItem || contentItem.notifiedAt) continue;

      processed++;

      const titleForRewrite = contentItem.arabicTitle || contentItem.title;
      const summaryForRewrite = contentItem.arabicSummary || contentItem.summary;

      let rewrittenText = "";
      try {
        rewrittenText = await rewriteContent(
          titleForRewrite,
          summaryForRewrite,
          systemPrompt
        );
        if (rewrittenText) {
          await storage.updateContentRewrite(contentId, rewrittenText);
        }
      } catch (e) {
        console.error("AI rewrite failed for content:", contentId, e);
        rewrittenText = contentItem.arabicSummary || contentItem.summary || contentItem.title;
      }

      let sent = false;

      if (telegramEnabled && telegramToken && telegramChatId) {
        const telegramMsg = formatTelegramMessage(contentItem, rewrittenText);
        const telegramSent = await sendTelegramMessage(telegramToken, telegramChatId, telegramMsg);
        if (telegramSent) sent = true;
        else errors.push(`Telegram failed for: ${contentItem.title}`);
      }

      if (slackEnabled && slackWebhookUrl) {
        const slackMsg = formatSlackMessage(contentItem, rewrittenText);
        const slackSent = await sendSlackMessage(slackWebhookUrl, slackMsg);
        if (slackSent) sent = true;
        else errors.push(`Slack failed for: ${contentItem.title}`);
      }

      if (sent) {
        await storage.markContentNotified(contentId);
        notified++;
      } else {
        errors.push(`No channel sent for: ${contentItem.title}`);
      }

    } catch (error) {
      console.error("Error processing notification for content:", contentId, error);
      errors.push(`Error processing: ${contentId}`);
    }
  }

  return { processed, notified, errors };
}

export async function broadcastSingleContent(contentId: string): Promise<{
  success: boolean;
  channels: string[];
  error?: string;
}> {
  const settingsMap = await getSettingsMap();

  const telegramEnabled = settingsMap.get("telegram_enabled") === "true";
  const slackEnabled = settingsMap.get("slack_enabled") === "true";
  const telegramToken = settingsMap.get("telegram_bot_token") || "";
  const telegramChatId = settingsMap.get("telegram_chat_id") || "";
  const slackWebhookUrl = settingsMap.get("slack_webhook_url") || "";
  const systemPrompt = settingsMap.get("ai_system_prompt");
  if (systemPrompt) {
    console.log(`[Broadcast] Custom AI system prompt loaded: "${systemPrompt.substring(0, 50)}${systemPrompt.length > 50 ? '...' : ''}"`);
  }

  if (!telegramEnabled && !slackEnabled) {
    return { success: false, channels: [], error: "لا توجد قنوات مفعّلة - فعّل تيليجرام أو سلاك من الإعدادات" };
  }

  const contentItem = await storage.getContentById(contentId);
  if (!contentItem) {
    return { success: false, channels: [], error: "المحتوى غير موجود" };
  }

  const titleForRewrite = contentItem.arabicTitle || contentItem.title;
  const summaryForRewrite = contentItem.arabicSummary || contentItem.summary;

  let rewrittenText = contentItem.rewrittenContent || "";
  if (!rewrittenText) {
    try {
      rewrittenText = await rewriteContent(titleForRewrite, summaryForRewrite, systemPrompt);
      if (rewrittenText) {
        await storage.updateContentRewrite(contentId, rewrittenText);
      }
    } catch (e) {
      console.error("AI rewrite failed for broadcast:", contentId, e);
      rewrittenText = contentItem.arabicSummary || contentItem.summary || contentItem.title;
    }
  }

  const channels: string[] = [];

  if (telegramEnabled && telegramToken && telegramChatId) {
    const telegramMsg = formatTelegramMessage(contentItem, rewrittenText);
    const telegramSent = await sendTelegramMessage(telegramToken, telegramChatId, telegramMsg);
    if (telegramSent) channels.push("telegram");
  }

  if (slackEnabled && slackWebhookUrl) {
    const slackMsg = formatSlackMessage(contentItem, rewrittenText);
    const slackSent = await sendSlackMessage(slackWebhookUrl, slackMsg);
    if (slackSent) channels.push("slack");
  }

  if (channels.length > 0) {
    await storage.markContentNotified(contentId);
    return { success: true, channels };
  }

  return { success: false, channels: [], error: "فشل الإرسال لجميع القنوات" };
}

export async function processNewContentNotificationsForFolder(
  newContentIds: string[],
  folder: Folder
): Promise<{ processed: number; notified: number; errors: string[] }> {
  if (newContentIds.length === 0) {
    return { processed: 0, notified: 0, errors: [] };
  }

  const settingsMap = await getSettingsMap();
  const notificationsEnabled = settingsMap.get("notifications_enabled") === "true";

  if (!notificationsEnabled) {
    return { processed: 0, notified: 0, errors: [] };
  }

  const globalTelegramEnabled = settingsMap.get("telegram_enabled") === "true";
  const globalSlackEnabled = settingsMap.get("slack_enabled") === "true";

  const telegramEnabled = globalTelegramEnabled && folder.notifyTelegram;
  const slackEnabled = globalSlackEnabled && folder.notifySlack;

  if (!telegramEnabled && !slackEnabled) {
    return { processed: 0, notified: 0, errors: [] };
  }

  const telegramToken = settingsMap.get("telegram_bot_token") || "";
  const telegramChatId = settingsMap.get("telegram_chat_id") || "";
  const slackWebhookUrl = settingsMap.get("slack_webhook_url") || "";
  const systemPrompt = settingsMap.get("ai_system_prompt");
  if (systemPrompt) {
    console.log(`[Notifier Folder] Custom AI system prompt loaded: "${systemPrompt.substring(0, 50)}${systemPrompt.length > 50 ? '...' : ''}"`);
  }

  let processed = 0;
  let notified = 0;
  const errors: string[] = [];

  for (const contentId of newContentIds) {
    try {
      const contentItem = await storage.getContentById(contentId);
      if (!contentItem || contentItem.notifiedAt) continue;

      processed++;

      const titleForRewrite = contentItem.arabicTitle || contentItem.title;
      const summaryForRewrite = contentItem.arabicSummary || contentItem.summary;

      let rewrittenText = "";
      try {
        rewrittenText = await rewriteContent(titleForRewrite, summaryForRewrite, systemPrompt);
        if (rewrittenText) {
          await storage.updateContentRewrite(contentId, rewrittenText);
        }
      } catch (e) {
        console.error("AI rewrite failed for content:", contentId, e);
        rewrittenText = contentItem.arabicSummary || contentItem.summary || contentItem.title;
      }

      let sent = false;

      if (telegramEnabled && telegramToken && telegramChatId) {
        const telegramMsg = formatTelegramMessage(contentItem, rewrittenText);
        const telegramSent = await sendTelegramMessage(telegramToken, telegramChatId, telegramMsg);
        if (telegramSent) sent = true;
        else errors.push(`Telegram failed for: ${contentItem.title}`);
      }

      if (slackEnabled && slackWebhookUrl) {
        const slackMsg = formatSlackMessage(contentItem, rewrittenText);
        const slackSent = await sendSlackMessage(slackWebhookUrl, slackMsg);
        if (slackSent) sent = true;
        else errors.push(`Slack failed for: ${contentItem.title}`);
      }

      if (sent) {
        await storage.markContentNotified(contentId);
        notified++;
      } else {
        errors.push(`No channel sent for: ${contentItem.title}`);
      }
    } catch (error) {
      console.error("Error processing notification for content:", contentId, error);
      errors.push(`Error processing: ${contentId}`);
    }
  }

  return { processed, notified, errors };
}

export async function testTelegramConnection(
  botToken: string,
  chatId: string
): Promise<{ success: boolean; error?: string }> {
  const message = "✅ <b>نظام الإنتاج</b>\n\nتم الاتصال بنجاح! هذه رسالة اختبار من منصة نظام الإنتاج.";
  try {
    const sent = await sendTelegramMessage(botToken, chatId, message);
    return sent 
      ? { success: true } 
      : { success: false, error: "فشل إرسال الرسالة - تحقق من التوكن ومعرف المحادثة" };
  } catch (error: any) {
    return { success: false, error: error.message || "خطأ غير متوقع" };
  }
}

export async function testSlackConnection(
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  const message = "✅ *نظام الإنتاج*\n\nتم الاتصال بنجاح! هذه رسالة اختبار من منصة نظام الإنتاج.";
  try {
    const sent = await sendSlackMessage(webhookUrl, message);
    return sent
      ? { success: true }
      : { success: false, error: "فشل إرسال الرسالة - تحقق من رابط الويب هوك" };
  } catch (error: any) {
    return { success: false, error: error.message || "خطأ غير متوقع" };
  }
}
