import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Palette, Check, Sparkles, Database, 
  Bell, Send, MessageSquare, Bot, Loader2, 
  Server, Globe, Key, Cpu, Save, TestTube,
  Star, Plus, Trash2, Image
} from "lucide-react";
import { PromptTemplatesList } from "@/components/templates/prompt-templates-list";

type SettingsData = Record<string, string | null>;

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  
  const [localSettings, setLocalSettings] = useState<SettingsData>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading } = useQuery<SettingsData>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const updateSetting = (key: string, value: string | null) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: SettingsData) => {
      return apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setHasChanges(false);
      toast({ title: "تم الحفظ", description: "تم حفظ الإعدادات بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حفظ الإعدادات", variant: "destructive" });
    },
  });

  const testTelegramMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/settings/test-telegram", {
        botToken: localSettings.telegram_bot_token,
        chatId: localSettings.telegram_chat_id,
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "نجاح", description: "تم إرسال رسالة اختبار إلى تيليجرام" });
      } else {
        toast({ title: "فشل", description: data.error || "فشل الاتصال بتيليجرام", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل اختبار تيليجرام", variant: "destructive" });
    },
  });

  const testSlackMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/settings/test-slack", {
        webhookUrl: localSettings.slack_webhook_url,
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "نجاح", description: "تم إرسال رسالة اختبار إلى Slack" });
      } else {
        toast({ title: "فشل", description: data.error || "فشل الاتصال بـ Slack", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل اختبار Slack", variant: "destructive" });
    },
  });

  const testSlackBotMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/settings/test-slack-bot", {
        botToken: localSettings.slack_bot_token,
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "✅ Bot Token صحيح", description: `البوت: @${data.botName} | الـ workspace: ${data.teamName}` });
      } else {
        toast({ title: "❌ Bot Token خاطئ", description: data.error || "تحقق من الـ Token", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل اختبار Bot Token", variant: "destructive" });
    },
  });

  const [testAiTitle, setTestAiTitle] = useState("Apple تكشف عن iPhone 16 Pro بتقنيات كاميرا جديدة وشريحة A18 Pro");
  const [testAiResult, setTestAiResult] = useState("");
  
  const testAiMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/settings/test-ai", {
        title: testAiTitle,
        systemPrompt: localSettings.ai_system_prompt,
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setTestAiResult(data.rewrittenContent);
        toast({ title: "نجاح", description: "تم إعادة كتابة النص بنجاح" });
      } else {
        toast({ title: "فشل", description: data.error || "فشل اختبار الذكاء الاصطناعي", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل اختبار الذكاء الاصطناعي", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(localSettings);
  };

  const themeOptions = [
    { value: "default-dark", label: "السمة الافتراضية الداكنة", color: "bg-blue-500" },
    { value: "tech-field", label: "تيك فيلد #e86179", color: "bg-rose-400" },
    { value: "tech-voice", label: "تيك فويس #12d3d8", color: "bg-cyan-400" },
  ] as const;

  const [styleTitle, setStyleTitle] = useState("");
  const [styleDescription, setStyleDescription] = useState("");
  const [styleThumbnail, setStyleThumbnail] = useState("");

  const { data: styleExamples } = useQuery<any[]>({
    queryKey: ["/api/style-examples"],
  });

  const addStyleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/style-examples", {
        title: styleTitle,
        description: styleDescription || undefined,
        thumbnailText: styleThumbnail || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-examples"] });
      setStyleTitle("");
      setStyleDescription("");
      setStyleThumbnail("");
      toast({ title: "تمت الإضافة", description: "تم إضافة المثال بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل إضافة المثال", variant: "destructive" });
    },
  });

  const deleteStyleMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/style-examples/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-examples"] });
      toast({ title: "تم الحذف", description: "تم حذف المثال بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حذف المثال", variant: "destructive" });
    },
  });

  const aiProvider = localSettings.ai_provider || "replit";
  const notificationsEnabled = localSettings.notifications_enabled === "true";
  const telegramEnabled = localSettings.telegram_enabled === "true";
  const slackEnabled = localSettings.slack_enabled === "true";

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-settings-title">الإعدادات</h1>
            <p className="text-muted-foreground mt-1">
              إعدادات المنصة والإشعارات والذكاء الاصطناعي
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> محرك السمات</CardTitle>
            <CardDescription>اختر المظهر المفضل لديك</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {themeOptions.map((option) => {
                const isSelected = theme === option.value;
                return (
                  <Button
                    key={option.value}
                    variant={isSelected ? "default" : "outline"}
                    className="gap-2"
                    onClick={() => setTheme(option.value as any)}
                    data-testid={`button-theme-${option.value}`}
                  >
                    <span className={`h-3 w-3 rounded-full ${option.color}`} />
                    {option.label}
                    {isSelected && <Check className="h-4 w-4 mr-1" />}
                  </Button>
                );
              })}
              <p className="text-xs text-muted-foreground mt-3">النمط تشغيليًا داكن دائمًا، وذي الخيارات تغيّر شخصية الألوان فقط.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              الإشعارات التلقائية
            </CardTitle>
            <CardDescription>
              إرسال الأخبار الجديدة تلقائياً إلى تيليجرام و Slack
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">تفعيل الإشعارات</Label>
                <p className="text-sm text-muted-foreground">إرسال الأخبار الجديدة تلقائياً عند جلبها</p>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={(checked) => updateSetting("notifications_enabled", checked ? "true" : "false")}
                data-testid="switch-notifications-enabled"
              />
            </div>
            
            {notificationsEnabled && (
              <>
                <Separator />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-blue-500" />
                      <Label className="text-base font-medium">تيليجرام</Label>
                    </div>
                    <Switch
                      checked={telegramEnabled}
                      onCheckedChange={(checked) => updateSetting("telegram_enabled", checked ? "true" : "false")}
                      data-testid="switch-telegram-enabled"
                    />
                  </div>
                  
                  {telegramEnabled && (
                    <div className="space-y-3 pr-6">
                      <div className="space-y-2">
                        <Label htmlFor="telegram-token">Bot Token</Label>
                        <Input
                          id="telegram-token"
                          type="password"
                          placeholder="123456:ABC-DEF..."
                          value={localSettings.telegram_bot_token || ""}
                          onChange={(e) => updateSetting("telegram_bot_token", e.target.value)}
                          dir="ltr"
                          data-testid="input-telegram-token"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telegram-chat-id">Chat ID</Label>
                        <Input
                          id="telegram-chat-id"
                          placeholder="-1001234567890"
                          value={localSettings.telegram_chat_id || ""}
                          onChange={(e) => updateSetting("telegram_chat_id", e.target.value)}
                          dir="ltr"
                          data-testid="input-telegram-chat-id"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testTelegramMutation.mutate()}
                        disabled={testTelegramMutation.isPending || !localSettings.telegram_bot_token || !localSettings.telegram_chat_id}
                        data-testid="button-test-telegram"
                      >
                        {testTelegramMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                        <span className="mr-2">اختبار الاتصال</span>
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-purple-500" />
                      <Label className="text-base font-medium">Slack</Label>
                    </div>
                    <Switch
                      checked={slackEnabled}
                      onCheckedChange={(checked) => updateSetting("slack_enabled", checked ? "true" : "false")}
                      data-testid="switch-slack-enabled"
                    />
                  </div>
                  
                  {slackEnabled && (
                    <div className="space-y-3 pr-6">
                      <div className="space-y-2">
                        <Label htmlFor="slack-webhook">Webhook URL (إشعارات الأخبار)</Label>
                        <Input
                          id="slack-webhook"
                          type="password"
                          placeholder="https://hooks.slack.com/services/..."
                          value={localSettings.slack_webhook_url || ""}
                          onChange={(e) => updateSetting("slack_webhook_url", e.target.value)}
                          dir="ltr"
                          data-testid="input-slack-webhook"
                        />
                      </div>

                      <Separator />

                      <div className="rounded-md border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-3 text-sm space-y-1">
                        <p className="font-semibold text-blue-800 dark:text-blue-300">إعداد شات البوت (استقبال الرسائل)</p>
                        <p className="text-muted-foreground text-xs">هذه الحقول تتيح للبوت الرد على رسائلك في Slack</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="slack-bot-token">
                          Bot User OAuth Token (xoxb)
                          {!localSettings.slack_bot_token && <span className="text-destructive text-xs mr-2">⚠ مطلوب للرد</span>}
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="slack-bot-token"
                            type="password"
                            placeholder="xoxb-..."
                            value={localSettings.slack_bot_token || ""}
                            onChange={(e) => updateSetting("slack_bot_token", e.target.value)}
                            dir="ltr"
                            data-testid="input-slack-bot-token"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testSlackBotMutation.mutate()}
                            disabled={testSlackBotMutation.isPending || !localSettings.slack_bot_token}
                            data-testid="button-test-slack-bot"
                          >
                            {testSlackBotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="slack-signing-secret">
                          Signing Secret
                          {!localSettings.slack_signing_secret && <span className="text-amber-500 text-xs mr-2">⚠ مطلوب للأمان</span>}
                        </Label>
                        <Input
                          id="slack-signing-secret"
                          type="password"
                          placeholder="Slack Signing Secret"
                          value={localSettings.slack_signing_secret || ""}
                          onChange={(e) => updateSetting("slack_signing_secret", e.target.value)}
                          dir="ltr"
                          data-testid="input-slack-signing-secret"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="slack-bot-user-id">Bot User ID (اختياري)</Label>
                        <Input
                          id="slack-bot-user-id"
                          placeholder="U012345..."
                          value={localSettings.slack_bot_user_id || ""}
                          onChange={(e) => updateSetting("slack_bot_user_id", e.target.value)}
                          dir="ltr"
                          data-testid="input-slack-bot-user-id"
                        />
                      </div>

                      <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
                        <p className="font-medium">Endpoint (ضعه في Slack → Event Subscriptions):</p>
                        <code className="block text-xs break-all bg-background border rounded px-2 py-1" dir="ltr">{window.location.origin}/api/integrations/slack/events</code>
                        <p className="text-xs text-muted-foreground">تأكد من تفعيل: <code>app_mention</code> و <code>message.im</code> في Subscribe to events</p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testSlackMutation.mutate()}
                        disabled={testSlackMutation.isPending || !localSettings.slack_webhook_url}
                        data-testid="button-test-slack"
                      >
                        {testSlackMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                        <span className="mr-2">اختبار الاتصال</span>
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              مزود الذكاء الاصطناعي
            </CardTitle>
            <CardDescription>
              اختر بين خدمة OpenAI المدمجة أو خادمك المحلي
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>المزود</Label>
              <Select 
                value={aiProvider} 
                onValueChange={(value) => updateSetting("ai_provider", value)}
              >
                <SelectTrigger data-testid="select-ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="replit">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>سحابة نظام الإنتاج (الافتراضي)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="custom">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      <span>خادم محلي / مخصص (Ollama)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {aiProvider === "replit" && (
              <div className="rounded-md border p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    يستخدم الذكاء الاصطناعي المدمج - لا حاجة لمفتاح API خاص
                  </p>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 no-default-hover-elevate no-default-active-elevate">
                    متصل
                  </Badge>
                </div>
              </div>
            )}

            {aiProvider === "custom" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ai-base-url" className="flex items-center gap-2">
                    <Globe className="h-3 w-3" />
                    Base URL
                  </Label>
                  <Input
                    id="ai-base-url"
                    placeholder="https://my-server.ngrok.io/v1"
                    value={localSettings.ai_custom_base_url || ""}
                    onChange={(e) => updateSetting("ai_custom_base_url", e.target.value)}
                    dir="ltr"
                    data-testid="input-ai-base-url"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-api-key" className="flex items-center gap-2">
                    <Key className="h-3 w-3" />
                    API Key (اختياري)
                  </Label>
                  <Input
                    id="ai-api-key"
                    type="password"
                    placeholder="اتركه فارغاً إذا لم يكن مطلوباً"
                    value={localSettings.ai_custom_api_key || ""}
                    onChange={(e) => updateSetting("ai_custom_api_key", e.target.value)}
                    dir="ltr"
                    data-testid="input-ai-api-key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-model" className="flex items-center gap-2">
                    <Cpu className="h-3 w-3" />
                    Model Name
                  </Label>
                  <Input
                    id="ai-model"
                    placeholder="llama3, mistral, etc."
                    value={localSettings.ai_custom_model || ""}
                    onChange={(e) => updateSetting("ai_custom_model", e.target.value)}
                    dir="ltr"
                    data-testid="input-ai-model"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              أسلوب نظام الإنتاج
            </CardTitle>
            <CardDescription>
              حدد شخصية الكتابة - كيف يعيد الذكاء الاصطناعي صياغة الأخبار
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="system-prompt">System Prompt</Label>
              <Textarea
                id="system-prompt"
                className="min-h-[150px] text-sm"
                placeholder="أنت حسام من قناة نظام الإنتاج. أسلوبك سعودي تقني كاجوال..."
                value={localSettings.ai_system_prompt || ""}
                onChange={(e) => updateSetting("ai_system_prompt", e.target.value)}
                data-testid="textarea-system-prompt"
              />
              <p className="text-xs text-muted-foreground">
                هذا النص يحدد شخصية الذكاء الاصطناعي عند إعادة كتابة الأخبار للنشر
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm font-medium">اختبار الأسلوب</Label>
              <Input
                placeholder="أدخل عنوان خبر للاختبار..."
                value={testAiTitle}
                onChange={(e) => setTestAiTitle(e.target.value)}
                dir="auto"
                data-testid="input-test-ai-title"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => testAiMutation.mutate()}
                disabled={testAiMutation.isPending || !testAiTitle}
                data-testid="button-test-ai"
              >
                {testAiMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="mr-2">اختبار إعادة الكتابة</span>
              </Button>
              {testAiResult && (
                <div className="rounded-md border p-4 bg-muted/30">
                  <p className="text-sm font-medium mb-2">النتيجة:</p>
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-ai-test-result">{testAiResult}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              أفكاري الناجحة السابقة
            </CardTitle>
            <CardDescription>
              أضف أمثلة من أفكارك الناجحة ليتعلم الذكاء الاصطناعي أسلوبك
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="style-title">عنوان الفكرة</Label>
                <Input
                  id="style-title"
                  placeholder="مثال: أفضل 3 تطبيقات لازم تجربها"
                  value={styleTitle}
                  onChange={(e) => setStyleTitle(e.target.value)}
                  data-testid="input-style-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="style-description">وصف الفكرة</Label>
                <Textarea
                  id="style-description"
                  placeholder="وصف قصير لمحتوى الفكرة..."
                  value={styleDescription}
                  onChange={(e) => setStyleDescription(e.target.value)}
                  data-testid="textarea-style-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="style-thumbnail">نص الصورة المصغرة</Label>
                <Input
                  id="style-thumbnail"
                  placeholder="مثال: 3 تطبيقات خرافية!"
                  value={styleThumbnail}
                  onChange={(e) => setStyleThumbnail(e.target.value)}
                  data-testid="input-style-thumbnail"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addStyleMutation.mutate()}
                disabled={addStyleMutation.isPending || !styleTitle.trim()}
                data-testid="button-add-style-example"
              >
                {addStyleMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span className="mr-2">إضافة مثال</span>
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              {styleExamples && styleExamples.length > 0 ? (
                styleExamples.map((example: any) => (
                  <div
                    key={example.id}
                    className="flex items-start justify-between gap-2 rounded-md border p-3"
                    data-testid={`style-example-${example.id}`}
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="font-bold">{example.title}</p>
                      {example.description && (
                        <p className="text-sm text-muted-foreground">{example.description}</p>
                      )}
                      {example.thumbnailText && (
                        <p className="text-xs flex items-center gap-1">
                          <Image className="h-3 w-3" />
                          {example.thumbnailText}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteStyleMutation.mutate(example.id)}
                      disabled={deleteStyleMutation.isPending}
                      data-testid={`button-delete-style-${example.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  لا توجد أمثلة بعد. أضف أفكارك الناجحة السابقة ليتعلم منها الذكاء الاصطناعي
                </p>
              )}
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
            <CardDescription>حالة تخزين البيانات</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">PostgreSQL</p>
                <p className="text-sm text-muted-foreground">قاعدة بيانات مُدارة</p>
              </div>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 no-default-hover-elevate no-default-active-elevate">
                متصل
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>حول النظام</CardTitle>
            <CardDescription>معلومات عن المطور والإصدار</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">منصة نظام الإنتاج</span>
            </p>
            <p className="text-sm text-muted-foreground">
              منصة إدارة المحتوى وتوليد أفكار الفيديو
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              تم تطوير هذا النظام بواسطة <span className="font-bold text-primary">حسام تيك فيلد</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm p-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">لديك تغييرات غير محفوظة</p>
            <Button 
              onClick={handleSave} 
              disabled={saveMutation.isPending}
              data-testid="button-save-settings"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="mr-2">حفظ الإعدادات</span>
            </Button>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
