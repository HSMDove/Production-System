import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, Bot, Check, Loader2, LogOut, Palette, Save, Send, Sparkles, TestTube, Trash2, User } from "lucide-react";
import { PromptTemplatesList } from "@/components/templates/prompt-templates-list";
import { useAuth } from "@/hooks/use-auth";

type SettingsData = Record<string, string | null>;

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { user, logout, isLoggingOut } = useAuth();

  const [localSettings, setLocalSettings] = useState<SettingsData>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("account");

  const [testAiTitle, setTestAiTitle] = useState("Apple تكشف عن iPhone 16 Pro بتقنيات كاميرا جديدة");
  const [testAiResult, setTestAiResult] = useState("");

  const [styleTitle, setStyleTitle] = useState("");
  const [styleDescription, setStyleDescription] = useState("");
  const [styleThumbnail, setStyleThumbnail] = useState("");

  const { data: settings, isLoading } = useQuery<SettingsData>({ queryKey: ["/api/settings"] });
  const { data: styleExamples } = useQuery<any[]>({ queryKey: ["/api/style-examples"] });

  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  const updateSetting = (key: string, value: string | null) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: SettingsData) => apiRequest("PUT", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setHasChanges(false);
      toast({ title: "تم الحفظ", description: "تم تطبيق الإعدادات بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حفظ الإعدادات", variant: "destructive" });
    },
  });

  const testTelegramMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/settings/test-telegram", {
      botToken: localSettings.telegram_bot_token,
      chatId: localSettings.telegram_chat_id,
    }),
    onSuccess: (data: any) => toast({ title: data.success ? "نجاح" : "فشل", description: data.success ? "تم إرسال رسالة اختبار إلى تيليجرام" : (data.error || "فشل الاتصال"), variant: data.success ? "default" : "destructive" }),
    onError: () => toast({ title: "خطأ", description: "فشل اختبار تيليجرام", variant: "destructive" }),
  });

  const testSlackMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/settings/test-slack", { webhookUrl: localSettings.slack_webhook_url }),
    onSuccess: (data: any) => toast({ title: data.success ? "نجاح" : "فشل", description: data.success ? "تم إرسال رسالة اختبار إلى Slack" : (data.error || "فشل الاتصال"), variant: data.success ? "default" : "destructive" }),
    onError: () => toast({ title: "خطأ", description: "فشل اختبار Slack", variant: "destructive" }),
  });

  const testAiMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/settings/test-ai", {
      title: testAiTitle,
      systemPrompt: localSettings.ai_system_prompt,
    }),
    onSuccess: (data: any) => {
      if (data.success) {
        setTestAiResult(data.rewrittenContent || "");
        toast({ title: "نجاح", description: "تم اختبار أسلوب فكري والـ Prompt بنجاح" });
      } else {
        toast({ title: "فشل", description: data.error || "فشل اختبار الذكاء الاصطناعي", variant: "destructive" });
      }
    },
    onError: () => toast({ title: "خطأ", description: "فشل اختبار الذكاء الاصطناعي", variant: "destructive" }),
  });

  const addStyleMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/style-examples", {
      title: styleTitle,
      description: styleDescription || undefined,
      thumbnailText: styleThumbnail || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-examples"] });
      setStyleTitle("");
      setStyleDescription("");
      setStyleThumbnail("");
      toast({ title: "تمت الإضافة", description: "تم إضافة مثال أسلوبي جديد" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل إضافة المثال", variant: "destructive" }),
  });

  const deleteStyleMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/style-examples/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-examples"] });
      toast({ title: "تم الحذف", description: "تم حذف المثال" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل حذف المثال", variant: "destructive" }),
  });

  const notificationsEnabled = localSettings.notifications_enabled === "true";
  const telegramEnabled = localSettings.telegram_enabled === "true";
  const slackEnabled = localSettings.slack_enabled === "true";

  const themeOptions = useMemo(() => ([
    { value: "default-dark", label: "الافتراضية الداكنة", color: "bg-blue-500" },
    { value: "tech-field", label: "Tech Field", color: "bg-rose-400" },
    { value: "tech-voice", label: "Tech Voice", color: "bg-cyan-400" },
  ] as const), []);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[320px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-5xl space-y-4 pb-24" dir="rtl">
        <Card>
          <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-settings-title">الإعدادات</h1>
              <p className="text-muted-foreground mt-1">إدارة الحساب، الإشعارات، إعدادات فكري، والمظهر بشكل منظم.</p>
            </div>
            <Button onClick={() => saveMutation.mutate(localSettings)} disabled={!hasChanges || saveMutation.isPending} className="gap-2" data-testid="button-save-settings">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ التغييرات
            </Button>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
            <TabsTrigger value="account">الحساب</TabsTrigger>
            <TabsTrigger value="appearance">المظهر</TabsTrigger>
            <TabsTrigger value="notifications">الإشعارات</TabsTrigger>
            <TabsTrigger value="fikri">فكري والذكاء</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-4 w-4" /> معلومات الحساب</CardTitle>
                <CardDescription>بيانات تسجيل الدخول الحالية.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-3 flex items-center justify-between"><span className="text-muted-foreground">البريد</span><span className="font-medium">{user?.email || "-"}</span></div>
                <div className="rounded-lg border p-3 flex items-center justify-between"><span className="text-muted-foreground">الاسم</span><span className="font-medium">{user?.name || "غير محدد"}</span></div>
                <Separator />
                <Button variant="destructive" onClick={() => logout()} disabled={isLoggingOut} className="gap-2" data-testid="button-logout">
                  {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  تسجيل الخروج
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" /> المظهر</CardTitle>
                <CardDescription>تخصيص الألوان البصرية للتطبيق.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {themeOptions.map((option) => {
                  const isSelected = theme === option.value;
                  return (
                    <Button key={option.value} variant={isSelected ? "default" : "outline"} className="justify-between" onClick={() => setTheme(option.value as any)} data-testid={`button-theme-${option.value}`}>
                      <span className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full ${option.color}`} />{option.label}</span>
                      {isSelected && <Check className="h-4 w-4" />}
                    </Button>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> الإشعارات الآلية</CardTitle>
                <CardDescription>جميع المفاتيح هنا مرتبطة مباشرة بمنطق الإرسال في الخلفية.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">تفعيل الإشعارات</p>
                    <p className="text-sm text-muted-foreground">عند الإيقاف لن يتم إرسال تنبيهات تلقائيًا.</p>
                  </div>
                  <Switch checked={notificationsEnabled} onCheckedChange={(v) => updateSetting("notifications_enabled", v ? "true" : "false")} data-testid="switch-notifications-enabled" />
                </div>

                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium flex items-center gap-2"><Send className="h-4 w-4 text-blue-500" /> تيليجرام</div>
                    <Switch checked={telegramEnabled} disabled={!notificationsEnabled} onCheckedChange={(v) => updateSetting("telegram_enabled", v ? "true" : "false")} data-testid="switch-telegram-enabled" />
                  </div>
                  <Input placeholder="Bot Token" value={localSettings.telegram_bot_token || ""} onChange={(e) => updateSetting("telegram_bot_token", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !telegramEnabled} />
                  <Input placeholder="Chat ID" value={localSettings.telegram_chat_id || ""} onChange={(e) => updateSetting("telegram_chat_id", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !telegramEnabled} />
                  <Button variant="outline" onClick={() => testTelegramMutation.mutate()} disabled={!notificationsEnabled || !telegramEnabled || testTelegramMutation.isPending} className="gap-2">
                    {testTelegramMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />} اختبار تيليجرام
                  </Button>
                </div>

                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Slack</div>
                    <Switch checked={slackEnabled} disabled={!notificationsEnabled} onCheckedChange={(v) => updateSetting("slack_enabled", v ? "true" : "false")} data-testid="switch-slack-enabled" />
                  </div>
                  <Input placeholder="Webhook URL" value={localSettings.slack_webhook_url || ""} onChange={(e) => updateSetting("slack_webhook_url", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !slackEnabled} />
                  <Button variant="outline" onClick={() => testSlackMutation.mutate()} disabled={!notificationsEnabled || !slackEnabled || testSlackMutation.isPending} className="gap-2">
                    {testSlackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />} اختبار Slack
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fikri" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4" /> إعدادات فكري</CardTitle>
                <CardDescription>تخصيص الـ System Prompt وإجبار الذكاء الاصطناعي على أسلوبك الخاص.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>مزود الذكاء الاصطناعي</Label>
                  <Select value={localSettings.ai_provider || "replit"} onValueChange={(value) => updateSetting("ai_provider", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="replit">Replit AI (افتراضي)</SelectItem>
                      <SelectItem value="custom">مزود مخصص</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {localSettings.ai_provider === "custom" && (
                  <div className="space-y-2">
                    <Input placeholder="Base URL" value={localSettings.ai_custom_base_url || ""} onChange={(e) => updateSetting("ai_custom_base_url", e.target.value)} dir="ltr" />
                    <Input placeholder="API Key" type="password" value={localSettings.ai_custom_api_key || ""} onChange={(e) => updateSetting("ai_custom_api_key", e.target.value)} dir="ltr" />
                    <Input placeholder="Model" value={localSettings.ai_custom_model || ""} onChange={(e) => updateSetting("ai_custom_model", e.target.value)} dir="ltr" />
                  </div>
                )}


                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>LLM API Key</Label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={localSettings.llm_api_key || ""}
                      onChange={(e) => updateSetting("llm_api_key", e.target.value)}
                      dir="ltr"
                      data-testid="input-llm-api-key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>LLM Model</Label>
                    <Input
                      placeholder="gpt-4o / claude-... / any-model"
                      value={localSettings.llm_model || ""}
                      onChange={(e) => updateSetting("llm_model", e.target.value)}
                      dir="ltr"
                      data-testid="input-llm-model"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>LLM Base URL (اختياري)</Label>
                  <Input
                    placeholder="https://api.openai.com/v1"
                    value={localSettings.llm_base_url || ""}
                    onChange={(e) => updateSetting("llm_base_url", e.target.value)}
                    dir="ltr"
                    data-testid="input-llm-base-url"
                  />
                </div>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>مزود Web Search</Label>
                    <Select value={localSettings.web_search_provider || "brave"} onValueChange={(value) => updateSetting("web_search_provider", value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brave">Brave Search</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Web Search API Key</Label>
                    <Input
                      type="password"
                      placeholder="bsk_..."
                      value={localSettings.web_search_api_key || ""}
                      onChange={(e) => updateSetting("web_search_api_key", e.target.value)}
                      dir="ltr"
                      data-testid="input-web-search-api-key"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>System Prompt الأساسي</Label>
                  <Textarea rows={4} placeholder="تعليمات عامة للنظام" value={localSettings.ai_system_prompt || ""} onChange={(e) => updateSetting("ai_system_prompt", e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>أسلوب فكري</Label>
                  <Textarea
                    rows={5}
                    placeholder="مثال: ردود قصيرة وواضحة، لهجة عربية سعودية احترافية، ابدأ بخلاصة ثم نقاط تنفيذية..."
                    value={localSettings.fikri_persona_style || ""}
                    onChange={(e) => updateSetting("fikri_persona_style", e.target.value)}
                    data-testid="textarea-fikri-persona-style"
                  />
                  <p className="text-xs text-muted-foreground">سيتم حقن هذا النص ديناميكيًا في الـ System Prompt لكل تفاعلات فكري الخاصة بحسابك فقط.</p>
                </div>

                <div className="space-y-2">
                  <Label>اختبار سريع</Label>
                  <Input value={testAiTitle} onChange={(e) => setTestAiTitle(e.target.value)} />
                  <Button variant="outline" className="gap-2" onClick={() => testAiMutation.mutate()} disabled={testAiMutation.isPending}>
                    {testAiMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} جرّب إعادة الصياغة
                  </Button>
                  {testAiResult && <Textarea rows={5} value={testAiResult} readOnly />}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>قوالب الأوامر</CardTitle>
                <CardDescription>قوالب توليد الأفكار المخصصة لهذا المستخدم.</CardDescription>
              </CardHeader>
              <CardContent>
                <PromptTemplatesList />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>أمثلة أسلوبية سابقة</CardTitle>
                <CardDescription>تُستخدم لتحسين أفكار فكري لهذا المستخدم فقط.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="العنوان" value={styleTitle} onChange={(e) => setStyleTitle(e.target.value)} />
                <Textarea placeholder="الوصف" value={styleDescription} onChange={(e) => setStyleDescription(e.target.value)} rows={3} />
                <Input placeholder="نص الصورة المصغرة (اختياري)" value={styleThumbnail} onChange={(e) => setStyleThumbnail(e.target.value)} />
                <Button onClick={() => addStyleMutation.mutate()} disabled={!styleTitle.trim() || addStyleMutation.isPending} className="gap-2">
                  <Bot className="h-4 w-4" /> إضافة مثال
                </Button>

                <Separator />

                <div className="space-y-2">
                  {(styleExamples || []).map((example) => (
                    <div key={example.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{example.title}</p>
                        {example.description && <p className="text-sm text-muted-foreground mt-1">{example.description}</p>}
                        {example.thumbnailText && <Badge variant="secondary" className="mt-2">{example.thumbnailText}</Badge>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteStyleMutation.mutate(example.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
