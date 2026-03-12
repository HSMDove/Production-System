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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertCircle, Bell, Bot, BrainCircuit, Check, ChevronDown, ChevronUp, CircleHelp, Clock, Copy, FileText, Hash, ImagePlus, Link, Loader2, LogOut, MessageSquare, Moon, Palette, Plus, RefreshCw, Route, Save, Send, Settings2, Sparkles, Sun, TestTube, ToggleLeft, Trash2, Upload, User, X } from "lucide-react";
import { PromptTemplatesList } from "@/components/templates/prompt-templates-list";
import { useAuth } from "@/hooks/use-auth";

type PlatformIdEntry = { id: string; platform: string; platformId: string; label: string | null; createdAt: string };
type IntegrationChannelEntry = { id: string; platform: string; name: string; credentials: Record<string, string>; isActive: boolean; createdAt: string };
type FolderMappingEntry = { id: string; folderId: string; integrationChannelId: string; targetId: string; createdAt: string };
type FolderEntry = { id: string; name: string; color: string };

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

  const [gdocUrl, setGdocUrl] = useState("");

  const [trainingSampleTitle, setTrainingSampleTitle] = useState("");
  const [trainingSampleType, setTrainingSampleType] = useState<string>("script");
  const [trainingSampleContent, setTrainingSampleContent] = useState("");
  const [editingStyleMatrix, setEditingStyleMatrix] = useState(false);
  const [localStyleMatrix, setLocalStyleMatrix] = useState("");

  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelPlatform, setNewChannelPlatform] = useState<string>("telegram");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelBotToken, setNewChannelBotToken] = useState("");
  const [newChannelWebhookUrl, setNewChannelWebhookUrl] = useState("");
  const [newMappingFolderId, setNewMappingFolderId] = useState("");
  const [newMappingChannelId, setNewMappingChannelId] = useState("");
  const [newMappingTargetId, setNewMappingTargetId] = useState("");

  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketImages, setTicketImages] = useState<string[]>([]);
  const [showMyTickets, setShowMyTickets] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState("");

  const { data: settings, isLoading } = useQuery<SettingsData>({ queryKey: ["/api/settings"] });
  const { data: versionData } = useQuery<{ version: string }>({ queryKey: ["/api/version"] });
  const appVersion = versionData?.version || "1.0.0";
  const { data: platformIds } = useQuery<PlatformIdEntry[]>({ queryKey: ["/api/auth/platform-ids"] });
  const { data: trainingSamples } = useQuery<any[]>({ queryKey: ["/api/training/samples"] });
  const { data: integrationChannels } = useQuery<IntegrationChannelEntry[]>({ queryKey: ["/api/integrations/channels"] });
  const { data: folderMappings } = useQuery<FolderMappingEntry[]>({ queryKey: ["/api/integrations/folder-mappings"] });
  const { data: folders } = useQuery<FolderEntry[]>({ queryKey: ["/api/folders"] });

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

  type TicketEntry = { id: string; title: string; description: string; imageUrls: string[] | null; status: string; createdAt: string; updatedAt: string };
  type TicketReplyEntry = { id: string; ticketId: string; userId: string; message: string; isAdmin: boolean; createdAt: string };

  const { data: myTickets } = useQuery<TicketEntry[]>({ queryKey: ["/api/tickets"], enabled: showMyTickets });
  const { data: selectedTicketData } = useQuery<{ ticket: TicketEntry; replies: TicketReplyEntry[] }>({ queryKey: ["/api/tickets", selectedTicketId], enabled: !!selectedTicketId });

  const createTicketMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/tickets", {
      title: ticketTitle,
      description: ticketDescription,
      imageUrls: ticketImages.length > 0 ? ticketImages : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setTicketTitle("");
      setTicketDescription("");
      setTicketImages([]);
      setShowTicketForm(false);
      setShowMyTickets(true);
      toast({ title: "تم الإرسال", description: "تم إرسال تذكرتك بنجاح، سنعمل عليها قريباً" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل إرسال التذكرة", variant: "destructive" }),
  });

  const replyToTicketMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/tickets/${selectedTicketId}/reply`, { message: ticketReplyText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", selectedTicketId] });
      setTicketReplyText("");
      toast({ title: "تم", description: "تم إرسال ردك" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل إرسال الرد", variant: "destructive" }),
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setTicketImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    open: { label: "خامل", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    in_progress: { label: "جارٍ العمل عليها", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    resolved: { label: "تم العمل عليها", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  };

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

  const submitTrainingSampleMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/training/submit", {
      sampleTitle: trainingSampleTitle,
      contentType: trainingSampleType,
      textContent: trainingSampleContent,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/samples"] });
      setTrainingSampleTitle("");
      setTrainingSampleContent("");
      toast({ title: "تم إضافة العينة", description: "تم تحليل النص واستخراج الأسلوب بنجاح" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err?.message || "فشل إضافة عينة التدريب", variant: "destructive" }),
  });

  const deleteTrainingSampleMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/training/samples/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/samples"] });
      toast({ title: "تم الحذف", description: "تم حذف العينة" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل حذف العينة", variant: "destructive" }),
  });

  const analyzeStyleMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/training/analyze");
      return result as any;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setLocalStyleMatrix(data.styleMatrix || "");
      toast({ title: "تم التحليل", description: "تم استخراج مصفوفة الأسلوب بنجاح" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err?.message || "فشل تحليل العينات", variant: "destructive" }),
  });

  const saveStyleMatrixMutation = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/training/style-matrix", { styleMatrix: localStyleMatrix }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setEditingStyleMatrix(false);
      toast({ title: "تم الحفظ", description: "تم حفظ مصفوفة الأسلوب" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل حفظ مصفوفة الأسلوب", variant: "destructive" }),
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

  const createChannelMutation = useMutation({
    mutationFn: async () => {
      const credentials: Record<string, string> = {};
      if (newChannelPlatform === "telegram") credentials.bot_token = newChannelBotToken;
      if (newChannelPlatform === "slack") credentials.webhook_url = newChannelWebhookUrl;
      return apiRequest("POST", "/api/integrations/channels", { platform: newChannelPlatform, name: newChannelName, credentials });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      setShowAddChannel(false);
      setNewChannelName("");
      setNewChannelBotToken("");
      setNewChannelWebhookUrl("");
      toast({ title: "تمت الإضافة", description: "تم إضافة قناة الربط بنجاح" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err?.message || "فشل إضافة قناة الربط", variant: "destructive" }),
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/integrations/channels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/folder-mappings"] });
      toast({ title: "تم الحذف", description: "تم حذف قناة الربط" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل حذف قناة الربط", variant: "destructive" }),
  });

  const toggleChannelMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest("PUT", `/api/integrations/channels/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      toast({ title: "تم التحديث" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل تحديث القناة", variant: "destructive" }),
  });

  const testChannelMutation = useMutation({
    mutationFn: async ({ id, targetId }: { id: string; targetId?: string }) => apiRequest("POST", `/api/integrations/channels/${id}/test`, { targetId }),
    onSuccess: (data: any) => toast({ title: data.success ? "نجاح" : "فشل", description: data.success ? "تم إرسال رسالة اختبار بنجاح" : (data.error || "فشل الاختبار"), variant: data.success ? "default" : "destructive" }),
    onError: () => toast({ title: "خطأ", description: "فشل اختبار القناة", variant: "destructive" }),
  });

  const createMappingMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/integrations/folder-mappings", { folderId: newMappingFolderId, integrationChannelId: newMappingChannelId, targetId: newMappingTargetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/folder-mappings"] });
      setNewMappingFolderId("");
      setNewMappingChannelId("");
      setNewMappingTargetId("");
      toast({ title: "تم الربط", description: "تم ربط المجلد بالقناة بنجاح" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err?.message || "فشل ربط المجلد", variant: "destructive" }),
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/integrations/folder-mappings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/folder-mappings"] });
      toast({ title: "تم الحذف", description: "تم إزالة ربط المجلد" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل إزالة ربط المجلد", variant: "destructive" }),
  });

  const fetchGdocMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/training/fetch-gdoc", { url: gdocUrl });
      return result as any;
    },
    onSuccess: (data: any) => {
      setTrainingSampleContent(data.text || "");
      if (!trainingSampleTitle.trim() && data.title) {
        setTrainingSampleTitle(data.title);
      }
      setGdocUrl("");
      toast({ title: "تم الجلب", description: "تم استيراد محتوى المستند بنجاح" });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err?.message || "فشل جلب محتوى Google Doc", variant: "destructive" }),
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> عندي مشكلة</CardTitle>
                <CardDescription>واجهتك مشكلة؟ أرسل لنا تذكرة وسنتابعها معك.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!showTicketForm && !showMyTickets && (
                  <div className="flex gap-2">
                    <Button onClick={() => setShowTicketForm(true)} className="gap-2 flex-1" data-testid="button-new-ticket">
                      <Plus className="h-4 w-4" />
                      تذكرة جديدة
                    </Button>
                    <Button variant="outline" onClick={() => setShowMyTickets(true)} className="gap-2 flex-1" data-testid="button-my-tickets">
                      <MessageSquare className="h-4 w-4" />
                      تذاكري
                    </Button>
                  </div>
                )}

                {showTicketForm && (
                  <div className="space-y-3">
                    <div>
                      <Label>عنوان المشكلة</Label>
                      <Input
                        value={ticketTitle}
                        onChange={(e) => setTicketTitle(e.target.value)}
                        placeholder="مثال: مشكلة في حفظ المحتوى"
                        className="mt-1"
                        data-testid="input-ticket-title"
                      />
                    </div>
                    <div>
                      <Label>وصف المشكلة</Label>
                      <Textarea
                        value={ticketDescription}
                        onChange={(e) => setTicketDescription(e.target.value)}
                        placeholder="اشرح المشكلة بالتفصيل..."
                        className="mt-1 min-h-[120px]"
                        data-testid="input-ticket-description"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2">
                        <ImagePlus className="h-4 w-4" />
                        صور (اختياري)
                      </Label>
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="mt-1"
                        data-testid="input-ticket-images"
                      />
                      {ticketImages.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {ticketImages.map((img, i) => (
                            <div key={i} className="relative w-16 h-16">
                              <img src={img} alt={`صورة ${i + 1}`} className="w-full h-full object-cover rounded border" />
                              <button
                                onClick={() => setTicketImages((prev) => prev.filter((_, idx) => idx !== i))}
                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs"
                                data-testid={`button-remove-image-${i}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => createTicketMutation.mutate()}
                        disabled={!ticketTitle.trim() || !ticketDescription.trim() || createTicketMutation.isPending}
                        className="gap-2"
                        data-testid="button-submit-ticket"
                      >
                        {createTicketMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        إرسال
                      </Button>
                      <Button variant="outline" onClick={() => { setShowTicketForm(false); setTicketTitle(""); setTicketDescription(""); setTicketImages([]); }} data-testid="button-cancel-ticket">
                        إلغاء
                      </Button>
                    </div>
                  </div>
                )}

                {showMyTickets && !selectedTicketId && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">تذاكري</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowTicketForm(true)} className="gap-1" data-testid="button-new-ticket-inline">
                          <Plus className="h-3 w-3" /> جديدة
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowMyTickets(false)} data-testid="button-close-tickets">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {!myTickets ? (
                      <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : myTickets.length === 0 ? (
                      <p className="text-center text-muted-foreground py-6 text-sm">لا توجد تذاكر بعد</p>
                    ) : (
                      myTickets.map((t) => (
                        <div
                          key={t.id}
                          className="rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setSelectedTicketId(t.id)}
                          data-testid={`ticket-item-${t.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{t.title}</p>
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(t.createdAt).toLocaleDateString("ar-SA")}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${statusLabels[t.status]?.color || ""}`}>
                              {statusLabels[t.status]?.label || t.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {showMyTickets && selectedTicketId && selectedTicketData && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedTicketId(null)} data-testid="button-back-tickets">
                        <ChevronDown className="h-4 w-4 rotate-90" />
                      </Button>
                      <span className="font-medium text-sm flex-1 truncate">{selectedTicketData.ticket.title}</span>
                      <span className={`text-xs px-2 py-1 rounded-full border ${statusLabels[selectedTicketData.ticket.status]?.color || ""}`}>
                        {statusLabels[selectedTicketData.ticket.status]?.label || selectedTicketData.ticket.status}
                      </span>
                    </div>
                    <div className="rounded-lg border p-3 bg-muted/30">
                      <p className="text-sm whitespace-pre-wrap">{selectedTicketData.ticket.description}</p>
                      {selectedTicketData.ticket.imageUrls && selectedTicketData.ticket.imageUrls.length > 0 && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {selectedTicketData.ticket.imageUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt={`صورة ${i + 1}`} className="w-20 h-20 object-cover rounded border" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {selectedTicketData.replies.map((r) => (
                        <div key={r.id} className={`rounded-lg p-3 text-sm ${r.isAdmin ? "bg-primary/10 border border-primary/20 mr-4" : "bg-muted/50 border ml-4"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium ${r.isAdmin ? "text-primary" : "text-muted-foreground"}`}>
                              {r.isAdmin ? "فريق الدعم" : "أنت"}
                            </span>
                            <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("ar-SA")}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{r.message}</p>
                        </div>
                      ))}
                    </div>

                    {selectedTicketData.ticket.status !== "resolved" && (
                      <div className="flex gap-2">
                        <Input
                          value={ticketReplyText}
                          onChange={(e) => setTicketReplyText(e.target.value)}
                          placeholder="اكتب ردك..."
                          className="flex-1"
                          data-testid="input-ticket-reply"
                          onKeyDown={(e) => { if (e.key === "Enter" && ticketReplyText.trim()) replyToTicketMutation.mutate(); }}
                        />
                        <Button
                          size="icon"
                          onClick={() => replyToTicketMutation.mutate()}
                          disabled={!ticketReplyText.trim() || replyToTicketMutation.isPending}
                          data-testid="button-send-reply"
                        >
                          {replyToTicketMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
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
                <div className="space-y-4 rounded-lg border p-4" dir="rtl">
                  <div className="flex items-center justify-between">
                    <div className="font-medium flex items-center gap-2"><Send className="h-4 w-4 text-blue-500" /> تيليجرام</div>
                    <Switch dir="ltr" checked={telegramEnabled} disabled={!notificationsEnabled} onCheckedChange={(v) => updateSetting("telegram_enabled", v ? "true" : "false")} data-testid="switch-telegram-enabled" />
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground">🤖 خطوات إنشاء البوت:</p>
                    <ol className="text-xs text-muted-foreground space-y-2.5 list-decimal list-inside">
                      <li>
                        <strong>افتح <span dir="ltr">@BotFather</span> في تيليجرام:</strong>
                        <p className="text-[11px] mt-1 mr-4 opacity-75">اذهب لتطبيق تيليجرام، ابحث عن <span dir="ltr">@BotFather</span> واضغط "Start"</p>
                      </li>
                      <li>
                        <strong>اكتب الأمر <span dir="ltr">/newbot</span> ثم اتبع الخطوات:</strong>
                        <p className="text-[11px] mt-1 mr-4 opacity-75">سيطلب منك اسم البوت (مثال: نَسَق-bot)، ثم اسم المستخدم (يجب ينتهي بـ _bot)</p>
                      </li>
                      <li>
                        <strong>انسخ الـ <span dir="ltr">Bot Token</span> من الرسالة:</strong>
                        <p className="text-[11px] mt-1 mr-4 opacity-75">سيعطيك رسالة فيها Token طويل (مثال: <code className="text-[10px] bg-background px-1">123456789:ABCdefGHijKLmnoPQRstUVwxyz</code>). انسخه بسرعة وألصقه في الحقل أدناه</p>
                      </li>
                      <li>
                        <strong>ثم اضغط <span dir="ltr">"API TOKEN"</span> واضغط <span dir="ltr">"Edit Webhook"</span></strong>
                        <p className="text-[11px] mt-1 mr-4 opacity-75">انسخ الرابط الظاهر أدناه والصقه في المتصفح (لتوصيل البوت بـ نَسَق)</p>
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium"><span dir="ltr">Bot Token</span></Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs">من @BotFather في تيليجرام → /newbot → سيعطيك Token يبدأ بأرقام:حروف</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <Input placeholder="123456789:ABCdef..." type="password" value={localSettings.telegram_bot_token || ""} onChange={(e) => updateSetting("telegram_bot_token", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !telegramEnabled} data-testid="input-telegram-bot-token" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">رابط استقبال الرسائل <span dir="ltr">(Webhook)</span></Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs">انسخ هذا الرابط واضبطه في Telegram عشان فكري يستقبل رسائلك ويرد عليها مباشرة</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <div className="flex gap-2">
                      <Input value="https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://67115f6f-a3c8-4cb2-9763-c294fe556101-00-3dexi67745dtk.riker.replit.dev/api/integrations/telegram/webhook" readOnly dir="ltr" className="font-mono text-xs bg-muted" data-testid="input-telegram-webhook-url" />
                      <Button variant="outline" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText("https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://67115f6f-a3c8-4cb2-9763-c294fe556101-00-3dexi67745dtk.riker.replit.dev/api/integrations/telegram/webhook"); toast({ title: "تم النسخ" }); }} data-testid="button-copy-telegram-webhook"><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-medium">معرفات <span dir="ltr">Chat ID</span> المربوطة</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs"><strong>كيف تجد Chat ID:</strong><br/>1️⃣ أرسل رسالة إلى البوت<br/>2️⃣ نَسَق سبرد ترد عليك برسالة فيها Chat ID حقك<br/>أو استخدم @userinfobot</TooltipContent></Tooltip></TooltipProvider>
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
                      <Label className="text-xs font-medium"><span dir="ltr">Chat ID</span> اختياري للإشعارات التلقائية</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><CircleHelp className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-xs text-xs"><strong>اختياري:</strong> هنا Chat ID للقروب أو القناة اللي بتبي نَسَق ترسل الأخبار الجديدة لها تلقائياً (غير رسائل المحادثة)</TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <Input placeholder="Chat ID للإشعارات" value={localSettings.telegram_chat_id || ""} onChange={(e) => updateSetting("telegram_chat_id", e.target.value)} dir="ltr" className="font-mono" disabled={!notificationsEnabled || !telegramEnabled} data-testid="input-telegram-notif-chat-id" />
                  </div>

                  <Button variant="outline" onClick={() => testTelegramMutation.mutate()} disabled={!notificationsEnabled || !telegramEnabled || testTelegramMutation.isPending} className="gap-2" data-testid="button-test-telegram">
                    {testTelegramMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />} اختبار تيليجرام
                  </Button>
                </div>

                {/* ── Slack Section ── */}
                <div className="space-y-4 rounded-lg border p-4" dir="rtl">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Slack</div>
                    <Switch dir="ltr" checked={slackEnabled} disabled={!notificationsEnabled} onCheckedChange={(v) => updateSetting("slack_enabled", v ? "true" : "false")} data-testid="switch-slack-enabled" />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">🔧 خطوات إعداد التطبيق:</p>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="step-1" className="border rounded-lg px-3">
                        <AccordionTrigger className="text-xs font-medium hover:no-underline">1️⃣ إنشاء التطبيق</AccordionTrigger>
                        <AccordionContent className="text-xs text-muted-foreground space-y-2">
                          <p>أول شيء تحتاج تروح إلى صفحة تطبيقات سلاك عبر الرابط: <a href="https://api.slack.com/apps" target="_blank" className="text-primary underline" dir="ltr">api.slack.com/apps</a></p>
                          <p>ثم تضغط <span dir="ltr" className="bg-background px-1 rounded">Create New App</span> وتختار <span dir="ltr" className="bg-background px-1 rounded">From Scratch</span></p>
                          <p>وتكتب اسم التطبيق وتحدد الـ Workspace اللي تبي تربطه</p>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-2" className="border rounded-lg px-3 mt-2">
                        <AccordionTrigger className="text-xs font-medium hover:no-underline">2️⃣ ضبط اسم البوت في App Home</AccordionTrigger>
                        <AccordionContent className="text-xs text-muted-foreground space-y-2">
                          <p>قبل ما تثبّت التطبيق، ادخل على تبويب <span dir="ltr" className="bg-background px-1 rounded">App Home</span> من القائمة الجانبية</p>
                          <p>وتأكد من أن خانة <span dir="ltr" className="bg-background px-1 rounded">App Display Name</span> (اسم البوت اللي بيطلع للناس) فيها اسم مناسب ومكتوب بشكل صحيح</p>
                          <p className="text-red-500">⚠️ لو خانة الاسم فاضية أو فيها مشكلة ممكن ما يظهر البوت بشكل صحيح داخل سلاك</p>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-3" className="border rounded-lg px-3 mt-2">
                        <AccordionTrigger className="text-xs font-medium hover:no-underline">3️⃣ إضافة الصلاحيات (Bot Scopes) 🔴 مهمة جداً</AccordionTrigger>
                        <AccordionContent className="text-xs text-muted-foreground space-y-2">
                          <p>ادخل على <span dir="ltr" className="bg-background px-1 rounded">OAuth & Permissions</span> وانزل إلى <span dir="ltr" className="bg-background px-1 rounded">Bot Token Scopes</span></p>
                          <p>أضف الصلاحيات حسب الطريقة اللي تبي البوت يشتغل فيها:</p>
                          
                          <p className="font-semibold mt-2">🔹 لو تبغى البوت يرد فقط لما أحد يمنشنه:</p>
                          <p>أضف هذي الصلاحيات:</p>
                          <div className="ml-4 space-y-1">
                            <p><code dir="ltr" className="text-[10px] bg-background px-2 py-1 rounded">app_mentions:read</code></p>
                            <p><code dir="ltr" className="text-[10px] bg-background px-2 py-1 rounded">chat:write</code></p>
                          </div>

                          <p className="font-semibold mt-2">🔹 لو تبغى البوت يقرأ كل رسائل القناة ويرد بدون منشن:</p>
                          <p>أضف هذي الصلاحيات:</p>
                          <div className="ml-4 space-y-1">
                            <p><code dir="ltr" className="text-[10px] bg-background px-2 py-1 rounded">channels:history</code></p>
                            <p><code dir="ltr" className="text-[10px] bg-background px-2 py-1 rounded">channels:read</code></p>
                            <p><code dir="ltr" className="text-[10px] bg-background px-2 py-1 rounded">chat:write</code></p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-4" className="border rounded-lg px-3 mt-2">
                        <AccordionTrigger className="text-xs font-medium hover:no-underline">4️⃣ تثبيت التطبيق على الـ Workspace</AccordionTrigger>
                        <AccordionContent className="text-xs text-muted-foreground space-y-2">
                          <p>بعد إضافة الصلاحيات، ارجع لأعلى صفحة <span dir="ltr" className="bg-background px-1 rounded">OAuth & Permissions</span></p>
                          <p>واضغط <span dir="ltr" className="bg-background px-1 rounded">Install to Workspace</span> ثم وافق على الأذونات من خلال <span dir="ltr" className="bg-background px-1 rounded">Allow</span></p>
                          <p className="text-green-600">✅ هذه الخطوة ضرورية عشان سلاك ينشئ لك الـ Bot Token بالصلاحيات اللي اخترتها</p>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-5" className="border rounded-lg px-3 mt-2">
                        <AccordionTrigger className="text-xs font-medium hover:no-underline">5️⃣ نسخ القيم المطلوبة وإدخالها هنا</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground space-y-4">
                          <p className="text-xs">بعد التثبيت، ارجع لصفحة تطبيقك في سلاك وانسخ القيم التالية والصقها هنا:</p>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium"><span dir="ltr">Webhook URL</span> — لإرسال الإشعارات التلقائية</Label>
                            <div className="text-[11px] space-y-0.5 bg-muted/50 rounded px-2 py-1.5">
                              <p>📍 من القائمة الجانبية اختر <span dir="ltr" className="font-mono bg-background px-1 rounded">Incoming Webhooks</span></p>
                              <p>📍 فعّل خيار <span dir="ltr" className="font-mono bg-background px-1 rounded">Activate Incoming Webhooks</span></p>
                              <p>📍 اضغط <span dir="ltr" className="font-mono bg-background px-1 rounded">Add New Webhook to Workspace</span> واختار القناة</p>
                              <p>📍 انسخ الـ Webhook URL اللي يبدأ بـ <span dir="ltr" className="font-mono bg-background px-1 rounded">https://hooks.slack.com/services/...</span></p>
                            </div>
                            <Input placeholder="https://hooks.slack.com/services/..." value={localSettings.slack_webhook_url || ""} onChange={(e) => updateSetting("slack_webhook_url", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !slackEnabled} data-testid="input-slack-webhook" />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium"><span dir="ltr">Bot User OAuth Token</span></Label>
                            <div className="text-[11px] space-y-0.5 bg-muted/50 rounded px-2 py-1.5">
                              <p>📍 من القائمة الجانبية اختر <span dir="ltr" className="font-mono bg-background px-1 rounded">OAuth & Permissions</span></p>
                              <p>📍 انزل لقسم <span dir="ltr" className="font-mono bg-background px-1 rounded">OAuth Tokens for Your Workspace</span></p>
                              <p>📍 انسخ الـ <span dir="ltr" className="font-mono bg-background px-1 rounded">Bot User OAuth Token</span> اللي يبدأ بـ <span dir="ltr" className="font-mono bg-background px-1 rounded">xoxb-</span></p>
                            </div>
                            <Input placeholder="xoxb-..." type="password" value={localSettings.slack_bot_token || ""} onChange={(e) => updateSetting("slack_bot_token", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !slackEnabled} data-testid="input-slack-bot-token" />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium"><span dir="ltr">Signing Secret</span></Label>
                            <div className="text-[11px] space-y-0.5 bg-muted/50 rounded px-2 py-1.5">
                              <p>📍 من القائمة الجانبية اختر <span dir="ltr" className="font-mono bg-background px-1 rounded">Basic Information</span></p>
                              <p>📍 انزل لقسم <span dir="ltr" className="font-mono bg-background px-1 rounded">App Credentials</span></p>
                              <p>📍 انسخ قيمة <span dir="ltr" className="font-mono bg-background px-1 rounded">Signing Secret</span> من هناك</p>
                            </div>
                            <Input placeholder="Signing Secret" type="password" value={localSettings.slack_signing_secret || ""} onChange={(e) => updateSetting("slack_signing_secret", e.target.value)} dir="ltr" disabled={!notificationsEnabled || !slackEnabled} data-testid="input-slack-signing-secret" />
                          </div>

                          <Button onClick={() => saveMutation.mutate(localSettings)} disabled={saveMutation.isPending || !hasChanges} className="w-full gap-2 mt-1" data-testid="button-save-slack-settings">
                            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            حفظ التغييرات
                          </Button>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-6" className="border rounded-lg px-3 mt-2">
                        <AccordionTrigger className="text-xs font-medium hover:no-underline">6️⃣ تفعيل Event Subscriptions</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground space-y-3">
                          <p className="text-xs">الآن ادخل على <span dir="ltr" className="bg-background px-1 rounded">Event Subscriptions</span> من القائمة الجانبية</p>
                          <p className="text-xs">فعّل خيار <span dir="ltr" className="bg-background px-1 rounded">Enable Events</span></p>
                          <p className="text-xs">انسخ رابط الاستقبال أدناه والصقه في خانة <span dir="ltr" className="bg-background px-1 rounded">Request URL</span></p>
                          <p className="text-xs">وانتظر لين يظهر لك <span className="text-green-600 font-semibold">Verified</span></p>
                          
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">رابط استقبال الأحداث <span dir="ltr">(Events URL)</span></Label>
                            <div className="flex gap-2">
                              <Input value={`${window.location.origin}/api/integrations/slack/events`} readOnly dir="ltr" className="font-mono text-xs bg-muted" data-testid="input-slack-events-url" />
                              <Button variant="outline" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/integrations/slack/events`); toast({ title: "تم النسخ" }); }} data-testid="button-copy-slack-events-url"><Copy className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-8" className="border rounded-lg px-3 mt-2">
                        <AccordionTrigger className="text-xs font-medium hover:no-underline">7️⃣ اختيار طريقة عمل البوت</AccordionTrigger>
                        <AccordionContent className="text-xs text-muted-foreground space-y-2">
                          <p className="font-semibold">🔹 لو تبغى البوت يرد فقط على المنشن:</p>
                          <p>في قسم <span dir="ltr" className="bg-background px-1 rounded">Subscribe to bot events</span> أضف الحدث:</p>
                          <div className="ml-4 my-1"><code dir="ltr" className="text-[10px] bg-background px-2 py-1 rounded">app_mention</code></div>
                          <p className="font-semibold mt-3">🔹 لو تبغى البوت يقرأ كل رسائل القناة بدون منشن:</p>
                          <p>في نفس صفحة <span dir="ltr" className="bg-background px-1 rounded">Event Subscriptions</span> أضف الحدث:</p>
                          <div className="ml-4 my-1"><code dir="ltr" className="text-[10px] bg-background px-2 py-1 rounded">message.channels</code></div>
                          <p>(مع ضرورة وجود صلاحيات <code dir="ltr" className="text-[10px] bg-background px-1">channels:history</code> و <code dir="ltr" className="text-[10px] bg-background px-1">channels:read</code>)</p>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-9" className="border rounded-lg px-3 mt-2">
                        <AccordionTrigger className="text-xs font-medium hover:no-underline">8️⃣ ربط معرفاتك بنَسَق</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground space-y-3">
                          <p className="text-xs">أضف الـ Member IDs الخاصة بك عشان فكري يتعرف عليك في سلاك:</p>
                          <p className="text-[11px] text-muted-foreground">كيف تجد Member ID: اضغط على بروفايلك في Slack → الـ 3 نقاط → <span dir="ltr" className="bg-background px-1 rounded">Copy member ID</span></p>
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
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="step-10" className="border rounded-lg px-3 mt-2">
                        <AccordionTrigger className="text-xs font-medium hover:no-underline">9️⃣ ملاحظات سريعة ⚠️</AccordionTrigger>
                        <AccordionContent className="text-xs text-muted-foreground space-y-2">
                          <p className="font-semibold">📌 أي تعديل على الصلاحيات (Scopes) يحتاج تعيد <span dir="ltr" className="bg-background px-1 rounded">Install to Workspace</span> عشان التوكن يتحدث</p>
                          <p className="font-semibold mt-2">📌 تأكد أنك ضفت البوت داخل القناة من سلاك نفسه</p>
                          <p>البوت ما يقدر يشوف أو يرد في قناة مو مضاف فيها</p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Route className="h-4 w-4" /> التوجيه الذكي — قنوات الربط المتعددة</CardTitle>
                <CardDescription>أضف عدة بوتات أو حسابات لتيليجرام وسلاك، ثم وجّه كل مجلد لقناة محددة تلقائياً.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><Settings2 className="h-4 w-4" /> قنوات الربط</h4>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddChannel(true)} data-testid="button-add-integration-channel">
                      <Plus className="h-3.5 w-3.5" /> إضافة قناة
                    </Button>
                  </div>

                  {showAddChannel && (
                    <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">المنصة</Label>
                          <Select value={newChannelPlatform} onValueChange={setNewChannelPlatform}>
                            <SelectTrigger data-testid="select-channel-platform"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="telegram">تيليجرام</SelectItem>
                              <SelectItem value="slack">سلاك</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">اسم القناة (تسمية)</Label>
                          <Input placeholder="مثال: بوت الأخبار، بوت العمل..." value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} data-testid="input-channel-name" />
                        </div>
                      </div>
                      {newChannelPlatform === "telegram" && (
                        <div className="space-y-1">
                          <Label className="text-xs"><span dir="ltr">Bot Token</span></Label>
                          <Input placeholder="123456789:ABCdef..." type="password" dir="ltr" value={newChannelBotToken} onChange={(e) => setNewChannelBotToken(e.target.value)} data-testid="input-channel-bot-token" />
                        </div>
                      )}
                      {newChannelPlatform === "slack" && (
                        <div className="space-y-1">
                          <Label className="text-xs"><span dir="ltr">Webhook URL</span></Label>
                          <Input placeholder="https://hooks.slack.com/services/..." type="password" dir="ltr" value={newChannelWebhookUrl} onChange={(e) => setNewChannelWebhookUrl(e.target.value)} data-testid="input-channel-webhook-url" />
                        </div>
                      )}
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => { setShowAddChannel(false); setNewChannelName(""); setNewChannelBotToken(""); setNewChannelWebhookUrl(""); }} data-testid="button-cancel-add-channel">إلغاء</Button>
                        <Button size="sm" className="gap-1.5" onClick={() => createChannelMutation.mutate()} disabled={!newChannelName.trim() || (newChannelPlatform === "telegram" && !newChannelBotToken.trim()) || (newChannelPlatform === "slack" && !newChannelWebhookUrl.trim()) || createChannelMutation.isPending} data-testid="button-confirm-add-channel">
                          {createChannelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} إضافة
                        </Button>
                      </div>
                    </div>
                  )}

                  {(integrationChannels || []).length === 0 && !showAddChannel && (
                    <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg border-dashed">
                      <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>لم تتم إضافة أي قناة ربط بعد</p>
                      <p className="text-xs mt-1">أضف بوت تيليجرام أو Webhook سلاك لتوجيه الإشعارات</p>
                    </div>
                  )}

                  {(integrationChannels || []).map(ch => (
                    <div key={ch.id} className="rounded-lg border p-3 space-y-2" data-testid={`integration-channel-${ch.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {ch.platform === "telegram" ? <Send className="h-4 w-4 text-blue-500" /> : <Hash className="h-4 w-4 text-purple-500" />}
                          <span className="font-medium text-sm">{ch.name}</span>
                          <Badge variant="outline" className="text-[10px]">{ch.platform === "telegram" ? "تيليجرام" : "سلاك"}</Badge>
                          {!ch.isActive && <Badge variant="secondary" className="text-[10px]">معطّل</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Switch dir="ltr" checked={ch.isActive} onCheckedChange={(v) => toggleChannelMutation.mutate({ id: ch.id, isActive: v })} data-testid={`switch-channel-active-${ch.id}`} />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => testChannelMutation.mutate({ id: ch.id })} disabled={testChannelMutation.isPending} data-testid={`button-test-channel-${ch.id}`}>
                            <TestTube className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteChannelMutation.mutate(ch.id)} disabled={deleteChannelMutation.isPending} data-testid={`button-delete-channel-${ch.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Route className="h-4 w-4" /> توجيه المجلدات</h4>
                  <p className="text-xs text-muted-foreground">حدد لكل مجلد القناة والقروب/الشات اللي يرسل لها الإشعارات. إذا لم يُحدد توجيه للمجلد، سيستخدم الإعدادات العامة أعلاه.</p>

                  {(folderMappings || []).length > 0 && (
                    <div className="space-y-2">
                      {(folderMappings || []).map(m => {
                        const folder = (folders || []).find(f => f.id === m.folderId);
                        const channel = (integrationChannels || []).find(c => c.id === m.integrationChannelId);
                        return (
                          <div key={m.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm" data-testid={`folder-mapping-${m.id}`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              {folder && <Badge style={{ backgroundColor: folder.color, color: "#fff" }} className="text-xs">{folder.name}</Badge>}
                              <span className="text-muted-foreground">→</span>
                              {channel && <Badge variant="outline" className="text-xs gap-1">{channel.platform === "telegram" ? <Send className="h-3 w-3" /> : <Hash className="h-3 w-3" />}{channel.name}</Badge>}
                              <span className="font-mono text-xs text-muted-foreground" dir="ltr">{m.targetId}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMappingMutation.mutate(m.id)} disabled={deleteMappingMutation.isPending} data-testid={`button-delete-mapping-${m.id}`}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(integrationChannels || []).length > 0 && (folders || []).length > 0 && (
                    <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">المجلد</Label>
                          <Select value={newMappingFolderId} onValueChange={setNewMappingFolderId}>
                            <SelectTrigger data-testid="select-mapping-folder"><SelectValue placeholder="اختر مجلد" /></SelectTrigger>
                            <SelectContent>
                              {(folders || []).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">قناة الربط</Label>
                          <Select value={newMappingChannelId} onValueChange={setNewMappingChannelId}>
                            <SelectTrigger data-testid="select-mapping-channel"><SelectValue placeholder="اختر قناة" /></SelectTrigger>
                            <SelectContent>
                              {(integrationChannels || []).filter(c => c.isActive).map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.platform === "telegram" ? "تيليجرام" : "سلاك"})</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{(integrationChannels || []).find(c => c.id === newMappingChannelId)?.platform === "slack" ? "Channel" : "Chat ID"}</Label>
                          <Input placeholder={((integrationChannels || []).find(c => c.id === newMappingChannelId)?.platform === "slack") ? "#channel-name" : "مثال: -1001234567890"} value={newMappingTargetId} onChange={(e) => setNewMappingTargetId(e.target.value)} dir="ltr" className="font-mono text-xs" data-testid="input-mapping-target-id" />
                        </div>
                      </div>
                      <Button size="sm" className="gap-1.5" onClick={() => createMappingMutation.mutate()} disabled={!newMappingFolderId || !newMappingChannelId || !newMappingTargetId.trim() || createMappingMutation.isPending} data-testid="button-add-mapping">
                        {createMappingMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} إضافة توجيه
                      </Button>
                    </div>
                  )}

                  {(integrationChannels || []).length === 0 && (
                    <p className="text-xs text-muted-foreground border rounded-lg border-dashed p-3 text-center">أضف قناة ربط أولاً لتتمكن من توجيه المجلدات</p>
                  )}
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
                <div className="space-y-1">
                  <Label>مصدر البحث</Label>
                  <Select value={localSettings.web_search_provider || "system_default"} onValueChange={(value) => updateSetting("web_search_provider", value)}>
                    <SelectTrigger data-testid="select-web-search-provider"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system_default">النموذج الافتراضي للموقع</SelectItem>
                      <SelectItem value="custom">مفتاح API مخصص</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">اختر النموذج الافتراضي للموقع أو أضف مفتاحك الخاص</p>
                </div>
                {localSettings.web_search_provider === "system_default" && (
                  <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 flex items-center gap-3">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-sm text-muted-foreground">يستخدم مفتاح البحث الافتراضي للموقع — لا تحتاج إعداد إضافي.</p>
                  </div>
                )}
                {localSettings.web_search_provider === "custom" && (
                  <div className="space-y-1">
                    <Label>Brave Search API Key</Label>
                    <Input
                      type="password"
                      placeholder="BSA... أو BSP..."
                      value={localSettings.web_search_api_key || ""}
                      onChange={(e) => updateSetting("web_search_api_key", e.target.value)}
                      dir="ltr"
                      data-testid="input-web-search-api-key"
                    />
                    <p className="text-xs text-muted-foreground">احصل على مفتاح مجاني من <span className="font-mono" dir="ltr">api.search.brave.com</span></p>
                  </div>
                )}
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
                <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-4 w-4" /> درّب فكري — بصمة أسلوبك</CardTitle>
                <CardDescription>ارفع سكربتاتك ومحتواك السابق. فكري يتعلم أسلوبك ويستخدمه في توليد الأفكار.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border p-4 space-y-3 bg-muted/30">
                  <p className="text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> إضافة عينة تدريب جديدة</p>
                  <div className="space-y-1">
                    <Label>عنوان العينة</Label>
                    <Input
                      placeholder="مثال: سكربت فيديو أفضل 5 تطبيقات"
                      value={trainingSampleTitle}
                      onChange={(e) => setTrainingSampleTitle(e.target.value)}
                      data-testid="input-training-sample-title"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>نوع المحتوى</Label>
                    <Select value={trainingSampleType} onValueChange={setTrainingSampleType}>
                      <SelectTrigger data-testid="select-training-sample-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="script">سكربت فيديو</SelectItem>
                        <SelectItem value="description">وصف فيديو</SelectItem>
                        <SelectItem value="text">نص عام</SelectItem>
                        <SelectItem value="notes">ملاحظات أسلوب</SelectItem>
                        <SelectItem value="clip" disabled>مقطع (قريباً)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>المحتوى النصي</Label>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="cursor-pointer inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors" data-testid="button-upload-training-file">
                        <Upload className="h-3.5 w-3.5" />
                        رفع ملف نصي
                        <input
                          type="file"
                          accept=".txt,.md,.text,.csv,.srt"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 500000) {
                              toast({ title: "خطأ", description: "الملف كبير جداً (الحد الأقصى 500 كيلوبايت)", variant: "destructive" });
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const text = ev.target?.result as string;
                              if (text) {
                                setTrainingSampleContent(text);
                                if (!trainingSampleTitle.trim()) {
                                  setTrainingSampleTitle(file.name.replace(/\.[^.]+$/, ""));
                                }
                              }
                            };
                            reader.onerror = () => {
                              toast({ title: "خطأ", description: "فشل قراءة الملف، تأكد من أنه ملف نصي صالح", variant: "destructive" });
                            };
                            reader.readAsText(file);
                            e.target.value = "";
                          }}
                          data-testid="input-upload-training-file"
                        />
                      </label>
                      <span className="text-xs text-muted-foreground">أو الصق المحتوى مباشرة</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Input
                        placeholder="رابط Google Doc (فعّل المشاركة: أي شخص لديه الرابط)"
                        value={gdocUrl}
                        onChange={(e) => setGdocUrl(e.target.value)}
                        className="flex-1"
                        dir="ltr"
                        data-testid="input-gdoc-url"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 shrink-0"
                        onClick={() => fetchGdocMutation.mutate()}
                        disabled={!gdocUrl.trim() || fetchGdocMutation.isPending}
                        data-testid="button-fetch-gdoc"
                      >
                        {fetchGdocMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                        استيراد
                      </Button>
                    </div>
                    <Textarea
                      rows={6}
                      placeholder="الصق هنا نص السكربت أو الوصف أو أي محتوى تبي فكري يتعلم منه أسلوبك..."
                      value={trainingSampleContent}
                      onChange={(e) => setTrainingSampleContent(e.target.value)}
                      data-testid="textarea-training-sample-content"
                    />
                  </div>
                  <Button
                    onClick={() => submitTrainingSampleMutation.mutate()}
                    disabled={!trainingSampleTitle.trim() || !trainingSampleContent.trim() || submitTrainingSampleMutation.isPending}
                    className="gap-2"
                    data-testid="button-submit-training-sample"
                  >
                    {submitTrainingSampleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    تحليل وإضافة
                  </Button>
                </div>

                {(trainingSamples || []).length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" /> العينات المضافة ({(trainingSamples as any[] || []).length})
                      </p>
                      {(trainingSamples || []).map((sample: any) => (
                        <div key={sample.id} className="rounded-lg border p-3 flex items-start justify-between gap-3" data-testid={`card-training-sample-${sample.id}`}>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{sample.sampleTitle}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {sample.contentType === "script" ? "سكربت" : sample.contentType === "description" ? "وصف" : sample.contentType === "notes" ? "ملاحظات" : "نص"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(sample.createdAt).toLocaleDateString("ar")}
                              </span>
                            </div>
                            {sample.extractedStyle && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{sample.extractedStyle}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTrainingSampleMutation.mutate(sample.id)}
                            disabled={deleteTrainingSampleMutation.isPending}
                            data-testid={`button-delete-training-sample-${sample.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {((trainingSamples || []).length > 0 || localSettings.style_profile || localStyleMatrix) && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <BrainCircuit className="h-4 w-4" /> مصفوفة الأسلوب
                        </p>
                        {(trainingSamples || []).length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => analyzeStyleMutation.mutate()}
                            disabled={analyzeStyleMutation.isPending}
                            data-testid="button-analyze-style"
                          >
                            {analyzeStyleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            إعادة تحليل الأسلوب
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        هذه البصمة الأسلوبية المستخرجة من عيناتك. تُحقن تلقائياً عند توليد الأفكار.
                      </p>

                      {(localSettings.style_profile || localStyleMatrix) ? (
                        <div className="space-y-2">
                          {editingStyleMatrix ? (
                            <>
                              <Textarea
                                rows={8}
                                value={localStyleMatrix || localSettings.style_profile || ""}
                                onChange={(e) => setLocalStyleMatrix(e.target.value)}
                                data-testid="textarea-style-matrix-edit"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => saveStyleMatrixMutation.mutate()}
                                  disabled={saveStyleMatrixMutation.isPending}
                                  data-testid="button-save-style-matrix"
                                >
                                  {saveStyleMatrixMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                  حفظ
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingStyleMatrix(false)}>إلغاء</Button>
                              </div>
                            </>
                          ) : (
                            <div
                              className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => { setLocalStyleMatrix(localSettings.style_profile || localStyleMatrix); setEditingStyleMatrix(true); }}
                              data-testid="text-style-matrix-display"
                            >
                              {localSettings.style_profile || localStyleMatrix}
                              <p className="text-xs text-primary mt-2">اضغط للتعديل</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                          أضف عينات تدريب أعلاه ثم اضغط "إعادة تحليل الأسلوب" لاستخراج مصفوفة الأسلوب
                        </div>
                      )}
                    </div>
                  </>
                )}
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

          </TabsContent>
        </Tabs>

        <div className="text-center text-sm text-muted-foreground py-4 border-t mt-6" data-testid="text-version">
          نَسَق — الإصدار {appVersion}
        </div>
      </div>
    </MainLayout>
  );
}
