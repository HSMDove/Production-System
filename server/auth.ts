import crypto from "crypto";

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured. Please add it to your environment secrets.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "نظام الإنتاج <onboarding@resend.dev>",
      to: [email],
      subject: `رمز الدخول: ${otp}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f0f0f; border-radius: 16px; color: #fff;">
          <h1 style="font-size: 24px; margin-bottom: 8px; color: #fff;">نظام الإنتاج 🎬</h1>
          <p style="color: #aaa; margin-bottom: 32px;">مرحباً! هذا رمز الدخول الخاص بك</p>
          
          <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
            <p style="color: #aaa; font-size: 14px; margin: 0 0 12px;">رمز التحقق</p>
            <div style="font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #fff; font-family: monospace;">
              ${otp}
            </div>
          </div>
          
          <p style="color: #666; font-size: 13px; text-align: center;">
            هذا الرمز صالح لمدة <strong style="color: #aaa;">5 دقائق</strong> فقط.<br>
            إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as any;
    const errorMessage = error?.message || "";
    if (errorMessage.includes("testing emails") || errorMessage.includes("verify a domain")) {
      throw new Error("هذا البريد غير مدعوم حالياً. يرجى استخدام البريد المسجّل في النظام أو التواصل مع المسؤول لإضافة دومين مخصص.");
    }
    throw new Error(`فشل إرسال البريد الإلكتروني: ${errorMessage || JSON.stringify(error)}`);
  }
}
