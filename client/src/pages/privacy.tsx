import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background p-6 md:p-12" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" className="gap-2 mb-4" onClick={() => navigate("/")} data-testid="button-back-home">
          <ArrowRight className="h-4 w-4" />
          الرجوع للرئيسية
        </Button>

        <Card>
          <CardContent className="p-8 space-y-6">
            <h1 className="text-2xl font-bold">سياسة الخصوصية — نَسَق</h1>
            <p className="text-sm text-muted-foreground">آخر تحديث: مارس 2026</p>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">1. المعلومات التي نجمعها</h2>
              <p className="text-sm leading-relaxed">عند استخدامك لمنصة نَسَق، قد نجمع المعلومات التالية:</p>
              <ul className="text-sm leading-relaxed list-disc mr-6 space-y-1">
                <li>البريد الإلكتروني والاسم عند إنشاء الحساب</li>
                <li>المحتوى الذي تنشئه وتحفظه في المنصة</li>
                <li>معلومات الربط مع المنصات الخارجية (مثل Slack وTelegram) — نحفظ فقط الرموز المطلوبة للاتصال</li>
                <li>بيانات الاستخدام لتحسين تجربتك</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">2. كيف نستخدم معلوماتك</h2>
              <ul className="text-sm leading-relaxed list-disc mr-6 space-y-1">
                <li>تقديم خدمات المنصة وتحسينها</li>
                <li>إرسال إشعارات المحتوى عبر القنوات المربوطة</li>
                <li>تشغيل المساعد الذكي «فكري» للرد على استفساراتك</li>
                <li>التواصل معك بخصوص تذاكر الدعم</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">3. حماية البيانات</h2>
              <p className="text-sm leading-relaxed">نستخدم تشفير AES-256 لحماية رموز الاتصال والبيانات الحساسة. جميع الاتصالات مشفرة عبر HTTPS.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">4. ربط Slack</h2>
              <p className="text-sm leading-relaxed">عند ربط حسابك بـ Slack عبر OAuth، نحصل على صلاحيات محدودة تشمل:</p>
              <ul className="text-sm leading-relaxed list-disc mr-6 space-y-1">
                <li>قراءة قنوات الـ Workspace</li>
                <li>إرسال رسائل في القنوات</li>
                <li>قراءة سجل المحادثات في القنوات العامة</li>
                <li>قراءة معلومات الأعضاء</li>
              </ul>
              <p className="text-sm leading-relaxed">لا نشارك بياناتك مع أي طرف ثالث. يمكنك إلغاء الربط في أي وقت من الإعدادات.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">5. حقوقك</h2>
              <ul className="text-sm leading-relaxed list-disc mr-6 space-y-1">
                <li>حذف حسابك وبياناتك في أي وقت</li>
                <li>إلغاء ربط أي منصة خارجية</li>
                <li>طلب نسخة من بياناتك</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">6. التواصل</h2>
              <p className="text-sm leading-relaxed">لأي استفسار بخصوص الخصوصية، تواصل معنا عبر نظام التذاكر في المنصة أو على البريد: noreply@nasaqapp.net</p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
