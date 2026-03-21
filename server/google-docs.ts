export function extractDocIdFromUrl(url: string): string | null {
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function fetchGoogleDocText(docUrl: string): Promise<{ title: string; text: string }> {
  const docId = extractDocIdFromUrl(docUrl);
  if (!docId) {
    throw new Error("رابط Google Doc غير صالح. تأكد من نسخ الرابط الصحيح من المتصفح.");
  }

  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

  const response = await fetch(exportUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("المستند غير موجود. تأكد من صحة الرابط.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('المستند غير متاح. تأكد من تفعيل المشاركة: "أي شخص لديه الرابط يمكنه العرض"');
    }
    throw new Error(`فشل جلب المستند (${response.status}). تأكد من أن المشاركة مفعلة.`);
  }

  const text = await response.text();

  if (!text || !text.trim()) {
    throw new Error("المستند فارغ أو لا يحتوي على نص.");
  }

  const titleUrl = `https://docs.google.com/document/d/${docId}/edit`;
  let title = "مستند Google";
  try {
    const pageResponse = await fetch(titleUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (pageResponse.ok) {
      const html = await pageResponse.text();
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        title = titleMatch[1]
          .replace(/ - Google Docs$/, "")
          .replace(/ - مستندات Google$/, "")
          .trim() || title;
      }
    }
  } catch {}

  return { title, text: text.trim() };
}
