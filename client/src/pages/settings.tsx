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
import { Bell, Bot, Check, Link, Loader2, LogOut, Moon, Palette, Save, Send, Sparkles, Sun, TestTube, Trash2, User } from "lucide-react";
import { PromptTemplatesList } from "@/components/templates/prompt-templates-list";
import { useAuth } from "@/hooks/use-auth";

type SettingsData = Record<string, string | null>;

export default function Settings() {
  const { theme, colorMode, setTheme, setColorMode } = useTheme();
  const { toast } = useToast();
  const { user, logout, isLoggingOut } = useAuth();

  const [localSettings, setLocalSettings] = useState<SettingsData>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  const [slackIdInput, setSlackIdInput] = useState(user?.slackUserId || "");

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

  useEffect(() => {
    if (user?.slackUserId) setSlackIdInput(user.slackUserId);
  }, [user?.slackUserId]);

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

  const testSlackBotMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/settings/test-slack-bot", { botToken: localSettings.slack_bot_token }),
    onSuccess: (data: any) => toast({ title: data.success ? "نجاح" : "فشل", description: data.success ? "البوت متصل بنجاح" : (data.error || "فشل الاتصال"), variant: data.success ? "default" : "destructive" }),
    onError: () => toast({ title: "خطأ", description: "فشل اختبار بوت Slack", variant: "destructive" }),
  });

  const linkSlackMutation = useMutation({
    mutationFn: async (slackUserId: string) => apiRequest("PATCH", "/api/auth/slack-link", { slackUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "تم الربط", description: "تم ربط حساب Slack بنجاح" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل ربط حساب Slack", variant: "destructive" }),
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
    { value: "default", label: "الأساسي", color: "#F7CB46" },
    { value: "tech-field", label: "تيك فيلد", color: "#FE90E8" },
    { value: "tech-voice", label: "تيك فويس", color: "#C0F7FE" },
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
            <TabsTrigger value="fikri">فكري 2.0 والذكاء</TabsTrigger>
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
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 font-medium"><Link className="h-4 w-4" /> ربط حساب Slack</Label>
                  <p className="text-sm text-muted-foreground">أرسل أي رسالة للبوت في Slack وراح يعطيك الـ User ID حقك. اكتبه هنا عشان البوت يعرفك.</p>
                  <div className="flex gap-2">
                    <Input placeholder="مثال: U0123456789" value={slackIdInput} onChange={(e) => setSlackIdInput(e.target.value)} dir="ltr" className="font-mono" data-testid="input-slack-user-id" />
                    <Button variant="outline" onClick={() => { if (slackIdInput.trim()) linkSlackMutation.mutate(slackIdInput.trim()); }} disabled={!slackIdInput.trim() || linkSlackMutation.isPending} className="gap-2 shrink-0" data-testid="button-link-slack">
                      {linkSlackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                      ربط
                    </Button>
                  </div>
                  {user?.slackUserId && (
                    <p className="text-sm text-green-600 dark:text-green-400">مربوط حالياً: <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{user.slackUserId}</code></p>
                  )}
                </div>
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
                <CardTitle className="flex items-center gap-2">{colorMode === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} الوضع</CardTitle>
                <CardDescription>اختر بين الوضع النهاري والليلي.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 grid-cols-2">
                <Button variant={colorMode === "light" ? "default" : "outline"} className="justify-center gap-2" onClick={() => setColorMode("light")} data-testid="button-mode-light">
                  <Sun className="h-4 w-4" />
                  نهاري
                  {colorMode === "light" && <Check className="h-4 w-4" />}
                </Button>
                <Button variant={colorMode === "dark" ? "default" : "outline"} className="justify-center gap-2" onClick={() => setColorMode("dark")} data-testid="button-mode-dark">
                  <Moon className="h-4 w-4" />
                  ليلي
                  {colorMode === "dark" && <Check className="h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" /> السمة</CardTitle>
                <CardDescription>تخصيص ألوان التطبيق.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {themeOptions.map((option) => {
                  const isSelected = theme === option.value;
                  return (
                    <Button key={option.value} variant={isSelected ? "default" : "outline"} className="justify-center gap-2" onClick={() => setTheme(option.value as any)} data-testid={`button-theme-${option.value}`}>
                      <span className="h-4 w-4 rounded-full border-2 border-foreground/30" style={{ backgroundColor: option.color }} />
                      {option.label}
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
                  <p className="text-xs text-muted-foreground">أنشئ Slack App من api.slack.com/apps وفعّل Event Subscriptions. البوت يرد على الرسائل المباشرة والمنشنات بدون ما تحتاج تنادي عليه.</p>
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Webhook URL — لإرسال الإشعارات</Label>
                    <Input placeholder="https://hooks.slack.com/services/..." value={localSettings.slack_webhook_url || ""} onChange={(e) => updateSetting("slack_webhook_url", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !slackEnabled} data-testid="input-slack-webhook" />
                    <p className="text-xs text-muted-foreground">Incoming Webhooks → أنشئ Webhook URL جديد للقناة اللي تبي فيها الإشعارات.</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Bot User OAuth Token (xoxb-...)</Label>
                    <Input placeholder="xoxb-..." type="password" value={localSettings.slack_bot_token || ""} onChange={(e) => updateSetting("slack_bot_token", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !slackEnabled} data-testid="input-slack-bot-token" />
                    <p className="text-xs text-muted-foreground">OAuth & Permissions → Bot User OAuth Token. هذا يخلي البوت يرد على رسائلك.</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Signing Secret</Label>
                    <Input placeholder="Signing Secret" type="password" value={localSettings.slack_signing_secret || ""} onChange={(e) => updateSetting("slack_signing_secret", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !slackEnabled} data-testid="input-slack-signing-secret" />
                    <p className="text-xs text-muted-foreground">Basic Information → App Credentials → Signing Secret. يتأكد إن الرسائل فعلاً من Slack.</p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Slack Member ID — لربط حسابك</Label>
                    <div className="flex gap-2">
                      <Input placeholder="مثال: U0123456789" value={slackIdInput} onChange={(e) => setSlackIdInput(e.target.value)} dir="ltr" className="font-mono" disabled={!notificationsEnabled || !slackEnabled} data-testid="input-slack-member-id" />
                      <Button variant="outline" onClick={() => { if (slackIdInput.trim()) linkSlackMutation.mutate(slackIdInput.trim()); }} disabled={!slackIdInput.trim() || linkSlackMutation.isPending || !notificationsEnabled || !slackEnabled} className="gap-2 shrink-0" data-testid="button-link-slack-notif">
                        {linkSlackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                        ربط
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">أرسل أي رسالة لفكري 2.0 في Slack وبيعطيك الـ ID حقك. أو افتح بروفايلك في Slack → النقاط الثلاث → Copy member ID.</p>
                    {user?.slackUserId && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">مربوط حالياً: <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{user.slackUserId}</code></p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => testSlackMutation.mutate()} disabled={!notificationsEnabled || !slackEnabled || testSlackMutation.isPending} className="gap-2">
                      {testSlackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />} اختبار Webhook
                    </Button>
                    <Button variant="outline" onClick={() => testSlackBotMutation.mutate()} disabled={!notificationsEnabled || !slackEnabled || testSlackBotMutation.isPending} className="gap-2">
                      {testSlackBotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />} اختبار البوت
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fikri" className="space-y-4">
            {/* AI Source Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4" /> مصدر الذكاء الاصطناعي</CardTitle>
                <CardDescription>اختر من أين يأتي الذكاء الاصطناعي الذي يشغّل فكري.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Source type selector */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      value: "replit",
                      label: "النموذج الافتراضي",
                      desc: "يعمل مباشرة بدون أي إعداد",
                      icon: "⚡",
                    },
                    {
                      value: "custom",
                      label: "API مخصص",
                      desc: "OpenAI أو Anthropic أو أي مزود",
                      icon: "🔑",
                    },
                    {
                      value: "local",
                      label: "نموذج محلي",
                      desc: "Ollama أو LM Studio على جهازك",
                      icon: "💻",
                    },
                  ].map((opt) => {
                    const selected = (localSettings.ai_provider || "replit") === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateSetting("ai_provider", opt.value)}
                        className={`rounded-xl border-2 p-4 text-right transition-all ${
                          selected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/40"
                        }`}
                        data-testid={`button-ai-source-${opt.value}`}
                      >
                        <div className="text-2xl mb-2">{opt.icon}</div>
                        <div className="font-semibold text-sm">{opt.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Fields for custom API */}
                {localSettings.ai_provider === "custom" && (
                  <div className="rounded-xl border p-4 space-y-3 bg-muted/30">
                    <p className="text-sm font-medium">إعدادات API المخصص</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>API Key</Label>
                        <Input type="password" placeholder="sk-... أو key-..." value={localSettings.ai_custom_api_key || ""} onChange={(e) => updateSetting("ai_custom_api_key", e.target.value)} dir="ltr" data-testid="input-llm-api-key" />
                        <p className="text-xs text-muted-foreground">مفتاح الوصول للـ API</p>
                      </div>
                      <div className="space-y-1">
                        <Label>اسم النموذج</Label>
                        <Input placeholder="gpt-4o / claude-3-5-sonnet" value={localSettings.ai_custom_model || ""} onChange={(e) => updateSetting("ai_custom_model", e.target.value)} dir="ltr" data-testid="input-llm-model" />
                        <p className="text-xs text-muted-foreground">اسم النموذج الذي تريد استخدامه</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Base URL (اختياري)</Label>
                      <Input placeholder="https://api.openai.com/v1" value={localSettings.ai_custom_base_url || ""} onChange={(e) => updateSetting("ai_custom_base_url", e.target.value)} dir="ltr" data-testid="input-llm-base-url" />
                      <p className="text-xs text-muted-foreground">اتركه فارغاً لاستخدام OpenAI المباشر. غيّره للمزودين الآخرين مثل Anthropic أو Together.</p>
                    </div>
                  </div>
                )}

                {/* Fields for local model */}
                {localSettings.ai_provider === "local" && (
                  <div className="rounded-xl border p-4 space-y-3 bg-muted/30">
                    <p className="text-sm font-medium">إعدادات النموذج المحلي</p>
                    <div className="space-y-1">
                      <Label>رابط الخادم المحلي</Label>
                      <Input placeholder="http://localhost:11434/v1" value={localSettings.ai_custom_base_url || ""} onChange={(e) => updateSetting("ai_custom_base_url", e.target.value)} dir="ltr" />
                      <p className="text-xs text-muted-foreground">
                        Ollama: <span className="font-mono text-xs">http://localhost:11434/v1</span> — LM Studio: <span className="font-mono text-xs">http://localhost:1234/v1</span>
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>اسم النموذج</Label>
                        <Input placeholder="llama3 / mistral / phi3" value={localSettings.ai_custom_model || ""} onChange={(e) => updateSetting("ai_custom_model", e.target.value)} dir="ltr" />
                        <p className="text-xs text-muted-foreground">اسم النموذج المثبّت على جهازك</p>
                      </div>
                      <div className="space-y-1">
                        <Label>API Key (اختياري)</Label>
                        <Input type="password" placeholder="not-needed أو اتركه فارغاً" value={localSettings.ai_custom_api_key || ""} onChange={(e) => updateSetting("ai_custom_api_key", e.target.value)} dir="ltr" />
                        <p className="text-xs text-muted-foreground">معظم النماذج المحلية لا تحتاجه</p>
                      </div>
                    </div>
                  </div>
                )}

                {localSettings.ai_provider === "replit" && (
                  <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 flex items-center gap-3">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-sm text-muted-foreground">يعمل تلقائياً — لا تحتاج لأي إعداد إضافي.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Web Search */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🔍 البحث الخارجي (Web Search)</CardTitle>
                <CardDescription>يتيح لفكري البحث في الإنترنت للحصول على معلومات حديثة.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>مزود البحث</Label>
                    <Select value={localSettings.web_search_provider || "brave"} onValueChange={(value) => updateSetting("web_search_provider", value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brave">Brave Search</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">الموفر المستخدم لتنفيذ عمليات البحث</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Web Search API Key</Label>
                    <Input
                      type="password"
                      placeholder="BSA... أو BSP..."
                      value={localSettings.web_search_api_key || ""}
                      onChange={(e) => updateSetting("web_search_api_key", e.target.value)}
                      dir="ltr"
                      data-testid="input-web-search-api-key"
                    />
                    <p className="text-xs text-muted-foreground">احصل على مفتاح مجاني من <span className="font-mono">api.search.brave.com</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Persona */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🎭 شخصية فكري والأسلوب</CardTitle>
                <CardDescription>أخبر الذكاء الاصطناعي كيف يتصرف ويتحدث.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>System Prompt الأساسي</Label>
                  <Textarea rows={4} placeholder="تعليمات عامة للنظام..." value={localSettings.ai_system_prompt || ""} onChange={(e) => updateSetting("ai_system_prompt", e.target.value)} />
                  <p className="text-xs text-muted-foreground">يُطبَّق على جميع وظائف الذكاء الاصطناعي: إعادة الصياغة، الملخصات، التوليد.</p>
                </div>

                <div className="space-y-1">
                  <Label>أسلوب فكري الخاص بك</Label>
                  <Textarea
                    rows={4}
                    placeholder="الافتراضي: ردّ بردود تفاعلية وجميلة مع استخدام إيموجي وأيضاً لهجة سعودية"
                    value={localSettings.fikri_persona_style || ""}
                    onChange={(e) => updateSetting("fikri_persona_style", e.target.value)}
                    data-testid="textarea-fikri-persona-style"
                  />
                  <p className="text-xs text-muted-foreground">لو تركته فاضي، فكري يستخدم الأسلوب الافتراضي: ردود تفاعلية بإيموجي ولهجة سعودية. اكتب أسلوبك الخاص لو تبي تغيّره.</p>
                </div>

                <div className="space-y-2">
                  <Label>اختبار سريع للأسلوب</Label>
                  <Input value={testAiTitle} onChange={(e) => setTestAiTitle(e.target.value)} placeholder="أدخل عنوان خبر لاختبار إعادة الصياغة" />
                  <Button variant="outline" className="gap-2" onClick={() => testAiMutation.mutate()} disabled={testAiMutation.isPending}>
                    {testAiMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} جرّب إعادة الصياغة
                  </Button>
                  {testAiResult && <Textarea rows={5} value={testAiResult} readOnly className="bg-muted/50" />}
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

        <div className="text-center text-sm text-muted-foreground py-4 border-t mt-6" data-testid="text-version">
          نَسَق — الإصدار 1.0.0
        </div>
      </div>
    </MainLayout>
  );
}
