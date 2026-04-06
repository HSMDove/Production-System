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
import { cn } from "@/lib/utils";
import { getThemeOption, themeOptions } from "@/lib/theme-options";
import { USER_MODEL_CATALOG, getDefaultModel, type UserAIProvider } from "@/lib/model-catalog";

type PlatformIdEntry = { id: string; platform: string; platformId: string; label: string | null; createdAt: string };
type IntegrationChannelEntry = { id: string; platform: string; name: string; credentials: Record<string, string>; isActive: boolean; createdAt: string };
type FolderMappingEntry = { id: string; folderId: string; integrationChannelId: string; targetId: string; createdAt: string };
type FolderEntry = { id: string; name: string; color: string };

type SettingsData = Record<string, string | null>;

interface SmartFilter {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  isEnabled: boolean;
  folderIds: string[] | null;
}

interface SmartFiltersConfig {
  globalEnabled: boolean;
  filters: SmartFilter[];
}

const DEFAULT_SMART_CONFIG: SmartFiltersConfig = {
  globalEnabled: false,
  filters: [
    { id: "default", name: "الفلتر الافتراضي", description: "", isDefault: true, isEnabled: true, folderIds: null },
  ],
};

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
  const [slackConnectionTab, setSlackConnectionTab] = useState<"auto" | "manual">("auto");

  // ─── Smart Filters state ────────────────────────────────────────────────
  const [smartConfig, setSmartConfig] = useState<SmartFiltersConfig>(DEFAULT_SMART_CONFIG);
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [newFilterDesc, setNewFilterDesc] = useState("");
  const [newFilterFolderIds, setNewFilterFolderIds] = useState<string[] | null>(null);
  // ─────────────────────────────────────────────────────────────────────────

  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketCategory, setTicketCategory] = useState<"complaint" | "suggestion">("complaint");
  const [ticketImages, setTicketImages] = useState<string[]>([]);
  const [showMyTickets, setShowMyTickets] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState("");

  const { data: settings, isLoading } = useQuery<SettingsData>({ queryKey: ["/api/settings"] });
  const { data: versionData } = useQuery<{ version: string }>({ queryKey: ["/api/version"] });
  const appVersion = versionData?.version || "2.7.5";
  const { data: platformIds } = useQuery<PlatformIdEntry[]>({ queryKey: ["/api/auth/platform-ids"] });
  const { data: trainingSamples } = useQuery<any[]>({ queryKey: ["/api/training/samples"] });
  const { data: integrationChannels } = useQuery<IntegrationChannelEntry[]>({ queryKey: ["/api/integrations/channels"] });
  const { data: folderMappings } = useQuery<FolderMappingEntry[]>({ queryKey: ["/api/integrations/folder-mappings"] });
  const { data: folders } = useQuery<FolderEntry[]>({ queryKey: ["/api/folders"] });
  const { data: smartFiltersData } = useQuery<SmartFiltersConfig>({ queryKey: ["/api/settings/smart-filters"] });

  // Free model status — fetched only when user has openrouter/auto selected
  const { data: freeModelStatus } = useQuery<{ routingModel: string; lastUsedModel: string | null }>({
    queryKey: ["/api/free-model-status"],
    enabled:
      localSettings.ai_provider === "custom" &&
      localSettings.ai_custom_provider === "openrouter" &&
      localSettings.ai_custom_model === "openrouter/auto",
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });

  type SlackChannel = { id: string; name: string; topic?: string; memberCount?: number };

  const slackIds = useMemo(() => (platformIds || []).filter(p => p.platform === "slack"), [platformIds]);
  const telegramIds = useMemo(() => (platformIds || []).filter(p => p.platform === "telegram"), [platformIds]);

  useEffect(() => {
    if (settings) setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (smartFiltersData) setSmartConfig(smartFiltersData);
  }, [smartFiltersData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get("slack_oauth");
    if (oauthResult === "success") {
      toast({ title: "تم الربط", description: "تم ربط Slack بنجاح! البوت مثبّت في الـ Workspace حقك." });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/slack/channels"] });
      setActiveTab("notifications");
      window.history.replaceState({}, "", "/settings");
    } else if (oauthResult === "error") {
      const msg = params.get("msg") || "حدث خطأ أثناء الربط";
      toast({ title: "فشل الربط", description: msg, variant: "destructive" });
      setActiveTab("notifications");
      window.history.replaceState({}, "", "/settings");
    }
  }, []);


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

  const slackOAuthStartMutation = useMutation({
    mutationFn: async () => {
      const data = await apiRequest("GET", "/api/integrations/slack/oauth/start") as any;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.url) window.location.href = data.url;
      else toast({ title: "خطأ", description: "لم يتم الحصول على رابط الربط", variant: "destructive" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل بدء عملية ربط Slack", variant: "destructive" }),
  });

  const slackOAuthConnections = useMemo(() =>
    (integrationChannels || []).filter(c => c.platform === "slack" && c.credentials?.connection_type === "oauth"),
    [integrationChannels]
  );

  // ─── Smart Filters mutations ─────────────────────────────────────────────
  const saveSmartFiltersMutation = useMutation({
    mutationFn: (config: SmartFiltersConfig) => apiRequest("PUT", "/api/settings/smart-filters", config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/smart-filters"] });
      toast({ title: "✅ تم حفظ الفلاتر" });
    },
    onError: () => toast({ title: "خطأ في حفظ الفلاتر", variant: "destructive" }),
  });

  const applyToExistingMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/settings/smart-filters/apply-to-existing"),
    onSuccess: () => toast({ title: "✅ جاري التطبيق على الأخبار القديمة في الخلفية" }),
    onError: () => toast({ title: "خطأ في تطبيق الفلاتر", variant: "destructive" }),
  });

  function updateSmartConfig(updater: (prev: SmartFiltersConfig) => SmartFiltersConfig) {
    setSmartConfig((prev) => updater(prev));
  }
  // ─────────────────────────────────────────────────────────────────────────

  const hasManualSlackConfig = !!(localSettings.slack_bot_token || localSettings.slack_webhook_url);
  const hasOAuthSlackConfig = slackOAuthConnections.length > 0;
  const hasSlackConnection = hasOAuthSlackConfig || hasManualSlackConfig;

  useEffect(() => {
    if (hasManualSlackConfig && !hasOAuthSlackConfig) setSlackConnectionTab("manual");
    else if (hasOAuthSlackConfig && !hasManualSlackConfig) setSlackConnectionTab("auto");
  }, [hasManualSlackConfig, hasOAuthSlackConfig]);

  type TicketEntry = { id: string; ticketNumber: number | null; title: string; description: string; imageUrls: string[] | null; category: string; status: string; createdAt: string; updatedAt: string };
  type TicketReplyEntry = { id: string; ticketId: string; userId: string; message: string; isAdmin: boolean; createdAt: string };

  const { data: myTickets } = useQuery<TicketEntry[]>({ queryKey: ["/api/tickets"], enabled: showMyTickets });
  const { data: selectedTicketData } = useQuery<{ ticket: TicketEntry; replies: TicketReplyEntry[] }>({ queryKey: ["/api/tickets", selectedTicketId], enabled: !!selectedTicketId });

  const createTicketMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/tickets", {
      title: ticketTitle,
      description: ticketDescription,
      category: ticketCategory,
      imageUrls: ticketImages.length > 0 ? ticketImages : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setTicketTitle("");
      setTicketDescription("");
      setTicketCategory("complaint");
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
    cancelled: { label: "ملغية", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  };

  const categoryLabels: Record<string, string> = {
    complaint: "شكوى",
    suggestion: "اقتراح",
  };

  const addPlatformIdMutation = useMutation({
    mutationFn: async (data: { platform: string; platformId: string; label?: string }) =>
      apiRequest("POST", "/api/auth/platform-ids", data),
    onSuccess: (_data: any, variables: { platform: string; platformId: string; label?: string }) => {
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
    onError: (err: any) => {
      const isFreeModel = localSettings.ai_custom_model === "openrouter/auto";
      const msg: string = err?.message || "";
      if (isFreeModel && (msg.includes("429") || msg.includes("503") || msg.includes("No models") || msg.includes("rate limit"))) {
        toast({
          title: "الخدمة المجانية غير متاحة",
          description: "الخدمة المجانية غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.",
          variant: "destructive",
        });
      } else {
        toast({ title: "خطأ", description: "فشل اختبار الذكاء الاصطناعي", variant: "destructive" });
      }
    },
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
  const activeThemeOption = getThemeOption(theme);

  const selectedMappingChannel = (integrationChannels || []).find(c => c.id === newMappingChannelId);
  const isSlackMapping = selectedMappingChannel?.platform === "slack";
  const { data: slackChannels } = useQuery<SlackChannel[]>({
    queryKey: ["/api/integrations/slack/channels", newMappingChannelId],
    queryFn: () => fetch(`/api/integrations/slack/channels?integrationChannelId=${encodeURIComponent(newMappingChannelId)}`, { credentials: "include" }).then(r => r.json()),
    enabled: slackEnabled && isSlackMapping && !!newMappingChannelId,
  });

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
      <div className="settings-shell mx-auto w-full max-w-6xl space-y-5 pb-24" dir="rtl">
        <section className="nb-hero">
          <div className="relative z-[1] flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <span className="nb-kicker">غرفة الضبط والمظهر</span>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.08em] sm:text-5xl" data-testid="text-settings-title">
                إعدادات نَسَق
              </h1>
              <p className="mt-4 max-w-2xl text-base font-extrabold text-foreground/75 sm:text-lg">
                تحكم بالمظهر، الإشعارات، تكاملات المنصات، شخصية فكري، وإعدادات حسابك من شاشة واحدة واضحة وحادة.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:min-w-[280px] lg:max-w-[320px]">
              <div className="rounded-[22px] border-[3px] border-black/90 bg-background px-4 py-4 shadow-[6px_6px_0_0_rgba(0,0,0,0.88)]">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-foreground/55">المظهر الحالي</p>
                <div className="mt-3 flex items-center gap-3">
                  <span
                    className="h-5 w-5 rounded-full border-[2px] border-black/85"
                    style={{ backgroundColor: activeThemeOption.color }}
                  />
                  <div>
                    <p className="text-xl font-black">{activeThemeOption.label}</p>
                    <p className="text-sm font-bold text-muted-foreground">{activeThemeOption.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline">{colorMode === "dark" ? "الوضع الليلي" : "الوضع النهاري"}</Badge>
                  <Badge variant="secondary">الإصدار {appVersion}</Badge>
                </div>
              </div>

              <Button
                onClick={() => saveMutation.mutate(localSettings)}
                disabled={!hasChanges || saveMutation.isPending}
                className="gap-2"
                size="lg"
                data-testid="button-save-settings"
              >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ التغييرات
              </Button>
            </div>
          </div>
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 sm:grid-cols-5">
            <TabsTrigger value="account">الحساب</TabsTrigger>
            <TabsTrigger value="appearance">المظهر</TabsTrigger>
            <TabsTrigger value="notifications">الإشعارات</TabsTrigger>
            <TabsTrigger value="fikri">فكري 2.0 والذكاء</TabsTrigger>
            <TabsTrigger value="smart-filter">الفلتر الذكي</TabsTrigger>
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
                      <Label>نوع الرسالة</Label>
                      <div className="flex gap-2 mt-1">
                        <Button
                          variant={ticketCategory === "complaint" ? "default" : "outline"}
                          className="flex-1 gap-2"
                          onClick={() => setTicketCategory("complaint")}
                          data-testid="button-category-complaint"
                        >
                          <AlertCircle className="h-4 w-4" />
                          شكوى
                        </Button>
                        <Button
                          variant={ticketCategory === "suggestion" ? "default" : "outline"}
                          className="flex-1 gap-2"
                          onClick={() => setTicketCategory("suggestion")}
                          data-testid="button-category-suggestion"
                        >
                          <Sparkles className="h-4 w-4" />
                          اقتراح
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>العنوان</Label>
                      <Input
                        value={ticketTitle}
                        onChange={(e) => setTicketTitle(e.target.value)}
                        placeholder={ticketCategory === "complaint" ? "مثال: مشكلة في حفظ المحتوى" : "مثال: إضافة ميزة التصدير"}
                        className="mt-1"
                        data-testid="input-ticket-title"
                      />
                    </div>
                    <div>
                      <Label>{ticketCategory === "complaint" ? "وصف المشكلة" : "وصف الاقتراح"}</Label>
                      <Textarea
                        value={ticketDescription}
                        onChange={(e) => setTicketDescription(e.target.value)}
                        placeholder={ticketCategory === "complaint" ? "اشرح المشكلة بالتفصيل..." : "اشرح اقتراحك بالتفصيل..."}
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
                      <Button variant="outline" onClick={() => { setShowTicketForm(false); setTicketTitle(""); setTicketDescription(""); setTicketCategory("complaint"); setTicketImages([]); }} data-testid="button-cancel-ticket">
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
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground shrink-0">#{t.ticketNumber}</span>
                                <p className="font-medium text-sm truncate">{t.title}</p>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {categoryLabels[t.category] || t.category}
                                </span>
                              </div>
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
                      <span className="text-xs font-mono text-muted-foreground shrink-0">#{selectedTicketData.ticket.ticketNumber}</span>
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
                        <div key={r.id} className={`rounded-lg p-3 text-sm ${r.isAdmin ? "bg-primary/10 border border-primary/20 me-4" : "bg-muted/50 border ms-4"}`}>
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

                    {selectedTicketData.ticket.status !== "resolved" && selectedTicketData.ticket.status !== "cancelled" && (
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
                <CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" /> المظاهر</CardTitle>
                <CardDescription>ثلاث شخصيات بصرية عربية واضحة، وكل واحدة تحمل طابعاً مختلفاً من نفس اللغة التصميمية.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {themeOptions.map((option) => {
                  const isSelected = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      data-testid={`button-theme-${option.value}`}
                      className={cn(
                        "group relative overflow-hidden rounded-[24px] border-[3px] border-black/90 bg-card px-4 py-5 text-right shadow-[6px_6px_0_0_rgba(0,0,0,0.88)] transition-transform duration-100 hover:-translate-y-1",
                        isSelected && "translate-x-[-2px] translate-y-[-2px] bg-primary/20 shadow-[8px_8px_0_0_rgba(0,0,0,0.92)]",
                      )}
                    >
                      <span className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 10px, rgba(0,0,0,0.08) 10px 12px)" }} />
                      <span className="relative z-[1] flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="flex items-center gap-3">
                            <span className="h-5 w-5 rounded-full border-[2px] border-black/85" style={{ backgroundColor: option.color }} />
                            <span className="text-2xl font-black">{option.label}</span>
                          </span>
                          <span className="mt-3 block text-sm font-bold text-muted-foreground">{option.description}</span>
                        </span>
                        {isSelected && <Check className="mt-1 h-5 w-5 shrink-0" />}
                      </span>
                    </button>
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

                  {slackEnabled && notificationsEnabled && (
                    <>
                      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
                        <button
                          className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all ${slackConnectionTab === "auto" ? "bg-background shadow-sm" : "hover:bg-background/50"} ${hasManualSlackConfig ? "opacity-40 cursor-not-allowed" : ""}`}
                          onClick={() => { if (!hasManualSlackConfig) setSlackConnectionTab("auto"); else toast({ title: "تنبيه", description: "لازم تحذف إعدادات الربط اليدوي أولاً (Webhook / Bot Token) عشان تقدر تستخدم الربط التلقائي", variant: "destructive" }); }}
                          data-testid="tab-slack-auto"
                        >
                          ربط تلقائي
                        </button>
                        <button
                          className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all ${slackConnectionTab === "manual" ? "bg-background shadow-sm" : "hover:bg-background/50"} ${hasOAuthSlackConfig ? "opacity-40 cursor-not-allowed" : ""}`}
                          onClick={() => { if (!hasOAuthSlackConfig) setSlackConnectionTab("manual"); else toast({ title: "تنبيه", description: "لازم تفصل الربط التلقائي أولاً عشان تقدر تستخدم الربط اليدوي", variant: "destructive" }); }}
                          data-testid="tab-slack-manual"
                        >
                          ربط يدوي
                        </button>
                      </div>

                      {slackConnectionTab === "auto" && (
                        <div className="space-y-3">
                          {slackOAuthConnections.length > 0 ? (
                            <div className="space-y-2">
                              {slackOAuthConnections.map(conn => (
                                <div key={conn.id} className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/5 p-3" data-testid={`slack-oauth-connection-${conn.id}`}>
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="font-medium text-sm">{conn.name}</span>
                                    <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-600">متصل</Badge>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteChannelMutation.mutate(conn.id)} data-testid={`button-disconnect-slack-${conn.id}`}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                              <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => slackOAuthStartMutation.mutate()} disabled={slackOAuthStartMutation.isPending} data-testid="button-slack-oauth-add-another">
                                {slackOAuthStartMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                ربط Workspace إضافي
                              </Button>
                            </div>
                          ) : (
                            <div className="text-center py-6 rounded-lg border border-dashed space-y-3">
                              <Hash className="h-10 w-10 mx-auto text-muted-foreground/40" />
                              <div>
                                <p className="text-sm font-medium">اربط Slack بضغطة واحدة</p>
                                <p className="text-xs text-muted-foreground mt-1">سيُثبّت البوت تلقائياً في الـ Workspace حقك</p>
                              </div>
                              <Button className="gap-2" onClick={() => slackOAuthStartMutation.mutate()} disabled={slackOAuthStartMutation.isPending} data-testid="button-slack-oauth-connect">
                                {slackOAuthStartMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                                ربط Slack
                              </Button>
                            </div>
                          )}

                          <div className="rounded-lg border p-3 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">ربط معرّفك بنَسَق (Member ID)</p>
                            <p className="text-[11px] text-muted-foreground">عشان فكري يعرفك في Slack، أضف الـ Member ID حقك. فكري بيعطيك إياه لو كلمته وأنت مو مربوط.</p>
                            {slackIds.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {slackIds.map((entry) => (
                                  <Badge key={entry.id} variant="secondary" className="gap-1.5 px-2.5 py-1 font-mono text-xs" data-testid={`badge-slack-id-auto-${entry.id}`}>
                                    {entry.label ? `${entry.label}: ` : ""}{entry.platformId}
                                    <button className="hover:text-destructive transition-colors" onClick={() => removePlatformIdMutation.mutate(entry.id)}>
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Input placeholder="مثال: U0123456789" value={newSlackId} onChange={(e) => setNewSlackId(e.target.value)} dir="ltr" className="font-mono text-xs" disabled={!slackEnabled} data-testid="input-new-slack-id-auto" />
                              <Input placeholder="تسمية (اختياري)" value={newSlackLabel} onChange={(e) => setNewSlackLabel(e.target.value)} className="max-w-[140px] text-xs" disabled={!slackEnabled} data-testid="input-new-slack-label-auto" />
                              <Button variant="outline" size="icon" className="shrink-0" disabled={!newSlackId.trim() || addPlatformIdMutation.isPending || !slackEnabled} onClick={() => addPlatformIdMutation.mutate({ platform: "slack", platformId: newSlackId.trim(), label: newSlackLabel.trim() || undefined })} data-testid="button-add-slack-id-auto">
                                {addPlatformIdMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {slackConnectionTab === "manual" && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">خطوات إعداد التطبيق:</p>
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="step-1" className="border rounded-lg px-3">
                              <AccordionTrigger className="text-xs font-medium hover:no-underline">1. إنشاء التطبيق</AccordionTrigger>
                              <AccordionContent className="text-xs text-muted-foreground space-y-2">
                                <p>أول شيء تحتاج تروح إلى صفحة تطبيقات سلاك عبر الرابط: <a href="https://api.slack.com/apps" target="_blank" className="text-primary underline" dir="ltr">api.slack.com/apps</a></p>
                                <p>ثم تضغط <span dir="ltr" className="bg-background px-1 rounded">Create New App</span> وتختار <span dir="ltr" className="bg-background px-1 rounded">From Scratch</span></p>
                                <p>وتكتب اسم التطبيق وتحدد الـ Workspace اللي تبي تربطه</p>
                              </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="step-2" className="border rounded-lg px-3 mt-2">
                              <AccordionTrigger className="text-xs font-medium hover:no-underline">2. ضبط اسم البوت في App Home</AccordionTrigger>
                              <AccordionContent className="text-xs text-muted-foreground space-y-2">
                                <p>قبل ما تثبّت التطبيق، ادخل على تبويب <span dir="ltr" className="bg-background px-1 rounded">App Home</span> من القائمة الجانبية</p>
                                <p>وتأكد من أن خانة <span dir="ltr" className="bg-background px-1 rounded">App Display Name</span> فيها اسم مناسب</p>
                              </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="step-3" className="border rounded-lg px-3 mt-2">
                              <AccordionTrigger className="text-xs font-medium hover:no-underline">3. إضافة الصلاحيات (Bot Scopes)</AccordionTrigger>
                              <AccordionContent className="text-xs text-muted-foreground space-y-2">
                                <p>ادخل على <span dir="ltr" className="bg-background px-1 rounded">OAuth & Permissions</span> وانزل إلى <span dir="ltr" className="bg-background px-1 rounded">Bot Token Scopes</span></p>
                                <p>أضف الصلاحيات:</p>
                                <div className="ms-4 space-y-1">
                                  <p><code dir="ltr" className="text-[10px] bg-background px-2 py-1 rounded">channels:history</code></p>
                                  <p><code dir="ltr" className="text-[10px] bg-background px-2 py-1 rounded">channels:read</code></p>
                                  <p><code dir="ltr" className="text-[10px] bg-background px-2 py-1 rounded">chat:write</code></p>
                                </div>
                              </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="step-4" className="border rounded-lg px-3 mt-2">
                              <AccordionTrigger className="text-xs font-medium hover:no-underline">4. تثبيت التطبيق + نسخ القيم</AccordionTrigger>
                              <AccordionContent className="text-muted-foreground space-y-4">
                                <p className="text-xs">اضغط <span dir="ltr" className="bg-background px-1 rounded">Install to Workspace</span> ثم انسخ القيم التالية:</p>

                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium"><span dir="ltr">Webhook URL</span></Label>
                                  <Input placeholder="https://hooks.slack.com/services/..." value={localSettings.slack_webhook_url || ""} onChange={(e) => updateSetting("slack_webhook_url", e.target.value)} dir="ltr" disabled={!slackEnabled} data-testid="input-slack-webhook" />
                                </div>

                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium"><span dir="ltr">Bot User OAuth Token</span></Label>
                                  <Input placeholder="xoxb-..." type="password" value={localSettings.slack_bot_token || ""} onChange={(e) => updateSetting("slack_bot_token", e.target.value)} dir="ltr" disabled={!slackEnabled} data-testid="input-slack-bot-token" />
                                </div>

                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium"><span dir="ltr">Signing Secret</span></Label>
                                  <Input placeholder="Signing Secret" type="password" value={localSettings.slack_signing_secret || ""} onChange={(e) => updateSetting("slack_signing_secret", e.target.value)} dir="ltr" disabled={!slackEnabled} data-testid="input-slack-signing-secret" />
                                </div>

                                <Button onClick={() => saveMutation.mutate(localSettings)} disabled={saveMutation.isPending || !hasChanges} className="w-full gap-2 mt-1" data-testid="button-save-slack-settings">
                                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                  حفظ التغييرات
                                </Button>
                              </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="step-5" className="border rounded-lg px-3 mt-2">
                              <AccordionTrigger className="text-xs font-medium hover:no-underline">5. تفعيل Event Subscriptions</AccordionTrigger>
                              <AccordionContent className="text-muted-foreground space-y-3">
                                <p className="text-xs">فعّل <span dir="ltr" className="bg-background px-1 rounded">Event Subscriptions</span> والصق رابط الاستقبال:</p>
                                <div className="flex gap-2">
                                  <Input value={`${window.location.origin}/api/integrations/slack/events`} readOnly dir="ltr" className="font-mono text-xs bg-muted" data-testid="input-slack-events-url" />
                                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/integrations/slack/events`); toast({ title: "تم النسخ" }); }} data-testid="button-copy-slack-events-url"><Copy className="h-4 w-4" /></Button>
                                </div>
                              </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="step-6" className="border rounded-lg px-3 mt-2">
                              <AccordionTrigger className="text-xs font-medium hover:no-underline">6. ربط معرفاتك بنَسَق</AccordionTrigger>
                              <AccordionContent className="text-muted-foreground space-y-3">
                                <p className="text-xs">أضف الـ Member IDs الخاصة بك:</p>
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
                                  <Input placeholder="مثال: U0123456789" value={newSlackId} onChange={(e) => setNewSlackId(e.target.value)} dir="ltr" className="font-mono" disabled={!slackEnabled} data-testid="input-new-slack-id" />
                                  <Input placeholder="تسمية (اختياري)" value={newSlackLabel} onChange={(e) => setNewSlackLabel(e.target.value)} className="max-w-[140px]" disabled={!slackEnabled} data-testid="input-new-slack-label" />
                                  <Button variant="outline" size="icon" className="shrink-0" disabled={!newSlackId.trim() || addPlatformIdMutation.isPending || !slackEnabled} onClick={() => addPlatformIdMutation.mutate({ platform: "slack", platformId: newSlackId.trim(), label: newSlackLabel.trim() || undefined })} data-testid="button-add-slack-id">
                                    {addPlatformIdMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>

                          <div className="flex gap-2 pt-2">
                            <Button variant="outline" onClick={() => testSlackMutation.mutate()} disabled={!slackEnabled || testSlackMutation.isPending} className="gap-2" data-testid="button-test-slack-webhook">
                              {testSlackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />} اختبار Webhook
                            </Button>
                            <Button variant="outline" onClick={() => testSlackBotMutation.mutate()} disabled={!slackEnabled || testSlackBotMutation.isPending} className="gap-2" data-testid="button-test-slack-bot">
                              {testSlackBotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />} اختبار البوت
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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

                  {(integrationChannels || []).filter(ch => ch.id !== "manual-slack").map(ch => (
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
                          <Select value={newMappingChannelId} onValueChange={(v) => { setNewMappingChannelId(v); setNewMappingTargetId(""); }}>
                            <SelectTrigger data-testid="select-mapping-channel"><SelectValue placeholder="اختر قناة" /></SelectTrigger>
                            <SelectContent>
                              {(integrationChannels || []).filter(c => c.isActive).map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.platform === "telegram" ? "تيليجرام" : "سلاك"})</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{(integrationChannels || []).find(c => c.id === newMappingChannelId)?.platform === "slack" ? "قناة Slack" : "Chat ID"}</Label>
                          {(integrationChannels || []).find(c => c.id === newMappingChannelId)?.platform === "slack" && slackChannels && slackChannels.length > 0 ? (
                            <Select value={newMappingTargetId} onValueChange={setNewMappingTargetId}>
                              <SelectTrigger data-testid="select-mapping-slack-channel" className="font-mono text-xs" dir="ltr"><SelectValue placeholder="اختر قناة Slack" /></SelectTrigger>
                              <SelectContent>
                                {slackChannels.map(sc => <SelectItem key={sc.id} value={sc.id} dir="ltr">#{sc.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input placeholder={((integrationChannels || []).find(c => c.id === newMappingChannelId)?.platform === "slack") ? "C0123456789" : "مثال: -1001234567890"} value={newMappingTargetId} onChange={(e) => setNewMappingTargetId(e.target.value)} dir="ltr" className="font-mono text-xs" data-testid="input-mapping-target-id" />
                          )}
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
                      value: "default",
                      label: "الافتراضي",
                      desc: "يستخدم محرك فكري الذي يضبطه المدير",
                      icon: "⚡",
                    },
                    {
                      value: "custom",
                      label: "API مخصص",
                      desc: "مفتاحك الشخصي (OpenAI, Gemini, OpenRouter)",
                      icon: "🔑",
                    },
                    {
                      value: "local",
                      label: "نموذج محلي",
                      desc: "Ollama أو LM Studio على جهازك",
                      icon: "💻",
                    },
                  ].map((opt) => {
                    // Treat legacy "replit" value as "default" for display purposes
                    const currentProvider = localSettings.ai_provider === "replit" ? "default" : (localSettings.ai_provider || "default");
                    const selected = currentProvider === opt.value;
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
                {localSettings.ai_provider === "custom" && (() => {
                  const customProvider = (localSettings.ai_custom_provider || "openai") as UserAIProvider;
                  const modelList = USER_MODEL_CATALOG[customProvider] ?? [];
                  const currentModel = localSettings.ai_custom_model || "";
                  const modelInList = modelList.some((m) => m.id === currentModel);
                  const selectedModel = modelInList ? currentModel : getDefaultModel(USER_MODEL_CATALOG, customProvider);
                  return (
                    <div className="rounded-xl border p-4 space-y-3 bg-muted/30">
                      <p className="text-sm font-medium">إعدادات API المخصص</p>

                      {/* Provider selector */}
                      <div className="space-y-1">
                        <Label>مزود الذكاء الاصطناعي</Label>
                        <Select
                          value={customProvider}
                          onValueChange={(value: UserAIProvider) => {
                            updateSetting("ai_custom_provider", value);
                            // Reset model to first of new provider
                            updateSetting("ai_custom_model", getDefaultModel(USER_MODEL_CATALOG, value));
                          }}
                          data-testid="select-custom-provider"
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="gemini">Gemini (Google)</SelectItem>
                            <SelectItem value="openrouter">OpenRouter</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {customProvider === "openrouter" && "يتيح لك الوصول لنماذج OpenAI و Gemini و Claude بمفتاح واحد."}
                          {customProvider === "gemini" && "استخدم مفتاح Google AI Studio مباشرةً."}
                          {customProvider === "openai" && "مفتاح OpenAI الرسمي."}
                        </p>
                      </div>

                      {/* API Key */}
                      <div className="space-y-1">
                        <Label>API Key</Label>
                        <Input
                          type="password"
                          placeholder={
                            customProvider === "openai" ? "sk-..." :
                            customProvider === "gemini" ? "AIza..." :
                            "sk-or-..."
                          }
                          value={localSettings.ai_custom_api_key || ""}
                          onChange={(e) => updateSetting("ai_custom_api_key", e.target.value)}
                          dir="ltr"
                          data-testid="input-llm-api-key"
                        />
                        <p className="text-xs text-muted-foreground">مفتاح الوصول للـ API — الـ Base URL يُضبط تلقائياً بناءً على المزود</p>
                      </div>

                      {/* Smart model dropdown */}
                      <div className="space-y-1">
                        <Label>النموذج</Label>
                        <Select
                          value={selectedModel}
                          onValueChange={(value) => updateSetting("ai_custom_model", value)}
                          data-testid="select-custom-model"
                        >
                          <SelectTrigger><SelectValue placeholder="اختر نموذجاً…" /></SelectTrigger>
                          <SelectContent>
                            {modelList.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground" dir="ltr">{selectedModel}</p>
                      </div>

                      {/* Free model dynamic routing info banner */}
                      {selectedModel === "openrouter/auto" && (
                        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-blue-400 shrink-0" />
                            <p className="text-sm text-blue-300 font-medium">
                              النماذج المجانية يتم تعيينها تلقائياً بناءً على التوفر العالمي
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground pr-6" dir="ltr">
                            يتم الإرسال دائماً عبر:{" "}
                            <span className="font-mono text-blue-400">{freeModelStatus?.routingModel ?? "openrouter/free"}</span>
                          </p>
                          {freeModelStatus?.lastUsedModel && (
                            <p className="text-xs text-muted-foreground pr-6" dir="ltr">
                              آخر نموذج استُخدم:{" "}
                              <span className="font-mono text-blue-400">{freeModelStatus.lastUsedModel}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

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

                {/* Default / Fikri Gateway banner */}
                {(localSettings.ai_provider === "default" || localSettings.ai_provider === "replit" || !localSettings.ai_provider) && (
                  <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 flex items-center gap-3">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-sm text-muted-foreground">سيتم استخدام مزود الذكاء الافتراضي المضبوط من لوحة الإدارة داخل محرك فكري.</p>
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
                      <SelectItem value="system_default">الافتراضي الإداري</SelectItem>
                      <SelectItem value="custom">مفتاح API شخصي</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">عند اختيار الافتراضي الإداري سيتم استخدام مزود البحث المضبوط في لوحة الإدارة.</p>
                </div>
                {localSettings.web_search_provider === "system_default" && (
                  <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 flex items-center gap-3">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-sm text-muted-foreground">يستخدم محرك فكري الإداري ومزود البحث الذي يحدده المدير.</p>
                  </div>
                )}
                {localSettings.web_search_provider === "custom" && (
                  <div className="space-y-1">
                    <Label>مفتاح البحث الشخصي</Label>
                    <Input
                      type="password"
                      placeholder="BSA... أو BSP..."
                      value={localSettings.web_search_api_key || ""}
                      onChange={(e) => updateSetting("web_search_api_key", e.target.value)}
                      dir="ltr"
                      data-testid="input-web-search-api-key"
                    />
                    <p className="text-xs text-muted-foreground">المسار الشخصي الحالي يستخدم Brave Search بمفتاحك الخاص.</p>
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

          {/* ─── الفلاتر الذكية ─── */}
          <TabsContent value="smart-filter" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">🛡️ الفلاتر الذكية</CardTitle>
                <CardDescription>تحكّم بجودة الأخبار — يُطبَّق على الأخبار القديمة والجديدة والقادمة.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Global toggle */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base font-semibold">تفعيل الفلاتر</Label>
                    <p className="text-sm text-muted-foreground">فعّل لتُطبَّق الفلاتر على جميع أخبارك.</p>
                  </div>
                  <Switch
                    checked={smartConfig.globalEnabled}
                    onCheckedChange={(v) => {
                      const next = { ...smartConfig, globalEnabled: v };
                      updateSmartConfig(() => next);
                      saveSmartFiltersMutation.mutate(next);
                    }}
                    data-testid="switch-smart-filter-global"
                  />
                </div>

                {smartConfig.globalEnabled && (
                  <div className="space-y-3">

                    {/* Filter cards */}
                    {smartConfig.filters.map((filter) => (
                      <div key={filter.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-sm truncate">
                              {filter.isDefault ? "🔒" : "📝"} {filter.name}
                            </span>
                            {filter.isDefault && (
                              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground shrink-0">افتراضي</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {!filter.isDefault && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() =>
                                  updateSmartConfig((c) => ({ ...c, filters: c.filters.filter((f) => f.id !== filter.id) }))
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Switch
                              checked={filter.isEnabled}
                              onCheckedChange={(v) =>
                                updateSmartConfig((c) => ({
                                  ...c,
                                  filters: c.filters.map((f) => f.id === filter.id ? { ...f, isEnabled: v } : f),
                                }))
                              }
                            />
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {filter.isDefault
                            ? "يحجب تلقائياً: الإعلانات، إجابات الألعاب اليومية، المحتوى الترويجي، والنتائج عديمة القيمة."
                            : `"${filter.description}"`}
                        </p>

                        {/* Folder chips */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">طبّق على:</Label>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() =>
                                updateSmartConfig((c) => ({
                                  ...c,
                                  filters: c.filters.map((f) => f.id === filter.id ? { ...f, folderIds: null } : f),
                                }))
                              }
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                filter.folderIds === null
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted/50 hover:bg-muted border-border"
                              }`}
                            >
                              كل المجلدات
                            </button>
                            {(folders || []).map((folder) => {
                              const selected = filter.folderIds !== null && filter.folderIds.includes(folder.id);
                              return (
                                <button
                                  key={folder.id}
                                  onClick={() => {
                                    const cur = filter.folderIds ?? [];
                                    const next = cur.includes(folder.id)
                                      ? cur.filter((id) => id !== folder.id)
                                      : [...cur, folder.id];
                                    updateSmartConfig((c) => ({
                                      ...c,
                                      filters: c.filters.map((f) =>
                                        f.id === filter.id ? { ...f, folderIds: next.length === 0 ? null : next } : f,
                                      ),
                                    }));
                                  }}
                                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                    selected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-muted/50 hover:bg-muted border-border"
                                  }`}
                                >
                                  {folder.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add new filter */}
                    {!showAddFilter ? (
                      <Button variant="outline" className="w-full gap-2" onClick={() => setShowAddFilter(true)}>
                        <Plus className="h-4 w-4" />
                        إضافة فلتر جديد
                      </Button>
                    ) : (
                      <div className="rounded-lg border border-dashed p-4 space-y-3">
                        <p className="text-sm font-medium">فلتر جديد</p>
                        <div className="space-y-1">
                          <Label className="text-xs">اسم الفلتر</Label>
                          <Input
                            placeholder="مثال: فلتر السياسة"
                            value={newFilterName}
                            onChange={(e) => setNewFilterName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">اوصف لفكري ماذا تريد حجبه</Label>
                          <Textarea
                            rows={3}
                            placeholder='مثال: "لا أريد أخبار رياضية أو سياسية، أريد التركيز على التكنولوجيا فقط"'
                            value={newFilterDesc}
                            onChange={(e) => setNewFilterDesc(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">طبّق على:</Label>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => setNewFilterFolderIds(null)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                newFilterFolderIds === null
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted/50 hover:bg-muted border-border"
                              }`}
                            >
                              كل المجلدات
                            </button>
                            {(folders || []).map((folder) => {
                              const selected = newFilterFolderIds !== null && newFilterFolderIds.includes(folder.id);
                              return (
                                <button
                                  key={folder.id}
                                  onClick={() => {
                                    const cur = newFilterFolderIds ?? [];
                                    const next = cur.includes(folder.id)
                                      ? cur.filter((id) => id !== folder.id)
                                      : [...cur, folder.id];
                                    setNewFilterFolderIds(next.length === 0 ? null : next);
                                  }}
                                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                    selected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-muted/50 hover:bg-muted border-border"
                                  }`}
                                >
                                  {folder.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={!newFilterName.trim() || !newFilterDesc.trim()}
                            onClick={() => {
                              const newFilter: SmartFilter = {
                                id: crypto.randomUUID(),
                                name: newFilterName.trim(),
                                description: newFilterDesc.trim(),
                                isDefault: false,
                                isEnabled: true,
                                folderIds: newFilterFolderIds,
                              };
                              updateSmartConfig((c) => ({ ...c, filters: [...c.filters, newFilter] }));
                              setNewFilterName("");
                              setNewFilterDesc("");
                              setNewFilterFolderIds(null);
                              setShowAddFilter(false);
                            }}
                          >
                            حفظ الفلتر
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setShowAddFilter(false);
                              setNewFilterName("");
                              setNewFilterDesc("");
                              setNewFilterFolderIds(null);
                            }}
                          >
                            إلغاء
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        className="flex-1 gap-2"
                        onClick={() => saveSmartFiltersMutation.mutate(smartConfig)}
                        disabled={saveSmartFiltersMutation.isPending}
                      >
                        {saveSmartFiltersMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        حفظ الإعدادات
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        disabled={applyToExistingMutation.isPending || saveSmartFiltersMutation.isPending}
                        onClick={() => {
                          saveSmartFiltersMutation.mutate(smartConfig);
                          applyToExistingMutation.mutate();
                        }}
                      >
                        {applyToExistingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        تطبيق على الأخبار القديمة
                      </Button>
                    </div>

                  </div>
                )}

                {!smartConfig.globalEnabled && (
                  <p className="text-sm text-muted-foreground text-center py-4">فعّل الفلاتر من الأعلى لبدء إعداد قواعد الفلترة.</p>
                )}

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
