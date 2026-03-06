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
      from: "نَسَق <noreply@productionsystem.com>",
      to: [email],
      subject: `رمز التحقق: ${otp} ✨`,
      html: `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f0f0f; border-radius: 24px; color: #fff; border: 1px solid #333;">
          <h1 style="font-size: 36px; font-weight: 900; margin-bottom: 24px; background: linear-gradient(to left, #6366f1, #a5b4fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center;">نَسَق</h1>
          
          <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border-radius: 20px; padding: 40px; text-align: center; margin-bottom: 32px; box-shadow: 0 10px 30px rgba(99, 102, 241, 0.4);">
            <p style="color: #fff; font-size: 20px; margin: 0 0 24px; font-weight: 800; line-height: 1.6;">
              حياك الله، شوف هذا رمز التحقق حقك 🌟
            </p>
            
            <div style="background: rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 20px; display: inline-block; min-width: 200px;">
              <div style="font-size: 52px; font-weight: 900; letter-spacing: 12px; color: #fff; font-family: 'Courier New', Courier, monospace; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                ${otp}
              </div>
            </div>
          </div>
          
          <div style="background: #1a1a1a; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #333;">
            <p style="color: #ff4d4d; font-size: 16px; margin: 0; font-weight: 800;">
              ⚠️ وانتبه يالشيخ ترا مدته بس 5 دقايق
            </p>
          </div>
          
          <p style="color: #666; font-size: 13px; text-align: center; margin-top: 32px; font-weight: 500;">
            سجله في الموقع الحين واستمتع بالتجربة 🚀
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
