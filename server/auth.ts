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
      from: "نَسَق <noreply@nasaqapp.net>",
      to: [email],
      subject: `رمز الدخول: ${otp} 🛡️`,
      html: `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f0f0f; border-radius: 24px; color: #fff; border: 1px solid #333;">
          <h1 style="font-size: 32px; font-weight: 900; margin-bottom: 16px; background: linear-gradient(to left, #6366f1, #a5b4fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">نَسَق</h1>
          <p style="font-size: 18px; color: #fff; margin-bottom: 32px; line-height: 1.6;">ارحب، هذا رقم التحقق الخاص بك ✌️ سجله في الموقع الحين.</p>
          
          <div style="background: rgba(99, 102, 241, 0.1); border: 2px solid #6366f1; border-radius: 16px; padding: 40px; text-align: center; margin-bottom: 32px; box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);">
            <p style="color: #a5b4fc; font-size: 14px; margin: 0 0 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">رمز التحقق</p>
            <div style="font-size: 48px; font-weight: 900; letter-spacing: 10px; color: #fff; font-family: 'Courier New', Courier, monospace;">
              ${otp}
            </div>
          </div>
          
          <div style="background: #1a1a1a; border-radius: 12px; padding: 16px; text-align: center;">
            <p style="color: #ff4d4d; font-size: 15px; margin: 0; font-weight: bold;">
              ⚠️ وانتبه يالشيخ ترا مدته بس 5 دقايق
            </p>
          </div>
          
          <p style="color: #666; font-size: 12px; text-align: center; margin-top: 32px;">
            إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد بكل بساطة.
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
