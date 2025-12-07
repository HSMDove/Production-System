import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor, Check, Sparkles, Database, Rss } from "lucide-react";
import { PromptTemplatesList } from "@/components/templates/prompt-templates-list";

export default function Settings() {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: "light", label: "فاتح", icon: Sun },
    { value: "dark", label: "داكن", icon: Moon },
    { value: "system", label: "تلقائي", icon: Monitor },
  ] as const;

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-settings-title">الإعدادات</h1>
          <p className="text-muted-foreground mt-1">
            تخصيص تجربة استخدام التطبيق
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>المظهر</CardTitle>
            <CardDescription>
              اختر المظهر المفضل لديك
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = theme === option.value;
                return (
                  <Button
                    key={option.value}
                    variant={isSelected ? "default" : "outline"}
                    className="gap-2"
                    onClick={() => setTheme(option.value)}
                    data-testid={`button-theme-${option.value}`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                    {isSelected && <Check className="h-4 w-4 mr-1" />}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              الذكاء الاصطناعي
            </CardTitle>
            <CardDescription>
              إعدادات توليد الأفكار بالذكاء الاصطناعي
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">حالة الاتصال</p>
                <p className="text-sm text-muted-foreground">
                  يستخدم التطبيق Replit AI Integrations
                </p>
              </div>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                متصل
              </Badge>
            </div>
            <Separator />
            <div className="rounded-md border p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground">
                يستخدم هذا التطبيق خدمة Replit AI Integrations للوصول إلى OpenAI. 
                لا تحتاج إلى مفتاح API خاص بك - يتم خصم التكاليف من رصيد حسابك في Replit.
              </p>
            </div>
          </CardContent>
        </Card>

        <PromptTemplatesList />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              قاعدة البيانات
            </CardTitle>
            <CardDescription>
              حالة تخزين البيانات
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">PostgreSQL</p>
                <p className="text-sm text-muted-foreground">
                  قاعدة بيانات مُدارة من Replit
                </p>
              </div>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                متصل
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rss className="h-5 w-5 text-primary" />
              جلب المحتوى
            </CardTitle>
            <CardDescription>
              إعدادات مصادر الأخبار
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">
                <strong>أنواع المصادر المدعومة:</strong>
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>RSS:</strong> يتم جلب المحتوى تلقائياً من خلاصات RSS</li>
                <li>• <strong>مواقع:</strong> تحليل الصفحات وجلب المحتوى الرئيسي</li>
                <li>• <strong>يوتيوب:</strong> جلب عناوين الفيديوهات الأخيرة</li>
                <li>• <strong>تويتر/X:</strong> يتطلب جلب يدوي</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>حول التطبيق</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Tech Voice Content Platform</span>
            </p>
            <p className="text-sm text-muted-foreground">
              منصة إدارة المحتوى وتوليد أفكار الفيديو لقناة Tech Voice
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              تم تطويره بواسطة Replit Agent
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
