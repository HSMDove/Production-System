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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, Bot, Check, CircleHelp, Copy, Link, Loader2, LogOut, Moon, Palette, Plus, Save, Send, Sparkles, Sun, TestTube, Trash2, User, X } from "lucide-react";
import { PromptTemplatesList } from "@/components/templates/prompt-templates-list";
import { useAuth } from "@/hooks/use-auth";

type PlatformIdEntry = { id: string; platform: string; platformId: string; label: string | null; createdAt: string };

type SettingsData = Record<string, string | null>;

export default function Settings() {
  const { theme, colorMode, setTheme, setColorMode } = useTheme();
  const { toast } = useToast();
  const { user, logout, isLoggingOut } = useAuth();

  const [localSettings, setLocalSettings] = useState<SettingsData>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("account");
  const [newSlackId, setNewSlackId] = useState("");
  const [newSlackLabel, setNewSlackLabel] = useState("");
  const [newTelegramId, setNewTelegramId] = useState("");
  const [newTelegramLabel, setNewTelegramLabel] = useState("");

  const [testAiTitle, setTestAiTitle] = useState("Apple تكشف عن iPhone 16 Pro بتقنيات كاميرا جديدة");
  const [testAiResult, setTestAiResult] = useState("");

  const [styleTitle, setStyleTitle] = useState("");
  const [styleDescription, setStyleDescription] = useState("");
  const [styleThumbnail, setStyleThumbnail] = useState("");

  const { data: settings, isLoading } = useQuery<SettingsData>({ queryKey: ["/api/settings"] });
  const { data: styleExamples } = useQuery<any[]>({ queryKey: ["/api/style-examples"] });
  const { data: platformIds } = useQuery<PlatformIdEntry[]>({ queryKey: ["/api/auth/platform-ids"] });

  const slackIds = useMemo(() => (platformIds || []).filter(p => p.platform === "slack"), [platformIds]);
  const telegramIds = useMemo(() => (platformIds || []).filter(p => p.platform === "telegram"), [platformIds]);

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

  const testSlackBotMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/settings/test-slack-bot", { botToken: localSettings.slack_bot_token }),
    onSuccess: (data: any) => toast({ title: data.success ? "نجاح" : "فشل", description: data.success ? "البوت متصل بنجاح" : (data.error || "فشل الاتصال"), variant: data.success ? "default" : "destructive" }),
    onError: () => toast({ title: "خطأ", description: "فشل اختبار بوت Slack", variant: "destructive" }),
  });

  const addPlatformIdMutation = useMutation({
    mutationFn: async (data: { platform: string; platformId: string; label?: string }) =>
      apiRequest("POST", "/api/auth/platform-ids", data),
    onSuccess: (_data: any, variables: { platform: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/platform-ids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (variables.platform === "slack") { setNewSlackId(""); setNewSlackLabel(""); }
      if (variables.platform === "telegram") { setNewTelegramId(""); setNewTelegramLabel(""); }
      toast({ title: "تم الإضافة", description: "تم إضافة المعرف بنجاح" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err?.message || "فشل إضافة المعرف", variant: "destructive" }),
  });

  const removePlatformIdMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/auth/platform-ids/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/platform-ids"] });
      toast({ title: "تم الحذف", description: "تم إزالة المعرف" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل إزالة المعرف", variant: "destructive" }),
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
                <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> الإشعارات والمنصات الخارجية</CardTitle>
                <CardDescription>ربط نَسَق بمنصاتك الخارجية. فكري 2.0 يقدر يرد على رسائلك ويرسل الأخبار تلقائياً.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">تفعيل الإشعارات</p>
                    <p className="text-sm text-muted-foreground">عند الإيقاف لن يتم إرسال تنبيهات تلقائيًا ولن يرد فكري على الرسائل.</p>
                  </div>
                  <Switch checked={notificationsEnabled} onCheckedChange={(v) => updateSetting("notifications_enabled", v ? "true" : "false")} data-testid="switch-notifications-enabled" />
                </div>

                {/* ── Telegram Section ── */}
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium flex items-center gap-2"><Send className="h-4 w-4 text-blue-500" /> تيليجرام</div>
                    <Switch checked={telegramEnabled} disabled={!notificationsEnabled} onCheckedChange={(v) => updateSetting("telegram_enabled", v ? "true" : "false")} data-testid="switch-telegram-enabled" />
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">خطوات الإعداد:</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>افتح <a href="https://t.me/BotFather" target="_blank" className="text-primary underline">@BotFather</a> في تيليجرام واكتب <code className="bg-background px-1 rounded">/newbot</code></li>
                      <li>انسخ الـ Bot Token وضعه هنا</li>
                      <li>أضف الـ Chat IDs حقك (أرسل <code className="bg-background px-1 rounded">/start</code> للبوت ثم أضف معرفك)</li>
                      <li>اضبط الـ Webhook من الرابط الظاهر أدناه عشان فكري يرد عليك</li>
                    </ol>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">Bot Token</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs">من @BotFather في تيليجرام → /newbot → سيعطيك Token يبدأ بأرقام:حروف</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <Input placeholder="123456789:ABCdef..." type="password" value={localSettings.telegram_bot_token || ""} onChange={(e) => updateSetting("telegram_bot_token", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !telegramEnabled} data-testid="input-telegram-bot-token" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">رابط استقبال الرسائل (Webhook)</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs">انسخ هذا الرابط واضبطه في Telegram عشان فكري يستقبل رسائلك ويرد عليها مباشرة</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <div className="flex gap-2">
                      <Input value={`${window.location.origin}/api/integrations/telegram/webhook`} readOnly dir="ltr" className="font-mono text-xs bg-muted" data-testid="input-telegram-webhook-url" />
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/integrations/telegram/webhook`); toast({ title: "تم النسخ" }); }} data-testid="button-copy-telegram-webhook"><Copy className="h-4 w-4" /></Button>
                    </div>
                    <p className="text-xs text-muted-foreground">لتفعيل الاستقبال: افتح المتصفح وادخل على:<br /><code className="text-[10px] bg-background px-1 rounded break-all">{`https://api.telegram.org/bot<TOKEN>/setWebhook?url=${window.location.origin}/api/integrations/telegram/webhook`}</code></p>
                  </div>

                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">معرفات Chat ID المربوطة</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs">أرسل رسالة للبوت وفكري بيعطيك الـ Chat ID حقك. أو استخدم @userinfobot في تيليجرام</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    {telegramIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {telegramIds.map((entry) => (
                          <Badge key={entry.id} variant="secondary" className="gap-1.5 px-2.5 py-1 font-mono text-xs" data-testid={`badge-telegram-id-${entry.id}`}>
                            {entry.label ? `${entry.label}: ` : ""}{entry.platformId}
                            <button onClick={() => removePlatformIdMutation.mutate(entry.id)} className="hover:text-destructive" data-testid={`button-remove-telegram-${entry.id}`}><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input placeholder="Chat ID (مثال: 123456789)" value={newTelegramId} onChange={(e) => setNewTelegramId(e.target.value)} dir="ltr" className="font-mono" disabled={!notificationsEnabled || !telegramEnabled} data-testid="input-new-telegram-id" />
                      <Input placeholder="تسمية (اختياري)" value={newTelegramLabel} onChange={(e) => setNewTelegramLabel(e.target.value)} className="max-w-[140px]" disabled={!notificationsEnabled || !telegramEnabled} data-testid="input-new-telegram-label" />
                      <Button variant="outline" size="icon" className="shrink-0" disabled={!newTelegramId.trim() || addPlatformIdMutation.isPending || !notificationsEnabled || !telegramEnabled} onClick={() => addPlatformIdMutation.mutate({ platform: "telegram", platformId: newTelegramId.trim(), label: newTelegramLabel.trim() || undefined })} data-testid="button-add-telegram-id">
                        {addPlatformIdMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">Chat ID للإشعارات التلقائية</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs">هذا الـ Chat ID اللي بترسل له الإشعارات التلقائية للأخبار الجديدة (ممكن يكون قروب أو قناة)</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <Input placeholder="Chat ID للإشعارات" value={localSettings.telegram_chat_id || ""} onChange={(e) => updateSetting("telegram_chat_id", e.target.value)} dir="ltr" className="font-mono" disabled={!notificationsEnabled || !telegramEnabled} data-testid="input-telegram-notif-chat-id" />
                  </div>

                  <Button variant="outline" onClick={() => testTelegramMutation.mutate()} disabled={!notificationsEnabled || !telegramEnabled || testTelegramMutation.isPending} className="gap-2" data-testid="button-test-telegram">
                    {testTelegramMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />} اختبار تيليجرام
                  </Button>
                </div>

                {/* ── Slack Section ── */}
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Slack</div>
                    <Switch checked={slackEnabled} disabled={!notificationsEnabled} onCheckedChange={(v) => updateSetting("slack_enabled", v ? "true" : "false")} data-testid="switch-slack-enabled" />
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">خطوات الإعداد:</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>ادخل <a href="https://api.slack.com/apps" target="_blank" className="text-primary underline">api.slack.com/apps</a> → Create New App → From Scratch</li>
                      <li>من <strong>OAuth & Permissions</strong> → أضف Scopes: <code className="bg-background px-1 rounded">chat:write</code>, <code className="bg-background px-1 rounded">users:read</code>, <code className="bg-background px-1 rounded">app_mentions:read</code></li>
                      <li>ثبّت التطبيق → انسخ <strong>Bot Token</strong> و <strong>Signing Secret</strong></li>
                      <li>من <strong>Event Subscriptions</strong> → فعّلها والصق رابط الاستقبال الظاهر أدناه</li>
                      <li>من <strong>Incoming Webhooks</strong> → أنشئ Webhook URL للقناة المطلوبة</li>
                    </ol>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">رابط استقبال الأحداث (Events URL)</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs">انسخ هذا الرابط والصقه في Slack → Event Subscriptions → Request URL</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <div className="flex gap-2">
                      <Input value={`${window.location.origin}/api/integrations/slack/events`} readOnly dir="ltr" className="font-mono text-xs bg-muted" data-testid="input-slack-events-url" />
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/integrations/slack/events`); toast({ title: "تم النسخ" }); }} data-testid="button-copy-slack-events-url"><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  <Separator />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">Webhook URL — لإرسال الإشعارات</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs">Incoming Webhooks → أنشئ Webhook URL جديد. يُستخدم لإرسال الأخبار التلقائية للقناة</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <Input placeholder="https://hooks.slack.com/services/..." value={localSettings.slack_webhook_url || ""} onChange={(e) => updateSetting("slack_webhook_url", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !slackEnabled} data-testid="input-slack-webhook" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">Bot User OAuth Token (xoxb-...)</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs">OAuth & Permissions → Bot User OAuth Token. يمكّن البوت من الرد على رسائلك وجلب معلومات المستخدمين</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <Input placeholder="xoxb-..." type="password" value={localSettings.slack_bot_token || ""} onChange={(e) => updateSetting("slack_bot_token", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !slackEnabled} data-testid="input-slack-bot-token" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">Signing Secret</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs">Basic Information → App Credentials → Signing Secret. يتحقق إن الرسائل اللي توصل فعلاً قادمة من Slack</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <Input placeholder="Signing Secret" type="password" value={localSettings.slack_signing_secret || ""} onChange={(e) => updateSetting("slack_signing_secret", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !slackEnabled} data-testid="input-slack-signing-secret" />
                  </div>

                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">Slack Member IDs المربوطة</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs">افتح بروفايلك في Slack → النقاط الثلاث → Copy member ID. أو أرسل رسالة لفكري في Slack وبيعطيك الـ ID حقك</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    {slackIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {slackIds.map((entry) => (
                          <Badge key={entry.id} variant="secondary" className="gap-1.5 px-2.5 py-1 font-mono text-xs" data-testid={`badge-slack-id-${entry.id}`}>
                            {entry.label ? `${entry.label}: ` : ""}{entry.platformId}
                            <button onClick={() => removePlatformIdMutation.mutate(entry.id)} className="hover:text-destructive" data-testid={`button-remove-slack-${entry.id}`}><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input placeholder="مثال: U0123456789" value={newSlackId} onChange={(e) => setNewSlackId(e.target.value)} dir="ltr" className="font-mono" disabled={!notificationsEnabled || !slackEnabled} data-testid="input-new-slack-id" />
                      <Input placeholder="تسمية (اختياري)" value={newSlackLabel} onChange={(e) => setNewSlackLabel(e.target.value)} className="max-w-[140px]" disabled={!notificationsEnabled || !slackEnabled} data-testid="input-new-slack-label" />
                      <Button variant="outline" size="icon" className="shrink-0" disabled={!newSlackId.trim() || addPlatformIdMutation.isPending || !notificationsEnabled || !slackEnabled} onClick={() => addPlatformIdMutation.mutate({ platform: "slack", platformId: newSlackId.trim(), label: newSlackLabel.trim() || undefined })} data-testid="button-add-slack-id">
                        {addPlatformIdMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => testSlackMutation.mutate()} disabled={!notificationsEnabled || !slackEnabled || testSlackMutation.isPending} className="gap-2" data-testid="button-test-slack-webhook">
                      {testSlackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />} اختبار Webhook
                    </Button>
                    <Button variant="outline" onClick={() => testSlackBotMutation.mutate()} disabled={!notificationsEnabled || !slackEnabled || testSlackBotMutation.isPending} className="gap-2" data-testid="button-test-slack-bot">
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
