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
      subject: `رمز التحقق: ${otp} ✨`,
      html: `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:#111111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#1c1c1c;border:2.5px solid #F7CB46;box-shadow:5px 5px 0px 0px #F7CB46;">
          <tr>
            <td style="padding:36px 36px 0 36px;">

              <!-- Logo -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:28px;border-bottom:2px solid #2a2a2a;">
                    <div style="display:inline-block;background:#111111;border:2.5px solid #F7CB46;box-shadow:3px 3px 0px 0px #F7CB46;padding:10px 22px;">
                      <span style="font-family:'Cairo',Arial,sans-serif;font-size:28px;font-weight:900;color:#F7CB46;letter-spacing:2px;">نَسَق</span>
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 36px 0 36px;">
              <p style="font-family:'Cairo',Arial,sans-serif;font-size:17px;font-weight:700;color:#e8e8e8;margin:0;line-height:1.8;text-align:right;">
                حياك الله، شوف هذا رمز التحقق حقك 🌟
              </p>
            </td>
          </tr>

          <!-- OTP Box -->
          <tr>
            <td style="padding:24px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="background:#111111;border:2.5px solid #F7CB46;box-shadow:4px 4px 0px 0px #F7CB46;padding:20px 32px;display:inline-block;">
                      <span style="font-family:'Courier New',Courier,monospace;font-size:54px;font-weight:900;letter-spacing:14px;color:#F7CB46;">${otp}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Warning -->
          <tr>
            <td style="padding:0 36px 28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#1f1010;border:2px solid #e53e3e;box-shadow:3px 3px 0px 0px #e53e3e;padding:14px 18px;">
                    <p style="font-family:'Cairo',Arial,sans-serif;font-size:15px;font-weight:900;color:#fc8181;margin:0;text-align:center;">
                      ⚠️ وانتبه يالشيخ ترا مدته بس 5 دقايق
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 32px 36px;border-top:2px solid #2a2a2a;">
              <p style="font-family:'Cairo',Arial,sans-serif;font-size:13px;font-weight:500;color:#555555;margin:0;text-align:center;">
                سجله في الموقع الحين واستمتع بالتجربة 🚀
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>
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
