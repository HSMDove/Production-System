import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  BarChart3, Users, Megaphone, Bell, Settings, Shield, LogOut,
  Plus, Trash2, Edit, Save, X, Loader2, FileText, Eye, EyeOff,
  Lock, AlertTriangle, ChevronLeft, MessageSquare, Send, Clock,
  Sparkles, RotateCcw, Network, ExternalLink, Newspaper, Globe, Type, Upload,
  BadgeDollarSign
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { defaultLoginPageContent, parseLoginPageContent, type LoginPageContent } from "@shared/login-page-content";
import { defaultLandingPageContent, parseLandingPageContent, type LandingPageContent } from "@shared/landing-page-content";
import { ADMIN_MODEL_CATALOG, getDefaultModel, type AdminAIProvider } from "@/lib/model-catalog";

type Tab = "analytics" | "users" | "announcements" | "banners" | "welcome" | "tickets" | "pages" | "settings" | "admins" | "audit" | "connections" | "release-notes" | "ads";

const tabDescriptions: Record<Tab, string> = {
  analytics: "ملخص تنفيذي سريع لحركة النظام والمستخدمين والمحتوى داخل المنصة.",
  users: "مراقبة المستخدمين، أدوارهم، وتاريخ النشاط بأسلوب بصري واضح وسريع القراءة.",
  announcements: "إدارة الرسائل والإعلانات التي تظهر للمستخدمين مع تحكم مباشر بالحالة وعدد المشاهدات.",
  banners: "بناء الشريط العلوي وإبرازه كنقطة اتصال مرئية عالية الوضوح داخل المنتج.",
  welcome: "ضبط بطاقات الترحيب وتسلسل ظهورها للمستخدمين بطريقة مرنة وقابلة للتجربة.",
  tickets: "متابعة الشكاوى والاقتراحات والرد عليها من داخل مساحة إدارة واحدة.",
  pages: "تحرير محتوى الصفحات الثابتة في التطبيق مثل شاشة تسجيل الدخول والتحقق دون تعديل الكود.",
  settings: "مفاتيح تشغيل المنصة والإعدادات العامة التي تتحكم في سلوك النظام بالكامل.",
  admins: "إدارة الحسابات الإدارية والصلاحيات وكلمات المرور دون مغادرة اللوحة.",
  audit: "سجل قرارات الإدارة والعمليات الحساسة لمراجعة التغييرات بدقة.",
  connections: "إدارة روابط التكامل الخارجية للمنصة: النطاقات، DNS، قواعد البيانات، وغيرها.",
  "release-notes": "نشر وإدارة ملاحظات الإصدارات التي تظهر للمستخدمين عبر جرس الإشعارات في الرأسية.",
  ads: "تحكم في تشغيل وإيقاف مواضع الإعلانات والرعايات داخل التطبيق بشكل مستقل لكل موضع.",
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("analytics");
  const { user, exitAdmin, isSuperAdmin } = useAuth();
  const [, navigate] = useLocation();

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "analytics", label: "الإحصائيات", icon: BarChart3 },
    { id: "users", label: "المستخدمون", icon: Users },
    { id: "announcements", label: "الإعلانات", icon: Megaphone },
    { id: "banners", label: "الشريط العلوي", icon: Bell },
    { id: "welcome", label: "بطاقات الترحيب", icon: Sparkles },
    { id: "tickets", label: "الشكاوى والتذاكر", icon: MessageSquare },
    { id: "pages", label: "الصفحات", icon: Eye },
    { id: "settings", label: "إعدادات النظام", icon: Settings },
    { id: "admins", label: "إدارة المدراء", icon: Shield },
    { id: "audit", label: "سجل التدقيق", icon: FileText },
    { id: "connections", label: "الاتصالات", icon: Network },
    { id: "release-notes", label: "ملاحظات الإصدار", icon: Newspaper },
    { id: "ads", label: "الإعلانات والرعايات", icon: BadgeDollarSign },
  ];
  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const ActiveIcon = activeTabMeta.icon;

  return (
    <div dir="rtl" className="admin-shell min-h-screen bg-background p-3 sm:p-4 lg:p-6">
      <div className="grid min-h-[calc(100vh-1.5rem)] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border-[4px] border-black/90 bg-card p-4 shadow-[10px_10px_0_0_rgba(0,0,0,0.92)] lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto" data-testid="admin-sidebar">
        <div className="nb-admin-hero mb-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-[18px] border-[3px] border-black/90 bg-primary p-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.9)]">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-foreground/55">وضع الإدارة</p>
              <h1 className="text-2xl font-black sm:text-3xl">لوحة التحكم</h1>
            </div>
          </div>
          <p className="text-sm font-bold text-muted-foreground">{user?.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{isSuperAdmin ? "مدير أعلى" : "مدير"}</Badge>
            <Badge variant="outline">مساحة تحكم مباشرة</Badge>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`w-full rounded-[20px] border-[3px] px-4 py-3 text-sm font-black transition-all ${
                activeTab === tab.id
                  ? "border-black/90 bg-primary text-primary-foreground shadow-[5px_5px_0_0_rgba(0,0,0,0.9)]"
                  : "border-black/90 bg-background text-foreground shadow-[4px_4px_0_0_rgba(0,0,0,0.85)] hover:-translate-y-0.5"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className={`rounded-[14px] border-[2px] border-black/85 p-2 ${activeTab === tab.id ? "bg-primary-foreground/15" : "bg-card"}`}>
                  <tab.icon className="h-4 w-4" />
                </span>
                <span className="text-right">{tab.label}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="space-y-2 border-t-[3px] border-black/90 pt-4">
          <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => navigate("/")} data-testid="button-back-app">
            <ChevronLeft className="h-4 w-4" />
            العودة للتطبيق
          </Button>
          <Button variant="destructive" className="w-full justify-start gap-2 text-sm" onClick={() => exitAdmin()} data-testid="button-exit-admin">
            <LogOut className="h-4 w-4" />
            خروج من الإدارة
          </Button>
        </div>
      </aside>

      <main className="min-w-0 overflow-y-auto">
        <section className="nb-hero mb-6">
          <div className="relative z-[1] flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="nb-kicker">مركز القيادة</span>
              <div className="mt-4 flex items-center gap-3">
                <div className="rounded-[18px] border-[3px] border-black/90 bg-background p-3 shadow-[5px_5px_0_0_rgba(0,0,0,0.88)]">
                  <ActiveIcon className="h-6 w-6" />
                </div>
                <h2 className="text-4xl font-black tracking-[-0.08em] sm:text-5xl">{activeTabMeta.label}</h2>
              </div>
              <p className="mt-4 max-w-2xl text-base font-extrabold text-foreground/75 sm:text-lg">
                {tabDescriptions[activeTab]}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border-[3px] border-black/90 bg-background px-4 py-4 shadow-[6px_6px_0_0_rgba(0,0,0,0.88)]">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-foreground/55">الحساب النشط</p>
                <p className="mt-2 text-lg font-black">{user?.name || "الإدارة"}</p>
                <p className="text-sm font-bold text-muted-foreground">{user?.email}</p>
              </div>
              <div className="rounded-[22px] border-[3px] border-black/90 bg-primary px-4 py-4 text-primary-foreground shadow-[6px_6px_0_0_rgba(0,0,0,0.88)]">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-foreground/70">الصلاحية</p>
                <p className="mt-2 text-2xl font-black">{isSuperAdmin ? "مدير أعلى" : "مدير"}</p>
                <p className="text-sm font-extrabold text-primary-foreground/80">تحكم مباشر في إعدادات النظام.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {activeTab === "analytics" && <AnalyticsPanel />}
          {activeTab === "users" && <UsersPanel />}
          {activeTab === "announcements" && <AnnouncementsPanel />}
          {activeTab === "banners" && <BannersPanel />}
          {activeTab === "welcome" && <WelcomeCardsPanel />}
          {activeTab === "tickets" && <TicketsPanel />}
          {activeTab === "pages" && <PagesPanel />}
          {activeTab === "settings" && <SystemSettingsPanel />}
          {activeTab === "admins" && <AdminsPanel />}
          {activeTab === "audit" && <AuditPanel />}
          {activeTab === "connections" && <ConnectionsPanel />}
          {activeTab === "release-notes" && <ReleaseNotesPanel />}
          {activeTab === "ads" && <AdsPanel />}
        </section>
      </main>
      </div>
    </div>
  );
}

function AnalyticsPanel() {
  const { data, isLoading } = useQuery<{
    totalUsers: number; totalFolders: number; totalSources: number;
    totalContent: number; totalIdeas: number; adminCount: number;
  }>({ queryKey: ["/api/admin/analytics"] });

  if (isLoading) return <PanelLoader />;

  const stats = [
    { label: "المستخدمون", value: data?.totalUsers || 0, color: "text-blue-500" },
    { label: "المجلدات", value: data?.totalFolders || 0, color: "text-green-500" },
    { label: "المصادر", value: data?.totalSources || 0, color: "text-purple-500" },
    { label: "المحتوى", value: data?.totalContent || 0, color: "text-orange-500" },
    { label: "الأفكار", value: data?.totalIdeas || 0, color: "text-pink-500" },
    { label: "المدراء", value: data?.adminCount || 0, color: "text-red-500" },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">الإحصائيات العامة</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card bg-card p-5" data-testid={`stat-${s.label}`}>
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersPanel() {
  const { data: users, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });

  if (isLoading) return <PanelLoader />;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">المستخدمون ({users?.length || 0})</h2>
      <div className="card bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-medium">البريد</th>
                <th className="text-right p-3 font-medium">الاسم</th>
                <th className="text-right p-3 font-medium">الحالة</th>
                <th className="text-right p-3 font-medium">آخر نشاط</th>
                <th className="text-right p-3 font-medium">تسجيل</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u: any) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-user-${u.id}`}>
                  <td className="p-3 font-mono text-xs" dir="ltr">{u.email}</td>
                  <td className="p-3">{u.name || "—"}</td>
                  <td className="p-3">
                    {u.isAdmin ? (
                      <Badge variant="default" className="text-xs">{u.adminRole === "super_admin" ? "مدير أعلى" : "مدير"}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">مستخدم</Badge>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString("ar-SA") : "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString("ar-SA")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AnnouncementsPanel() {
  const { toast } = useToast();
  const { data: announcements, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/announcements"] });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", body: "", imageUrl: "", icon: "", isActive: true, maxViews: 1 });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/announcements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      resetForm();
      toast({ title: "تم إنشاء الإعلان" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/admin/announcements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      resetForm();
      toast({ title: "تم تعديل الإعلان" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
      toast({ title: "تم حذف الإعلان" });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ title: "", body: "", imageUrl: "", icon: "", isActive: true, maxViews: 1 });
  };

  const startEdit = (a: any) => {
    setEditId(a.id);
    setForm({ title: a.title, body: a.body, imageUrl: a.imageUrl || "", icon: a.icon || "", isActive: a.isActive, maxViews: a.maxViews });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.title || !form.body) return;
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  if (isLoading) return <PanelLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">الإعلانات ({announcements?.length || 0})</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-new-announcement">
          <Plus className="h-4 w-4 ml-2" /> إعلان جديد
        </Button>
      </div>

      {showForm && (
        <div className="card bg-card p-4 mb-4 space-y-3">
          <Input placeholder="عنوان الإعلان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-announcement-title" />
          <Textarea placeholder="نص الإعلان" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} data-testid="input-announcement-body" />
          <Input placeholder="رابط الصورة (اختياري)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} dir="ltr" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm">نشط</label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">الحد الأقصى للمشاهدات</label>
              <Input type="number" value={form.maxViews} onChange={(e) => setForm({ ...form, maxViews: parseInt(e.target.value) || 1 })} className="w-20" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-announcement">
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
              {editId ? "تعديل" : "إنشاء"}
            </Button>
            <Button variant="ghost" onClick={resetForm}><X className="h-4 w-4 ml-2" /> إلغاء</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {announcements?.map((a: any) => (
          <div key={a.id} className="card bg-card p-4 flex items-start justify-between" data-testid={`announcement-${a.id}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{a.title}</h3>
                <Badge variant={a.isActive ? "default" : "secondary"} className="text-xs">
                  {a.isActive ? "نشط" : "متوقف"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{a.body}</p>
              <p className="text-xs text-muted-foreground mt-1">الحد: {a.maxViews} مشاهدة</p>
            </div>
            <div className="flex gap-1 mr-3">
              <Button variant="ghost" size="icon" onClick={() => startEdit(a)} data-testid={`edit-announcement-${a.id}`}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(a.id)} data-testid={`delete-announcement-${a.id}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {(!announcements || announcements.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">لا توجد إعلانات بعد</div>
        )}
      </div>
    </div>
  );
}

function BannersPanel() {
  const { toast } = useToast();
  const { data: banners, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/banners"] });
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ text: "", linkUrl: "", linkText: "", bgColor: "#3b82f6", isActive: false });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/banners", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      resetForm();
      toast({ title: "تم إنشاء الشريط" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/admin/banners/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      resetForm();
      toast({ title: "تم تعديل الشريط" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/banners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      toast({ title: "تم حذف الشريط" });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ text: "", linkUrl: "", linkText: "", bgColor: "#3b82f6", isActive: false });
  };

  const startEdit = (b: any) => {
    setEditId(b.id);
    setForm({ text: b.text, linkUrl: b.linkUrl || "", linkText: b.linkText || "", bgColor: b.bgColor || "#3b82f6", isActive: b.isActive });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.text) return;
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  if (isLoading) return <PanelLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">الشريط العلوي ({banners?.length || 0})</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-new-banner">
          <Plus className="h-4 w-4 ml-2" /> شريط جديد
        </Button>
      </div>

      {showForm && (
        <div className="card bg-card p-4 mb-4 space-y-3">
          <Input placeholder="نص الشريط" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} data-testid="input-banner-text" />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="رابط (اختياري)" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} dir="ltr" />
            <Input placeholder="نص الرابط (اختياري)" value={form.linkText} onChange={(e) => setForm({ ...form, linkText: e.target.value })} />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm">لون الخلفية</label>
              <Input type="color" value={form.bgColor} onChange={(e) => setForm({ ...form, bgColor: e.target.value })} className="w-14 h-9 p-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm">نشط</label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-banner">
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
              {editId ? "تعديل" : "إنشاء"}
            </Button>
            <Button variant="ghost" onClick={resetForm}><X className="h-4 w-4 ml-2" /> إلغاء</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {banners?.map((b: any) => (
          <div key={b.id} className="card bg-card p-4 flex items-center justify-between" data-testid={`banner-${b.id}`}>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-6 h-6 rounded" style={{ backgroundColor: b.bgColor || "#3b82f6" }} />
              <div>
                <p className="font-medium text-sm">{b.text}</p>
                {b.linkUrl && <p className="text-xs text-muted-foreground" dir="ltr">{b.linkUrl}</p>}
              </div>
              <Badge variant={b.isActive ? "default" : "secondary"} className="text-xs mr-auto">
                {b.isActive ? "نشط" : "متوقف"}
              </Badge>
            </div>
            <div className="flex gap-1 mr-3">
              <Button variant="ghost" size="icon" onClick={() => startEdit(b)}><Edit className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(b.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {(!banners || banners.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">لا توجد أشرطة بعد</div>
        )}
      </div>
    </div>
  );
}

function SystemSettingsPanel() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/system-settings"] });
  const { data: fikriConfig, isLoading: fikriLoading } = useQuery<{
    aiProvider: AdminAIProvider;
    aiApiKey: string;
    aiModel: string;
    searchProvider: "brave" | "perplexity";
    searchApiKey: string;
  }>({ queryKey: ["/api/admin/fikri-config"] });
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showAiKey, setShowAiKey] = useState(false);
  const [showSearchKey, setShowSearchKey] = useState(false);
  const [refreshIntervalMinutes, setRefreshIntervalMinutes] = useState("60");
  const [localFikriConfig, setLocalFikriConfig] = useState({
    aiProvider: "openai" as AdminAIProvider,
    aiApiKey: "",
    aiModel: "gpt-4o-mini",
    searchProvider: "brave" as "brave" | "perplexity",
    searchApiKey: "",
  });

  useEffect(() => {
    if (fikriConfig) {
      setLocalFikriConfig(fikriConfig);
    }
  }, [fikriConfig]);

  useEffect(() => {
    if (settings) {
      const intervalSetting = settings.find((s: any) => s.key === "folder_auto_refresh_interval_minutes");
      if (intervalSetting?.value) {
        setRefreshIntervalMinutes(intervalSetting.value);
      }
    }
  }, [settings]);

  const upsertMutation = useMutation({
    mutationFn: (data: { key: string; value: string; description?: string }) =>
      apiRequest("PUT", "/api/admin/system-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
      setNewKey("");
      setNewValue("");
      setNewDesc("");
      toast({ title: "تم حفظ الإعداد" });
    },
  });

  const saveFikriMutation = useMutation({
    mutationFn: (data: typeof localFikriConfig) => apiRequest("PUT", "/api/admin/fikri-config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fikri-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
      toast({ title: "تم حفظ محرك فكري" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error?.message || "فشل حفظ إعدادات محرك فكري", variant: "destructive" });
    },
  });

  const testFikriAiMutation = useMutation({
    mutationFn: (data: typeof localFikriConfig) => apiRequest("POST", "/api/admin/fikri-config/test-ai", data),
    onSuccess: (data: any) => {
      toast({ title: "نجاح", description: data?.message || "تم اختبار مزود الذكاء الاصطناعي بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: "فشل الاتصال", description: error?.message || "فشل اختبار مزود الذكاء الاصطناعي", variant: "destructive" });
    },
  });

  const testFikriSearchMutation = useMutation({
    mutationFn: (data: typeof localFikriConfig) => apiRequest("POST", "/api/admin/fikri-config/test-search", data),
    onSuccess: (data: any) => {
      toast({ title: "نجاح", description: data?.message || "تم اختبار مزود البحث بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: "فشل الاتصال", description: error?.message || "فشل اختبار مزود البحث", variant: "destructive" });
    },
  });

  if (isLoading || fikriLoading) return <PanelLoader />;

  const knownFlags = [
    { key: "fikri_enabled", desc: "تفعيل فكري" },
    { key: "registration_enabled", desc: "تفعيل التسجيل" },
    { key: "web_search_enabled", desc: "تفعيل البحث" },
    { key: "ai_generation_enabled", desc: "تفعيل توليد المحتوى" },
    { key: "app_version", desc: "رقم إصدار التطبيق" },
  ];
  const hiddenSystemKeys = new Set([
    "default_ai_base_url",
    "default_ai_api_key",
    "default_ai_model",
    "default_ai_mini_model",
    "default_search_api_key",
    "fikri_gateway_config",
    "folder_auto_refresh_interval_minutes",
  ]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">إعدادات النظام</h2>

      <div className="card bg-card p-5 mb-4 space-y-5" data-testid="panel-fikri-gateway">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">محرك فكري</h3>
            <p className="text-sm text-muted-foreground">المسار الافتراضي الذي يستخدمه أي مستخدم يختار "الافتراضي" في إعداداته الشخصية.</p>
          </div>
          <Badge variant="outline">بوابة النظام الافتراضية</Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border p-4 bg-muted/20">
            <div className="space-y-1">
              <Label>مزود الذكاء الاصطناعي</Label>
              <Select
                value={localFikriConfig.aiProvider}
                onValueChange={(value: AdminAIProvider) =>
                  setLocalFikriConfig((prev) => ({
                    ...prev,
                    aiProvider: value,
                    // Reset model to the first model of the new provider
                    aiModel: getDefaultModel(ADMIN_MODEL_CATALOG, value),
                  }))
                }
              >
                <SelectTrigger data-testid="select-fikri-ai-provider"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="gemini">Gemini (Google)</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>مفتاح AI API</Label>
              <div className="flex gap-2">
                <Input
                  type={showAiKey ? "text" : "password"}
                  value={localFikriConfig.aiApiKey}
                  onChange={(e) => setLocalFikriConfig((prev) => ({ ...prev, aiApiKey: e.target.value }))}
                  dir="ltr"
                  placeholder="sk-... / gemini-api-key / openrouter-api-key"
                  data-testid="input-fikri-ai-key"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowAiKey((prev) => !prev)} data-testid="button-toggle-fikri-ai-key">
                  {showAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="outline" onClick={() => testFikriAiMutation.mutate(localFikriConfig)} disabled={testFikriAiMutation.isPending} className="gap-2 shrink-0" data-testid="button-test-fikri-ai">
                  {testFikriAiMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  فحص الاتصال
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>النموذج</Label>
              <Select
                value={
                  ADMIN_MODEL_CATALOG[localFikriConfig.aiProvider]?.some(
                    (m) => m.id === localFikriConfig.aiModel
                  )
                    ? localFikriConfig.aiModel
                    : getDefaultModel(ADMIN_MODEL_CATALOG, localFikriConfig.aiProvider)
                }
                onValueChange={(value) =>
                  setLocalFikriConfig((prev) => ({ ...prev, aiModel: value }))
                }
                data-testid="select-fikri-ai-model"
              >
                <SelectTrigger><SelectValue placeholder="اختر نموذجاً…" /></SelectTrigger>
                <SelectContent>
                  {(ADMIN_MODEL_CATALOG[localFikriConfig.aiProvider] ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {localFikriConfig.aiModel}
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border p-4 bg-muted/20">
            <div className="space-y-1">
              <Label>مزود البحث</Label>
              <Select value={localFikriConfig.searchProvider} onValueChange={(value: "brave" | "perplexity") => setLocalFikriConfig((prev) => ({ ...prev, searchProvider: value }))}>
                <SelectTrigger data-testid="select-fikri-search-provider"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="brave">Brave</SelectItem>
                  <SelectItem value="perplexity">Perplexity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>مفتاح Search API</Label>
              <div className="flex gap-2">
                <Input
                  type={showSearchKey ? "text" : "password"}
                  value={localFikriConfig.searchApiKey}
                  onChange={(e) => setLocalFikriConfig((prev) => ({ ...prev, searchApiKey: e.target.value }))}
                  dir="ltr"
                  placeholder="Brave أو Perplexity API key"
                  data-testid="input-fikri-search-key"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowSearchKey((prev) => !prev)} data-testid="button-toggle-fikri-search-key">
                  {showSearchKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="outline" onClick={() => testFikriSearchMutation.mutate(localFikriConfig)} disabled={testFikriSearchMutation.isPending} className="gap-2 shrink-0" data-testid="button-test-fikri-search">
                  {testFikriSearchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  فحص الاتصال
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
              أي مستخدم يختار <span className="font-semibold text-foreground">الافتراضي</span> في إعداداته سيستخدم هذه المفاتيح تلقائياً.
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => saveFikriMutation.mutate(localFikriConfig)} disabled={saveFikriMutation.isPending} className="gap-2" data-testid="button-save-fikri-config">
            {saveFikriMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ محرك فكري
          </Button>
        </div>
      </div>

      <div className="card bg-card p-5 mb-4 space-y-4" data-testid="panel-refresh-interval">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold">التحديث التلقائي العالمي للمجلدات</h3>
          <p className="text-sm text-muted-foreground">الفترة الافتراضية (بالدقائق) لجلب الأخبار تلقائياً لأي مجلد لا يملك فترة تحديث مخصصة.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min="5"
            max="1440"
            className="w-32"
            dir="ltr"
            value={refreshIntervalMinutes}
            onChange={(e) => setRefreshIntervalMinutes(e.target.value)}
            data-testid="input-refresh-interval"
          />
          <span className="text-sm text-muted-foreground">دقيقة (القيمة الافتراضية: 60)</span>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={upsertMutation.isPending}
            onClick={() => {
              const val = parseInt(refreshIntervalMinutes, 10);
              if (isNaN(val) || val < 5) return;
              upsertMutation.mutate({
                key: "folder_auto_refresh_interval_minutes",
                value: String(val),
                description: "فترة التحديث التلقائي الافتراضية للمجلدات (بالدقائق)",
              });
            }}
            data-testid="button-save-refresh-interval"
          >
            <Save className="h-4 w-4" />
            حفظ
          </Button>
        </div>
      </div>

      <div className="card bg-card p-4 mb-4 space-y-3">
        <h3 className="font-medium text-sm mb-2">إضافة/تعديل إعداد</h3>
        <div className="grid grid-cols-3 gap-3">
          <Input placeholder="المفتاح" value={newKey} onChange={(e) => setNewKey(e.target.value)} dir="ltr" data-testid="input-setting-key" />
          <Input placeholder="القيمة" value={newValue} onChange={(e) => setNewValue(e.target.value)} dir="ltr" data-testid="input-setting-value" />
          <Input placeholder="الوصف (اختياري)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
        </div>
        <Button
          onClick={() => upsertMutation.mutate({ key: newKey, value: newValue, description: newDesc || undefined })}
          disabled={!newKey || upsertMutation.isPending}
          data-testid="button-save-setting"
        >
          <Save className="h-4 w-4 ml-2" /> حفظ
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium text-sm mb-2">الإعدادات الحالية</h3>
        {knownFlags.map((flag) => {
          const setting = settings?.find((s: any) => s.key === flag.key);
          const isBool = !flag.key.includes("key") && !flag.key.includes("version");
          return (
            <div key={flag.key} className="card bg-card p-3 flex items-center justify-between" data-testid={`setting-${flag.key}`}>
              <div>
                <p className="text-sm font-medium">{flag.desc}</p>
                <p className="text-xs text-muted-foreground font-mono" dir="ltr">{flag.key}</p>
              </div>
              {isBool ? (
                <Switch
                  checked={setting?.value !== "false"}
                  onCheckedChange={(v) => upsertMutation.mutate({ key: flag.key, value: v ? "true" : "false", description: flag.desc })}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    className="w-48 text-xs"
                    dir="ltr"
                    defaultValue={setting?.value || ""}
                    onBlur={(e) => {
                      if (e.target.value !== (setting?.value || "")) {
                        upsertMutation.mutate({ key: flag.key, value: e.target.value, description: flag.desc });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {settings?.filter((s: any) => !knownFlags.some((f) => f.key === s.key) && !hiddenSystemKeys.has(s.key)).map((s: any) => (
          <div key={s.key} className="card bg-card p-3 flex items-center justify-between" data-testid={`setting-${s.key}`}>
            <div>
              <p className="text-sm font-medium">{s.description || s.key}</p>
              <p className="text-xs text-muted-foreground font-mono" dir="ltr">{s.key}</p>
            </div>
            <p className="text-sm font-mono" dir="ltr">{s.value || "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const ARABIC_FONTS = [
  { label: "Tajawal (افتراضي)", value: "Tajawal" },
  { label: "Cairo", value: "Cairo" },
  { label: "Noto Sans Arabic", value: "Noto Sans Arabic" },
  { label: "Almarai", value: "Almarai" },
  { label: "Rubik", value: "Rubik" },
  { label: "IBM Plex Arabic", value: "IBM Plex Arabic" },
];

function PagesPanel() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<LoginPageContent>({
    queryKey: ["/api/admin/page-content/login"],
  });
  const { data: landingData, isLoading: isLandingLoading } = useQuery<LandingPageContent>({
    queryKey: ["/api/admin/page-content/landing"],
  });
  const [selectedPage, setSelectedPage] = useState<"login" | "landing">("login");
  const [form, setForm] = useState<LoginPageContent>(defaultLoginPageContent);
  const [landingForm, setLandingForm] = useState<LandingPageContent>(defaultLandingPageContent);
  const [fontFamily, setFontFamily] = useState("Tajawal");
  const [fontSource, setFontSource] = useState<string | null>(null);
  const { data: systemSettings } = useQuery<any[]>({ queryKey: ["/api/admin/system-settings"] });

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

  useEffect(() => {
    if (landingData) {
      setLandingForm(landingData);
    }
  }, [landingData]);

  useEffect(() => {
    if (!systemSettings) return;
    const savedFamily = systemSettings.find((s) => s.key === "site_font_family")?.value;
    const savedSource = systemSettings.find((s) => s.key === "site_font_source")?.value;
    if (savedFamily) setFontFamily(savedFamily);
    setFontSource(savedSource || null);
  }, [systemSettings]);

  // Dynamically load Google Font for the live preview when a predefined font is chosen
  useEffect(() => {
    if (fontSource) return; // custom font — no Google Fonts link needed
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;700;900&display=swap`;
    const existing = document.querySelector("link[data-font-preview]");
    if (existing) {
      existing.setAttribute("href", url);
    } else {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.setAttribute("data-font-preview", "1");
      document.head.appendChild(link);
    }
  }, [fontFamily, fontSource]);

  const updateHighlights = (section: "login" | "verify", index: number, value: string) => {
    setForm((prev) => {
      const next = [...prev[section].highlights];
      while (next.length <= index) {
        next.push("");
      }
      next[index] = value;
      return {
        ...prev,
        [section]: {
          ...prev[section],
          highlights: next,
        },
      };
    });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: LoginPageContent) => apiRequest("PUT", "/api/admin/page-content/login", parseLoginPageContent(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/page-content/login"] });
      queryClient.invalidateQueries({ queryKey: ["/api/page-content/login"] });
      toast({ title: "تم حفظ محتوى الصفحة" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error?.message || "فشل حفظ محتوى الصفحة", variant: "destructive" });
    },
  });

  const saveLandingMutation = useMutation({
    mutationFn: (payload: LandingPageContent) => apiRequest("PUT", "/api/admin/page-content/landing", parseLandingPageContent(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/page-content/landing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/page-content/landing"] });
      toast({ title: "تم حفظ محتوى صفحة الهبوط" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error?.message || "فشل حفظ محتوى صفحة الهبوط", variant: "destructive" });
    },
  });

  const saveFontMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/admin/system-settings", {
        key: "site_font_family",
        value: fontFamily,
        description: "الخط المعتمد للموقع بالكامل",
      });
      await apiRequest("PUT", "/api/admin/system-settings", {
        key: "site_font_source",
        value: fontSource,
        description: "مصدر ملف الخط المخصص (data URL)",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings/public-branding"] });
      toast({ title: "تم حفظ إعدادات الخط", description: "سيتم تطبيق الخط على جميع المستخدمين مباشرة." });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error?.message || "فشل حفظ إعدادات الخط", variant: "destructive" });
    },
  });

  const handleFontUpload = async (file: File | null) => {
    if (!file) return;
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) {
      toast({ title: "صيغة غير مدعومة", description: "الملفات المدعومة: woff, woff2, ttf, otf", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFontSource(typeof reader.result === "string" ? reader.result : null);
      setFontFamily(file.name.replace(/\.(woff2?|ttf|otf)$/i, ""));
      toast({ title: "تم رفع الخط", description: "لا تنسَ الضغط على حفظ إعدادات الخط." });
    };
    reader.readAsDataURL(file);
  };

  if (isLoading || isLandingLoading) return <PanelLoader />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="card bg-card p-4 space-y-2">
          <h2 className="mb-4 text-xl font-bold">صفحات التطبيق</h2>
          <button
            type="button"
            onClick={() => setSelectedPage("login")}
            className={`w-full rounded-[20px] border-[3px] px-4 py-4 text-right transition-all ${
              selectedPage === "login"
                ? "border-border bg-primary text-primary-foreground shadow-[5px_5px_0_0_rgba(0,0,0,0.88)]"
                : "border-border bg-background text-foreground shadow-[4px_4px_0_0_rgba(0,0,0,0.82)]"
            }`}
            data-testid="admin-page-login"
          >
            <span className="block text-sm font-black">صفحة تسجيل الدخول</span>
            <span className={`mt-1 block text-xs ${selectedPage === "login" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              تعديل محتوى شاشة الدخول والتحقق
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedPage("landing")}
            className={`w-full rounded-[20px] border-[3px] px-4 py-4 text-right transition-all ${
              selectedPage === "landing"
                ? "border-border bg-primary text-primary-foreground shadow-[5px_5px_0_0_rgba(0,0,0,0.88)]"
                : "border-border bg-background text-foreground shadow-[4px_4px_0_0_rgba(0,0,0,0.82)]"
            }`}
            data-testid="admin-page-landing"
          >
            <span className="block text-sm font-black">صفحة الهبوط</span>
            <span className={`mt-1 block text-xs ${selectedPage === "landing" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              الصفحة العامة لمحركات البحث وزوار الموقع
            </span>
          </button>
        </aside>

        <div className="space-y-4">
          {/* ── Landing Page Editor ── */}
          {selectedPage === "landing" && (
            <div className="space-y-4">
              {/* Hero Section */}
              <div className="card bg-card p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black">قسم الهيرو</h3>
                    <p className="text-sm text-muted-foreground">العنوان الرئيسي والوصف الظاهر أعلى الصفحة للزوار الجدد.</p>
                  </div>
                  <Button onClick={() => saveLandingMutation.mutate(landingForm)} disabled={saveLandingMutation.isPending} data-testid="button-save-landing">
                    {saveLandingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                    حفظ جميع التعديلات
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>الشريط العلوي (Eyebrow)</Label>
                    <Input
                      value={landingForm.hero.eyebrow}
                      onChange={(e) => setLandingForm((p) => ({ ...p, hero: { ...p.hero, eyebrow: e.target.value } }))}
                      placeholder="مثال: منصة نَسَق"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>نص زر الدعوة للعمل (CTA)</Label>
                    <Input
                      value={landingForm.hero.ctaText}
                      onChange={(e) => setLandingForm((p) => ({ ...p, hero: { ...p.hero, ctaText: e.target.value } }))}
                      placeholder="مثال: ابدأ الآن"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>العنوان الرئيسي</Label>
                    <Input
                      value={landingForm.hero.title}
                      onChange={(e) => setLandingForm((p) => ({ ...p, hero: { ...p.hero, title: e.target.value } }))}
                      placeholder="عنوان قوي وجذاب للصفحة"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>الوصف التفصيلي</Label>
                    <Textarea
                      value={landingForm.hero.subtitle}
                      onChange={(e) => setLandingForm((p) => ({ ...p, hero: { ...p.hero, subtitle: e.target.value } }))}
                      className="min-h-[100px]"
                      placeholder="وصف مختصر وجذاب للمنصة يظهر أسفل العنوان الرئيسي"
                    />
                  </div>
                </div>
              </div>

              {/* About Section */}
              <div className="card bg-card p-5">
                <h3 className="mb-4 text-lg font-black">قسم التعريف</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>عنوان القسم</Label>
                    <Input
                      value={landingForm.about.title}
                      onChange={(e) => setLandingForm((p) => ({ ...p, about: { ...p.about, title: e.target.value } }))}
                      placeholder="مثال: ما هي نَسَق؟"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>النص التفصيلي</Label>
                    <Textarea
                      value={landingForm.about.body}
                      onChange={(e) => setLandingForm((p) => ({ ...p, about: { ...p.about, body: e.target.value } }))}
                      className="min-h-[130px]"
                      placeholder="اكتب وصفاً تفصيلياً للمنصة يستهدف المستخدم العربي الجديد"
                    />
                  </div>
                </div>
              </div>

              {/* Features Section */}
              <div className="card bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black">قسم المميزات</h3>
                    <p className="text-sm text-muted-foreground">تُعرض كبطاقات في قسم المميزات. الحد الأقصى 6 بطاقات.</p>
                  </div>
                  {landingForm.features.length < 6 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLandingForm((p) => ({
                        ...p,
                        features: [...p.features, { emoji: "✨", title: "", description: "", imageUrl: "" }],
                      }))}
                    >
                      <Plus className="h-4 w-4 ml-1" />
                      إضافة ميزة
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  {landingForm.features.map((feature, idx) => (
                    <div key={idx} className="rounded-[16px] border-[2px] border-border p-4 shadow-[3px_3px_0_0_rgba(0,0,0,0.75)] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-muted-foreground">ميزة {idx + 1}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLandingForm((p) => ({
                            ...p,
                            features: p.features.filter((_, i) => i !== idx),
                          }))}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[80px_1fr_2fr]">
                        <div className="space-y-1">
                          <Label className="text-xs">الإيموجي</Label>
                          <Input
                            value={feature.emoji}
                            maxLength={4}
                            onChange={(e) => setLandingForm((p) => {
                              const next = [...p.features];
                              next[idx] = { ...next[idx], emoji: e.target.value };
                              return { ...p, features: next };
                            })}
                            className="text-center text-xl"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">العنوان</Label>
                          <Input
                            value={feature.title}
                            onChange={(e) => setLandingForm((p) => {
                              const next = [...p.features];
                              next[idx] = { ...next[idx], title: e.target.value };
                              return { ...p, features: next };
                            })}
                            placeholder="اسم الميزة"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">الوصف</Label>
                          <Input
                            value={feature.description}
                            onChange={(e) => setLandingForm((p) => {
                              const next = [...p.features];
                              next[idx] = { ...next[idx], description: e.target.value };
                              return { ...p, features: next };
                            })}
                            placeholder="وصف قصير للميزة"
                          />
                        </div>
                      </div>
                      <div className="space-y-1 mt-3">
                        <Label className="text-xs">🖼️ رابط الصورة</Label>
                        <Input
                          value={feature.imageUrl ?? ""}
                          onChange={(e) => setLandingForm((p) => {
                            const next = [...p.features];
                            next[idx] = { ...next[idx], imageUrl: e.target.value };
                            return { ...p, features: next };
                          })}
                          placeholder="https://images.unsplash.com/..."
                          dir="ltr"
                          className="text-xs font-mono"
                        />
                        {feature.imageUrl?.trim() && (
                          <img
                            src={feature.imageUrl}
                            alt="معاينة"
                            className="mt-2 w-full max-h-28 object-cover rounded-[12px] border-2 border-border"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  {landingForm.features.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">لا توجد مميزات بعد. اضغط "إضافة ميزة" للبدء.</p>
                  )}
                </div>
              </div>

              {/* SEO Section */}
              <div className="card bg-card p-5">
                <h3 className="mb-4 text-lg font-black">إعدادات SEO</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>عنوان الصفحة (Meta Title)</Label>
                    <Input
                      value={landingForm.seo.metaTitle}
                      onChange={(e) => setLandingForm((p) => ({ ...p, seo: { ...p.seo, metaTitle: e.target.value } }))}
                      placeholder="يظهر في نتائج جوجل — 50-80 حرف"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>وصف الصفحة (Meta Description)</Label>
                    <Textarea
                      value={landingForm.seo.metaDescription}
                      onChange={(e) => setLandingForm((p) => ({ ...p, seo: { ...p.seo, metaDescription: e.target.value } }))}
                      className="min-h-[80px]"
                      placeholder="يظهر أسفل العنوان في نتائج البحث — 120-300 حرف"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={() => saveLandingMutation.mutate(landingForm)} disabled={saveLandingMutation.isPending}>
                    {saveLandingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                    حفظ جميع التعديلات
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Login / Font Management Cards ── */}
          {selectedPage === "login" && (
          <>
          <div className="card bg-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-[14px] border-[2px] border-black/85 bg-card p-2 shadow-[3px_3px_0_0_rgba(0,0,0,0.85)]">
                <Type className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-lg font-black">خط الموقع</h3>
                <p className="text-sm text-muted-foreground">يُطبَّق على جميع المستخدمين فوراً عند الحفظ.</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Predefined Arabic Google Fonts */}
              <div className="space-y-2">
                <Label>اختر خطاً مدمجاً</Label>
                <Select
                  value={ARABIC_FONTS.some((f) => f.value === fontFamily) ? fontFamily : "Tajawal"}
                  onValueChange={(v) => { setFontFamily(v); setFontSource(null); }}
                >
                  <SelectTrigger data-testid="select-font-family">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARABIC_FONTS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom font upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5" />
                  أو ارفع خطاً مخصصاً (.woff, .woff2, .ttf, .otf)
                </Label>
                <Input
                  type="file"
                  accept=".woff,.woff2,.ttf,.otf"
                  onChange={(e) => handleFontUpload(e.target.files?.[0] ?? null)}
                  data-testid="input-font-upload"
                />
                {fontSource && (
                  <p className="text-xs font-bold text-green-600 dark:text-green-400">
                    ✓ خط مخصص محمّل: {fontFamily}
                  </p>
                )}
              </div>

              {/* Live preview */}
              <div className="rounded-xl border-2 border-dashed border-border p-4 text-center" data-testid="font-preview">
                <p
                  style={{
                    fontFamily: fontSource ? `"${fontFamily}", sans-serif` : `${fontFamily}, sans-serif`,
                    fontSize: "1.25rem",
                    lineHeight: 1.6,
                  }}
                >
                  مرحباً بك في نَسَق — The quick brown fox
                </p>
                <p className="mt-1 text-xs text-muted-foreground">معاينة مباشرة: {fontFamily}</p>
              </div>

              <Button
                onClick={() => saveFontMutation.mutate()}
                disabled={saveFontMutation.isPending}
                data-testid="button-save-font"
              >
                {saveFontMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  : <Save className="h-4 w-4 ml-2" />}
                حفظ إعدادات الخط
              </Button>
            </div>
          </div>

          {/* ── Login Page Content Card ── */}
          <div className="card bg-card p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black">شاشة الدخول</h3>
                <p className="text-sm text-muted-foreground">النصوص والبطاقات الظاهرة في صفحة تسجيل الدخول.</p>
              </div>
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                data-testid="button-save-login-page-content"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                حفظ التعديلات
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>شريط أعلى البطاقة</Label>
                <Input value={form.login.eyebrow} onChange={(e) => setForm((prev) => ({ ...prev, login: { ...prev.login, eyebrow: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>عنوان الجانب البصري</Label>
                <Input value={form.login.title} onChange={(e) => setForm((prev) => ({ ...prev, login: { ...prev.login, title: e.target.value } }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>وصف الجانب البصري</Label>
                <Textarea value={form.login.description} onChange={(e) => setForm((prev) => ({ ...prev, login: { ...prev.login, description: e.target.value } }))} className="min-h-[110px]" />
              </div>
              <div className="space-y-2">
                <Label>عنوان نموذج الدخول</Label>
                <Input value={form.login.panelTitle} onChange={(e) => setForm((prev) => ({ ...prev, login: { ...prev.login, panelTitle: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>وصف نموذج الدخول</Label>
                <Input value={form.login.panelDescription} onChange={(e) => setForm((prev) => ({ ...prev, login: { ...prev.login, panelDescription: e.target.value } }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>الملاحظة السفلية</Label>
                <Input value={form.login.footerNote} onChange={(e) => setForm((prev) => ({ ...prev, login: { ...prev.login, footerNote: e.target.value } }))} />
              </div>
              {[0, 1, 2].map((index) => (
                <div key={`login-highlight-${index}`} className="space-y-2">
                  <Label>{`بطاقة ${index + 1}`}</Label>
                  <Input
                    value={form.login.highlights[index] || ""}
                    onChange={(e) => updateHighlights("login", index, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="card bg-card p-5">
            <h3 className="mb-4 text-lg font-black">شاشة التحقق</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>شريط أعلى البطاقة</Label>
                <Input value={form.verify.eyebrow} onChange={(e) => setForm((prev) => ({ ...prev, verify: { ...prev.verify, eyebrow: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>عنوان الجانب البصري</Label>
                <Input value={form.verify.title} onChange={(e) => setForm((prev) => ({ ...prev, verify: { ...prev.verify, title: e.target.value } }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>وصف الجانب البصري</Label>
                <Textarea value={form.verify.description} onChange={(e) => setForm((prev) => ({ ...prev, verify: { ...prev.verify, description: e.target.value } }))} className="min-h-[110px]" />
              </div>
              <div className="space-y-2">
                <Label>عنوان نموذج التحقق</Label>
                <Input value={form.verify.panelTitle} onChange={(e) => setForm((prev) => ({ ...prev, verify: { ...prev.verify, panelTitle: e.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label>وصف نموذج التحقق</Label>
                <Input value={form.verify.panelDescription} onChange={(e) => setForm((prev) => ({ ...prev, verify: { ...prev.verify, panelDescription: e.target.value } }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>ملاحظة أسفل نموذج التحقق</Label>
                <Input value={form.verify.footerNote} onChange={(e) => setForm((prev) => ({ ...prev, verify: { ...prev.verify, footerNote: e.target.value } }))} />
              </div>
              {[0, 1, 2].map((index) => (
                <div key={`verify-highlight-${index}`} className="space-y-2">
                  <Label>{`بطاقة ${index + 1}`}</Label>
                  <Input
                    value={form.verify.highlights[index] || ""}
                    onChange={(e) => updateHighlights("verify", index, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="card bg-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black">خط الموقع</h3>
                <p className="text-sm text-muted-foreground">اختر خطاً افتراضياً أو ارفع خطاً مخصصاً ليتم تطبيقه على الجميع.</p>
              </div>
              <Button onClick={() => saveFontMutation.mutate()} disabled={saveFontMutation.isPending} data-testid="button-save-site-font">
                {saveFontMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                حفظ إعدادات الخط
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>الخط الافتراضي</Label>
                <Select value={fontFamily} onValueChange={(v) => { setFontFamily(v); setFontSource(null); }}>
                  <SelectTrigger data-testid="select-site-font-family"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tajawal">Tajawal</SelectItem>
                    <SelectItem value="Cairo">Cairo</SelectItem>
                    <SelectItem value="Inter">Inter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>رفع خط مخصص</Label>
                <Input type="file" accept=".woff,.woff2,.ttf,.otf" onChange={(e) => handleFontUpload(e.target.files?.[0] || null)} data-testid="input-upload-site-font" />
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs text-muted-foreground mb-2">معاينة</p>
              <p
                className="text-base"
                style={{ fontFamily: `"${fontFamily}", Tajawal, sans-serif` }}
              >
                الخط الحالي: <span className="font-black">{fontFamily}</span> — هذا نص تجريبي لعرض شكل الخط قبل الحفظ.
              </p>
              {fontSource && <p className="mt-2 text-xs text-emerald-600 font-bold">تم تحميل خط مخصص من جهازك وهو جاهز للحفظ.</p>}
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminsPanel() {
  const { toast } = useToast();
  const { user: currentUser, isSuperAdmin } = useAuth();
  const { data: admins, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/admins"] });
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [changePasswordId, setChangePasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/admins", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      setShowAdd(false);
      setAddEmail("");
      setAddPassword("");
      toast({ title: "تمت إضافة المدير" });
    },
    onError: (e: any) => {
      let msg = "فشل إضافة المدير";
      try { msg = JSON.parse(e.message.slice(e.message.indexOf("{"))).error || msg; } catch {}
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/admins/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({ title: "تمت إزالة المدير" });
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: (data: { targetUserId: string; newPassword: string }) =>
      apiRequest("POST", "/api/admin/set-password", data),
    onSuccess: () => {
      setChangePasswordId(null);
      setNewPassword("");
      toast({ title: "تم تغيير كلمة المرور" });
    },
  });

  if (isLoading) return <PanelLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">إدارة المدراء ({admins?.length || 0})</h2>
        {isSuperAdmin && (
          <Button onClick={() => setShowAdd(true)} data-testid="button-add-admin">
            <Plus className="h-4 w-4 ml-2" /> إضافة مدير
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="card bg-card p-4 mb-4 space-y-3">
          <Input placeholder="البريد الإلكتروني للمستخدم" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} dir="ltr" data-testid="input-admin-email" />
          <Input type="password" placeholder="كلمة مرور المدير (6 أحرف+)" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} dir="ltr" data-testid="input-admin-new-password" />
          <div className="flex gap-2">
            <Button onClick={() => addMutation.mutate({ email: addEmail, role: "admin", password: addPassword })} disabled={!addEmail || addMutation.isPending} data-testid="button-confirm-add-admin">
              <Plus className="h-4 w-4 ml-2" /> إضافة
            </Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>إلغاء</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {admins?.map((a: any) => (
          <div key={a.id} className="card bg-card p-4 flex items-center justify-between" data-testid={`admin-${a.id}`}>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{a.name || a.email}</p>
                <Badge variant={a.adminRole === "super_admin" ? "default" : "outline"} className="text-xs">
                  {a.adminRole === "super_admin" ? "مدير أعلى" : "مدير"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono" dir="ltr">{a.email}</p>
            </div>
            {isSuperAdmin && a.id !== currentUser?.id && (
              <div className="flex gap-1">
                {changePasswordId === a.id ? (
                  <div className="flex gap-2">
                    <Input type="password" placeholder="كلمة مرور جديدة" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-40" dir="ltr" />
                    <Button size="sm" onClick={() => setPasswordMutation.mutate({ targetUserId: a.id, newPassword })} disabled={newPassword.length < 6}>
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setChangePasswordId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setChangePasswordId(a.id)}>
                      <Lock className="h-4 w-4 ml-1" /> كلمة المرور
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeMutation.mutate(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {isSuperAdmin && (
        <div className="card bg-card p-4 mt-6 space-y-3">
          <h3 className="font-medium">تغيير كلمة المرور الخاصة بك</h3>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="كلمة مرور جديدة (6 أحرف+)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1"
              dir="ltr"
              data-testid="input-own-password"
            />
            <Button
              onClick={() => setPasswordMutation.mutate({ targetUserId: currentUser!.id, newPassword })}
              disabled={newPassword.length < 6 || setPasswordMutation.isPending}
              data-testid="button-change-own-password"
            >
              <Save className="h-4 w-4 ml-2" /> تغيير
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditPanel() {
  const { data: logs, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/audit-logs"] });

  if (isLoading) return <PanelLoader />;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">سجل التدقيق</h2>
      <div className="card bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-right p-3 font-medium">الإجراء</th>
                <th className="text-right p-3 font-medium">التفاصيل</th>
                <th className="text-right p-3 font-medium">المستخدم</th>
                <th className="text-right p-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {logs?.map((log: any) => (
                <tr key={log.id} className="border-b last:border-0" data-testid={`audit-${log.id}`}>
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs font-mono">{log.action}</Badge>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{log.details || "—"}</td>
                  <td className="p-3 text-xs font-mono" dir="ltr">{log.userId}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("ar-SA")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!logs || logs.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">لا توجد سجلات بعد</div>
        )}
      </div>
    </div>
  );
}

function WelcomeCardsPanel() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ sortOrder: 0, title: "", body: "", emoji: "", showUserName: false, isFinal: false, isActive: true });

  type WCard = {
    id: string; sortOrder: number; title: string; body: string; emoji: string | null;
    showUserName: boolean; isFinal: boolean; isActive: boolean; createdAt: string;
  };

  const { data, isLoading } = useQuery<{ cards: WCard[]; displayMode: string }>({ queryKey: ["/api/admin/welcome-cards"] });

  const createMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/welcome-cards", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/welcome-cards"] });
      setShowAdd(false);
      setForm({ sortOrder: 0, title: "", body: "", emoji: "", showUserName: false, isFinal: false, isActive: true });
      toast({ title: "تم", description: "تم إنشاء البطاقة" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: any }) => apiRequest("PUT", "/api/admin/welcome-cards/" + id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/welcome-cards"] });
      setEditingId(null);
      toast({ title: "تم", description: "تم تعديل البطاقة" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", "/api/admin/welcome-cards/" + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/welcome-cards"] });
      toast({ title: "تم", description: "تم حذف البطاقة" });
    },
  });

  const modeMutation = useMutation({
    mutationFn: async (mode: string) => apiRequest("PUT", "/api/admin/welcome-display-mode", { mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/welcome-cards"] });
      toast({ title: "تم", description: "تم تغيير وضع العرض" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/welcome-cards/reset-views"),
    onSuccess: () => toast({ title: "تم", description: "تم إعادة ضبط المشاهدات — ستظهر البطاقات لجميع المستخدمين مجدداً" }),
  });

  if (isLoading) return <PanelLoader />;

  const cards = data?.cards || [];
  const displayMode = data?.displayMode || "once";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">بطاقات الترحيب</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending} className="gap-1" data-testid="button-reset-views">
            <RotateCcw className="h-3 w-3" />
            إعادة ضبط المشاهدات
          </Button>
          <Button size="sm" onClick={() => { setShowAdd(true); setForm({ sortOrder: cards.length + 1, title: "", body: "", emoji: "", showUserName: false, isFinal: false, isActive: true }); }} className="gap-1" data-testid="button-add-welcome-card">
            <Plus className="h-3 w-3" />
            إضافة بطاقة
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-4 mb-4 bg-muted/30 space-y-3">
        <Label className="text-sm font-medium">وضع العرض</Label>
        <div className="flex gap-2">
          {[
            { value: "once", label: "مرة واحدة" },
            { value: "always", label: "دائماً" },
            { value: "disabled", label: "معطّل" },
          ].map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={displayMode === opt.value ? "default" : "outline"}
              onClick={() => modeMutation.mutate(opt.value)}
              data-testid={"button-mode-" + opt.value}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {displayMode === "once" && "تظهر البطاقات مرة واحدة فقط لكل مستخدم"}
          {displayMode === "always" && "تظهر البطاقات في كل مرة يفتح المستخدم الموقع"}
          {displayMode === "disabled" && "البطاقات معطلة ولن تظهر لأحد"}
        </p>
      </div>

      {showAdd && (
        <div className="rounded-lg border p-4 mb-4 space-y-3 bg-primary/5">
          <h3 className="font-medium text-sm">بطاقة جديدة</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">الترتيب</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">إيموجي</Label>
              <Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="mt-1" placeholder="👋" />
            </div>
          </div>
          <div>
            <Label className="text-xs">العنوان</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" data-testid="input-wc-title" />
          </div>
          <div>
            <Label className="text-xs">النص (استخدم {"{name}"} لاسم المستخدم)</Label>
            <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="mt-1 min-h-[80px]" data-testid="input-wc-body" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs"><Switch checked={form.showUserName} onCheckedChange={(v) => setForm({ ...form, showUserName: v })} /> يعرض اسم المستخدم</label>
            <label className="flex items-center gap-2 text-xs"><Switch checked={form.isFinal} onCheckedChange={(v) => setForm({ ...form, isFinal: v })} /> بطاقة ختامية</label>
            <label className="flex items-center gap-2 text-xs"><Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /> مفعّلة</label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.title.trim() || !form.body.trim() || createMutation.isPending} className="gap-1" data-testid="button-save-wc">
              {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} حفظ
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {cards.map((card) => (
          <div key={card.id} className={`rounded-lg border p-4 transition-colors ${card.isActive ? "" : "opacity-50"}`} data-testid={"wc-" + card.id}>
            {editingId === card.id ? (
              <WelcomeCardEditForm
                card={card}
                onSave={(d) => updateMutation.mutate({ id: card.id, data: d })}
                onCancel={() => setEditingId(null)}
                saving={updateMutation.isPending}
              />
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <span className="text-lg font-bold">{card.sortOrder}</span>
                  {card.emoji && <span className="text-2xl">{card.emoji}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{card.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{card.body}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {card.showUserName && <Badge variant="outline" className="text-xs">يعرض الاسم</Badge>}
                    {card.isFinal && <Badge variant="outline" className="text-xs">ختامية</Badge>}
                    {!card.isActive && <Badge variant="destructive" className="text-xs">معطلة</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(card.id)} data-testid={"button-edit-wc-" + card.id}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(card.id)} data-testid={"button-delete-wc-" + card.id}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {cards.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">لا توجد بطاقات ترحيب بعد</div>
        )}
      </div>
    </div>
  );
}

function WelcomeCardEditForm({ card, onSave, onCancel, saving }: { card: any; onSave: (d: any) => void; onCancel: () => void; saving: boolean }) {
  const [f, setF] = useState({
    sortOrder: card.sortOrder,
    title: card.title,
    body: card.body,
    emoji: card.emoji || "",
    showUserName: card.showUserName,
    isFinal: card.isFinal,
    isActive: card.isActive,
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">الترتيب</Label>
          <Input type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: parseInt(e.target.value) || 0 })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">إيموجي</Label>
          <Input value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} className="mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-xs">العنوان</Label>
        <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="mt-1" />
      </div>
      <div>
        <Label className="text-xs">النص</Label>
        <Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="mt-1 min-h-[80px]" />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs"><Switch checked={f.showUserName} onCheckedChange={(v) => setF({ ...f, showUserName: v })} /> يعرض الاسم</label>
        <label className="flex items-center gap-2 text-xs"><Switch checked={f.isFinal} onCheckedChange={(v) => setF({ ...f, isFinal: v })} /> ختامية</label>
        <label className="flex items-center gap-2 text-xs"><Switch checked={f.isActive} onCheckedChange={(v) => setF({ ...f, isActive: v })} /> مفعّلة</label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(f)} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} حفظ
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>إلغاء</Button>
      </div>
    </div>
  );
}

function TicketsPanel() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  type AdminTicket = {
    id: string; userId: string; ticketNumber: number | null; title: string; description: string;
    imageUrls: string[] | null; category: string; status: string; createdAt: string; updatedAt: string;
    userEmail: string; userName: string;
  };
  type Reply = { id: string; ticketId: string; userId: string; message: string; isAdmin: boolean; createdAt: string };

  const { data: tickets, isLoading } = useQuery<AdminTicket[]>({ queryKey: ["/api/admin/tickets"] });
  const { data: detail } = useQuery<{ ticket: AdminTicket; replies: Reply[] }>({
    queryKey: ["/api/admin/tickets", selectedId],
    enabled: !!selectedId,
  });

  const statusMap: Record<string, { label: string; color: string }> = {
    open: { label: "خامل", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    in_progress: { label: "جارٍ العمل عليها", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    resolved: { label: "تم العمل عليها", color: "bg-green-500/20 text-green-400 border-green-500/30" },
    cancelled: { label: "ملغية", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  };

  const categoryMap: Record<string, string> = { complaint: "شكوى", suggestion: "اقتراح" };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/tickets/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets", selectedId] });
      toast({ title: "تم", description: "تم تحديث الحالة" });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/tickets/${selectedId}/reply`, { message: replyText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets", selectedId] });
      setReplyText("");
      toast({ title: "تم", description: "تم إرسال الرد وسيصل إشعار بريدي للمستخدم" });
    },
  });

  if (isLoading) return <PanelLoader />;

  if (selectedId && detail) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} data-testid="button-back-tickets-admin">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-foreground">#{detail.ticket.ticketNumber}</span>
              <h2 className="text-xl font-bold">{detail.ticket.title}</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {categoryMap[detail.ticket.category] || detail.ticket.category}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {detail.ticket.userEmail} — {new Date(detail.ticket.createdAt).toLocaleDateString("ar-SA")}
            </p>
          </div>
          <select
            value={detail.ticket.status}
            onChange={(e) => updateStatusMutation.mutate({ id: detail.ticket.id, status: e.target.value })}
            className="border rounded-lg px-3 py-1.5 text-sm bg-background"
            data-testid="select-ticket-status"
          >
            <option value="open">خامل</option>
            <option value="in_progress">جارٍ العمل عليها</option>
            <option value="resolved">تم العمل عليها</option>
            <option value="cancelled">ملغية</option>
          </select>
        </div>

        <div className="rounded-lg border p-4 bg-muted/30 mb-4">
          <p className="text-sm whitespace-pre-wrap">{detail.ticket.description}</p>
          {detail.ticket.imageUrls && detail.ticket.imageUrls.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {detail.ticket.imageUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`صورة ${i + 1}`} className="w-24 h-24 object-cover rounded border" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
          {detail.replies.map((r) => (
            <div key={r.id} className={`rounded-lg p-3 text-sm ${r.isAdmin ? "bg-primary/10 border border-primary/20 mr-8" : "bg-muted/50 border ml-8"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium ${r.isAdmin ? "text-primary" : "text-muted-foreground"}`}>
                  {r.isAdmin ? "أنت (الإدارة)" : detail.ticket.userEmail}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("ar-SA")}</span>
              </div>
              <p className="whitespace-pre-wrap">{r.message}</p>
            </div>
          ))}
          {detail.replies.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">لا توجد ردود بعد</p>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="اكتب ردك... (سيصل للمستخدم عبر البريد الإلكتروني)"
            className="flex-1 min-h-[80px]"
            data-testid="input-admin-ticket-reply"
          />
          <Button
            onClick={() => replyMutation.mutate()}
            disabled={!replyText.trim() || replyMutation.isPending}
            className="gap-2 self-end"
            data-testid="button-send-admin-reply"
          >
            {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            إرسال
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">الشكاوى والتذاكر</h2>
      {!tickets || tickets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">لا توجد تذاكر بعد</div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedId(t.id)}
              data-testid={`admin-ticket-${t.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground shrink-0">#{t.ticketNumber}</span>
                    <p className="font-medium truncate">{t.title}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {categoryMap[t.category] || t.category}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{t.userEmail}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(t.createdAt).toLocaleDateString("ar-SA")}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap ${statusMap[t.status]?.color || ""}`}>
                  {statusMap[t.status]?.label || t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CONNECTIONS PANEL — client-side, stored in localStorage
// ────────────────────────────────────────────────────────────────────────────

const CONNECTIONS_STORAGE_KEY = "nasaq_admin_connections";

type ConnectionCategory = "Domain" | "DNS" | "Database" | "Custom";

interface Connection {
  id: string;
  name: string;
  category: ConnectionCategory;
  url: string;
  description: string;
  icon: string;
}

const DEFAULT_CONNECTIONS: Connection[] = [
  {
    id: "sahabah-domain",
    name: "Sahabah",
    category: "Domain",
    url: "https://sahabah.com.sa/?lang=ar",
    description: "مزود النطاق الرئيسي للمنصة",
    icon: "🌐",
  },
  {
    id: "cloudflare-dns",
    name: "Cloudflare",
    category: "DNS",
    url: "https://dash.cloudflare.com/fd3e46c097777a2cc0b4fb16efdbe079/home/overview",
    description: "إدارة DNS والتوجيه والحماية من DDoS",
    icon: "☁️",
  },
  {
    id: "neon-database",
    name: "Neon",
    category: "Database",
    url: "https://neon.com/",
    description: "قاعدة بيانات PostgreSQL المدارة",
    icon: "🗄️",
  },
];

const CATEGORY_LABELS: Record<ConnectionCategory, string> = {
  Domain: "نطاق",
  DNS: "DNS",
  Database: "قاعدة بيانات",
  Custom: "مخصص",
};

const CATEGORY_COLORS: Record<ConnectionCategory, string> = {
  Domain:   "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  DNS:      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  Database: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Custom:   "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

function loadConnections(): Connection[] {
  try {
    const stored = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_CONNECTIONS;
}

function saveConnections(connections: Connection[]): void {
  try {
    localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(connections));
  } catch {}
}

const EMPTY_FORM: Omit<Connection, "id"> = {
  name: "",
  category: "Custom",
  url: "",
  description: "",
  icon: "🔗",
};

function ConnectionsPanel() {
  const { toast } = useToast();
  const [connections, setConnections] = useState<Connection[]>(loadConnections);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Connection | null>(null);
  const [form, setForm] = useState<Omit<Connection, "id">>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof Omit<Connection, "id">, string>>>({});

  const persistAndSet = (updated: Connection[]) => {
    setConnections(updated);
    saveConnections(updated);
  };

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (conn: Connection) => {
    setEditTarget(conn);
    setForm({ name: conn.name, category: conn.category, url: conn.url, description: conn.description, icon: conn.icon });
    setFormErrors({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const errors: typeof formErrors = {};
    if (!form.name.trim()) errors.name = "الاسم مطلوب";
    if (!form.url.trim()) {
      errors.url = "الرابط مطلوب";
    } else {
      try { new URL(form.url); } catch { errors.url = "رابط غير صالح — يجب أن يبدأ بـ https://"; }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editTarget) {
      persistAndSet(connections.map(c => c.id === editTarget.id ? { ...form, id: editTarget.id } : c));
      toast({ title: "تم التحديث", description: `تم تحديث الاتصال: ${form.name}` });
    } else {
      const newConn: Connection = { ...form, id: `conn-${Date.now()}` };
      persistAndSet([...connections, newConn]);
      toast({ title: "تمت الإضافة", description: `تمت إضافة الاتصال: ${form.name}` });
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    persistAndSet(connections.filter(c => c.id !== id));
    setDeleteConfirmId(null);
    toast({ title: "تم الحذف", variant: "destructive" });
  };

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">الاتصالات والتكاملات ({connections.length})</h2>
        <Button onClick={openAdd} className="gap-2" data-testid="button-add-connection">
          <Plus className="h-4 w-4" />
          إضافة اتصال
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {connections.map((conn) => (
          <div
            key={conn.id}
            className="card bg-card p-4 space-y-3"
            data-testid={`connection-card-${conn.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl flex-shrink-0" aria-hidden>{conn.icon}</span>
                <div className="min-w-0">
                  <p className="font-bold truncate">{conn.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[conn.category]}`}>
                    {CATEGORY_LABELS[conn.category]}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => openEdit(conn)}
                  data-testid={`button-edit-connection-${conn.id}`}
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setDeleteConfirmId(conn.id)}
                  data-testid={`button-delete-connection-${conn.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {conn.description && (
              <p className="text-sm text-muted-foreground">{conn.description}</p>
            )}

            <a
              href={conn.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              data-testid={`link-connection-${conn.id}`}
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              <span className="truncate" dir="ltr">{conn.url}</span>
            </a>
          </div>
        ))}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "تعديل الاتصال" : "إضافة اتصال جديد"}</DialogTitle>
            <DialogDescription>
              {editTarget ? "عدّل تفاصيل الاتصال أدناه." : "أدخل تفاصيل الاتصال الجديد."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Icon + Name */}
            <div className="flex gap-3">
              <div className="w-20">
                <Label htmlFor="conn-icon">أيقونة</Label>
                <Input
                  id="conn-icon"
                  value={form.icon}
                  onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                  className="mt-1 text-center text-xl"
                  maxLength={4}
                  data-testid="input-connection-icon"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="conn-name">الاسم *</Label>
                <Input
                  id="conn-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="mt-1"
                  placeholder="مثال: Cloudflare"
                  data-testid="input-connection-name"
                />
                {formErrors.name && <p className="text-xs text-destructive mt-1">{formErrors.name}</p>}
              </div>
            </div>

            {/* Category */}
            <div>
              <Label htmlFor="conn-category">الفئة</Label>
              <Select
                value={form.category}
                onValueChange={v => setForm(f => ({ ...f, category: v as ConnectionCategory }))}
              >
                <SelectTrigger id="conn-category" className="mt-1" data-testid="select-connection-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as ConnectionCategory[]).map(cat => (
                    <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* URL */}
            <div>
              <Label htmlFor="conn-url">الرابط *</Label>
              <Input
                id="conn-url"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                className="mt-1"
                placeholder="https://example.com"
                dir="ltr"
                data-testid="input-connection-url"
              />
              {formErrors.url && <p className="text-xs text-destructive mt-1">{formErrors.url}</p>}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="conn-desc">الوصف</Label>
              <Textarea
                id="conn-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="mt-1"
                rows={2}
                placeholder="وصف اختياري للاتصال"
                data-testid="input-connection-description"
              />
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleSave} data-testid="button-save-connection">
              <Save className="h-4 w-4 ml-1" />
              {editTarget ? "حفظ التعديلات" : "إضافة"}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={o => { if (!o) setDeleteConfirmId(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الاتصال</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا الاتصال؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              data-testid="button-confirm-delete-connection"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// RELEASE NOTES PANEL — full-stack CRUD (DB-backed)
// ────────────────────────────────────────────────────────────────────────────

interface ReleaseNoteItem {
  id: string;
  version: string;
  title: string;
  body: string;
  emoji: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = { version: "", title: "", body: "", emoji: "🚀", isPublished: false };

function ReleaseNotesPanel() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ReleaseNoteItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: notes = [], isLoading, refetch } = useQuery<ReleaseNoteItem[]>({
    queryKey: ["/api/admin/release-notes"],
    queryFn: () => apiRequest("GET", "/api/admin/release-notes").then((r) => r.json()),
  });

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setFormErrors({});
    setDialogOpen(true);
  }

  function openEdit(note: ReleaseNoteItem) {
    setEditTarget(note);
    setForm({
      version: note.version,
      title: note.title,
      body: note.body,
      emoji: note.emoji || "🚀",
      isPublished: note.isPublished,
    });
    setFormErrors({});
    setDialogOpen(true);
  }

  function validateForm() {
    const errors: Record<string, string> = {};
    if (!form.version.trim()) errors.version = "رقم الإصدار مطلوب";
    if (!form.title.trim()) errors.title = "العنوان مطلوب";
    if (!form.body.trim()) errors.body = "المحتوى مطلوب";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;
    try {
      if (editTarget) {
        const res = await apiRequest("PATCH", `/api/admin/release-notes/${editTarget.id}`, form);
        if (!res.ok) throw new Error();
        toast({ title: "تم التحديث بنجاح" });
      } else {
        const res = await apiRequest("POST", "/api/admin/release-notes", form);
        if (!res.ok) throw new Error();
        toast({ title: "تم إنشاء الملاحظة بنجاح" });
      }
      setDialogOpen(false);
      refetch();
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await apiRequest("DELETE", `/api/admin/release-notes/${id}`);
      if (!res.ok) throw new Error();
      toast({ title: "تم الحذف بنجاح" });
      setDeleteConfirmId(null);
      refetch();
    } catch {
      toast({ title: "فشل الحذف", variant: "destructive" });
    }
  }

  async function togglePublish(note: ReleaseNoteItem) {
    try {
      const res = await apiRequest("PATCH", `/api/admin/release-notes/${note.id}`, {
        isPublished: !note.isPublished,
      });
      if (!res.ok) throw new Error();
      toast({ title: note.isPublished ? "تم إلغاء النشر" : "تم النشر بنجاح" });
      refetch();
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black">ملاحظات الإصدار</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {notes.length} ملاحظة — {notes.filter((n) => n.isPublished).length} منشورة
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2" data-testid="button-add-release-note">
          <Plus className="h-4 w-4" />
          ملاحظة جديدة
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <PanelLoader />
      ) : notes.length === 0 ? (
        <div className="rounded-[22px] border-[3px] border-dashed border-border p-12 text-center">
          <Newspaper className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-bold text-muted-foreground">لا توجد ملاحظات إصدار بعد</p>
          <p className="text-sm text-muted-foreground/70 mt-1">أنشئ أول ملاحظة لتظهر في جرس الإشعارات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-[20px] border-[3px] border-black/90 bg-card p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.88)] flex items-start gap-4"
              data-testid={`release-note-${note.id}`}
            >
              <div className="text-3xl leading-none mt-0.5">{note.emoji || "🚀"}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-black text-lg leading-tight">{note.title}</span>
                  <Badge variant="outline" className="text-xs font-mono shrink-0">v{note.version}</Badge>
                  {note.isPublished ? (
                    <Badge className="text-xs bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40 shrink-0">منشور</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs shrink-0">مسودة</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{note.body}</p>
                {note.publishedAt && (
                  <p className="text-xs text-muted-foreground/60 mt-1 flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    نُشر {new Date(note.publishedAt).toLocaleDateString("ar-SA")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => togglePublish(note)}
                  data-testid={`button-toggle-publish-${note.id}`}
                  title={note.isPublished ? "إلغاء النشر" : "نشر"}
                >
                  {note.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(note)}
                  data-testid={`button-edit-release-note-${note.id}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteConfirmId(note.id)}
                  data-testid={`button-delete-release-note-${note.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editTarget ? "تعديل ملاحظة الإصدار" : "إنشاء ملاحظة إصدار جديدة"}</DialogTitle>
            <DialogDescription>أدخل تفاصيل الإصدار لتظهر في جرس الإشعارات للمستخدمين.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Emoji + Version row */}
            <div className="flex gap-3">
              <div className="w-24">
                <Label className="text-xs font-bold mb-1 block">الرمز</Label>
                <Input
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  maxLength={4}
                  className="text-center text-xl"
                  data-testid="input-rn-emoji"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs font-bold mb-1 block">رقم الإصدار *</Label>
                <Input
                  dir="ltr"
                  placeholder="2.5.2"
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  data-testid="input-rn-version"
                />
                {formErrors.version && <p className="text-xs text-destructive mt-1">{formErrors.version}</p>}
              </div>
            </div>

            {/* Title */}
            <div>
              <Label className="text-xs font-bold mb-1 block">العنوان *</Label>
              <Input
                placeholder="مثال: تحسينات الأداء وإصلاح الأخطاء"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                data-testid="input-rn-title"
              />
              {formErrors.title && <p className="text-xs text-destructive mt-1">{formErrors.title}</p>}
            </div>

            {/* Body */}
            <div>
              <Label className="text-xs font-bold mb-1 block">المحتوى / التفاصيل *</Label>
              <Textarea
                placeholder={"• إصلاح مشكلة...\n• تحسين..."}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={5}
                data-testid="input-rn-body"
              />
              {formErrors.body && <p className="text-xs text-destructive mt-1">{formErrors.body}</p>}
            </div>

            {/* Publish toggle */}
            <div className="flex items-center gap-3">
              <Switch
                id="rn-publish"
                checked={form.isPublished}
                onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
                data-testid="switch-rn-publish"
              />
              <Label htmlFor="rn-publish" className="text-sm font-semibold cursor-pointer">
                نشر فوراً (سيظهر للمستخدمين في جرس الإشعارات)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} data-testid="button-save-release-note">
              <Save className="h-4 w-4 mr-2" />
              {editTarget ? "حفظ التعديلات" : "إنشاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذه الملاحظة؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              data-testid="button-confirm-delete-release-note"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type AdMode = "placeholder" | "adsense" | "sponsor";

interface AdSlotLocalConfig {
  mode: AdMode;
  adsenseClientId: string;
  adsenseSlotId: string;
  sponsorTitle: string;
  sponsorDesc: string;
  sponsorUrl: string;
  sponsorImageUrl: string;
}

const DEFAULT_SLOT_CONFIG: AdSlotLocalConfig = {
  mode: "placeholder",
  adsenseClientId: "",
  adsenseSlotId: "",
  sponsorTitle: "",
  sponsorDesc: "",
  sponsorUrl: "",
  sponsorImageUrl: "",
};

type AdSlotName = "folder" | "feed" | "fikri";

const AD_SLOT_META: { name: AdSlotName; toggleKey: string; configKey: string; label: string; desc: string; icon: string }[] = [
  {
    name: "folder",
    toggleKey: "ads_folder_enabled",
    configKey: "ad_config_folder",
    label: "إعلان المجلدات",
    desc: "بطاقة إعلانية في شبكة المجلدات على الصفحة الرئيسية.",
    icon: "🗂️",
  },
  {
    name: "feed",
    toggleKey: "ads_feed_enabled",
    configKey: "ad_config_feed",
    label: "إعلانات قائمة الأخبار",
    desc: "بطاقة ذهبية Liquid Glass تُحقن بعد كل 3 أخبار.",
    icon: "📰",
  },
  {
    name: "fikri",
    toggleKey: "ads_fikri_enabled",
    configKey: "ad_config_fikri",
    label: "إعلانات فكري (المحادثة)",
    desc: "بطاقة UI مستقلة تظهر بعد كل 3 ردود من فكري.",
    icon: "🤖",
  },
];

function AdsPanel() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/system-settings"],
  });

  // Per-slot local config state
  const [localConfigs, setLocalConfigs] = useState<Record<AdSlotName, AdSlotLocalConfig>>({
    folder: { ...DEFAULT_SLOT_CONFIG },
    feed:   { ...DEFAULT_SLOT_CONFIG },
    fikri:  { ...DEFAULT_SLOT_CONFIG },
  });

  // Sync from server settings when data arrives
  useEffect(() => {
    if (!settings) return;
    const parse = (configKey: string): AdSlotLocalConfig => {
      const row = settings.find((s: any) => s.key === configKey);
      if (!row?.value) return { ...DEFAULT_SLOT_CONFIG };
      try {
        const parsed = JSON.parse(row.value);
        return { ...DEFAULT_SLOT_CONFIG, ...parsed };
      } catch {
        return { ...DEFAULT_SLOT_CONFIG };
      }
    };
    setLocalConfigs({
      folder: parse("ad_config_folder"),
      feed:   parse("ad_config_feed"),
      fikri:  parse("ad_config_fikri"),
    });
  }, [settings]);

  const toggleMutation = useMutation({
    mutationFn: (data: { key: string; value: string }) =>
      apiRequest("PUT", "/api/admin/system-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings/ads"] });
    },
    onError: () => toast({ title: "خطأ", description: "فشل حفظ الإعداد", variant: "destructive" }),
  });

  const configMutation = useMutation({
    mutationFn: (data: { key: string; value: string; description: string }) =>
      apiRequest("PUT", "/api/admin/system-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings/ads"] });
      toast({ title: "✅ تم حفظ إعداد الإعلان بنجاح" });
    },
    onError: () => toast({ title: "خطأ", description: "فشل حفظ الإعداد", variant: "destructive" }),
  });

  if (isLoading) return <PanelLoader />;

  const getToggleValue = (key: string): boolean => {
    const s = settings?.find((r: any) => r.key === key);
    return s ? s.value !== "false" : true;
  };

  const updateLocalConfig = (name: AdSlotName, patch: Partial<AdSlotLocalConfig>) => {
    setLocalConfigs(prev => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  };

  const handleSaveConfig = (slotMeta: typeof AD_SLOT_META[number]) => {
    const cfg = localConfigs[slotMeta.name];
    configMutation.mutate({
      key: slotMeta.configKey,
      value: JSON.stringify(cfg),
      description: `إعداد الإعلان — ${slotMeta.label}`,
    });
  };

  return (
    <div className="space-y-6" data-testid="panel-ads">
      <div>
        <h2 className="text-xl font-bold mb-1">الإعلانات والرعايات</h2>
        <p className="text-sm text-muted-foreground mb-6">
          شغّل / أوقف كل موضع وحدد نوع الإعلان (AdSense أو راعٍ مباشر). التغييرات فورية.
        </p>

        <div className="space-y-6">
          {AD_SLOT_META.map((slot) => {
            const enabled = getToggleValue(slot.toggleKey);
            const cfg = localConfigs[slot.name];

            return (
              <div
                key={slot.name}
                className="card bg-card p-5 space-y-4"
                data-testid={`ads-slot-${slot.name}`}
              >
                {/* ── Header row: icon + label + toggle ── */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5 select-none">{slot.icon}</span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-base">{slot.label}</span>
                        <Badge variant={enabled ? "default" : "secondary"} className="text-[10px]">
                          {enabled ? "مفعّل" : "موقف"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{slot.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={() =>
                      toggleMutation.mutate({ key: slot.toggleKey, value: String(!enabled) })
                    }
                    disabled={toggleMutation.isPending}
                    data-testid={`switch-${slot.name}`}
                  />
                </div>

                {/* ── Mode selector ── */}
                <div className="border-t border-border/60 pt-4 space-y-4">
                  <div>
                    <Label className="text-sm font-bold mb-2 block">نوع الإعلان</Label>
                    <RadioGroup
                      value={cfg.mode}
                      onValueChange={(v) => updateLocalConfig(slot.name, { mode: v as AdMode })}
                      className="flex flex-wrap gap-4"
                      dir="rtl"
                    >
                      {(["placeholder", "adsense", "sponsor"] as AdMode[]).map((m) => (
                        <div key={m} className="flex items-center gap-2">
                          <RadioGroupItem value={m} id={`${slot.name}-mode-${m}`} />
                          <Label htmlFor={`${slot.name}-mode-${m}`} className="font-semibold cursor-pointer">
                            {m === "placeholder" ? "Placeholder (افتراضي)" : m === "adsense" ? "Google AdSense" : "راعٍ مباشر"}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* ── AdSense fields ── */}
                  {cfg.mode === "adsense" && (
                    <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Publisher ID (ca-pub-xxxxxx)</Label>
                        <Input
                          placeholder="ca-pub-0000000000000000"
                          value={cfg.adsenseClientId}
                          onChange={(e) => updateLocalConfig(slot.name, { adsenseClientId: e.target.value })}
                          dir="ltr"
                          data-testid={`input-adsense-client-${slot.name}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Ad Slot ID</Label>
                        <Input
                          placeholder="1234567890"
                          value={cfg.adsenseSlotId}
                          onChange={(e) => updateLocalConfig(slot.name, { adsenseSlotId: e.target.value })}
                          dir="ltr"
                          data-testid={`input-adsense-slot-${slot.name}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Direct Sponsor fields ── */}
                  {cfg.mode === "sponsor" && (
                    <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs font-bold">عنوان الراعي</Label>
                          <Input
                            placeholder="اسم الشركة أو الحملة"
                            value={cfg.sponsorTitle}
                            onChange={(e) => updateLocalConfig(slot.name, { sponsorTitle: e.target.value })}
                            data-testid={`input-sponsor-title-${slot.name}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-bold">رابط الصفحة (URL)</Label>
                          <Input
                            placeholder="https://example.com"
                            value={cfg.sponsorUrl}
                            onChange={(e) => updateLocalConfig(slot.name, { sponsorUrl: e.target.value })}
                            dir="ltr"
                            data-testid={`input-sponsor-url-${slot.name}`}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">وصف الإعلان</Label>
                        <Input
                          placeholder="جملة تسويقية قصيرة..."
                          value={cfg.sponsorDesc}
                          onChange={(e) => updateLocalConfig(slot.name, { sponsorDesc: e.target.value })}
                          data-testid={`input-sponsor-desc-${slot.name}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">رابط الصورة / الشعار (اختياري)</Label>
                        <Input
                          placeholder="https://example.com/logo.png"
                          value={cfg.sponsorImageUrl}
                          onChange={(e) => updateLocalConfig(slot.name, { sponsorImageUrl: e.target.value })}
                          dir="ltr"
                          data-testid={`input-sponsor-image-${slot.name}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Save button ── */}
                  <div className="flex justify-start">
                    <Button
                      size="sm"
                      onClick={() => handleSaveConfig(slot)}
                      disabled={configMutation.isPending}
                      data-testid={`button-save-ad-config-${slot.name}`}
                    >
                      {configMutation.isPending ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin ml-2" />جاري الحفظ...</>
                      ) : (
                        <><Save className="h-3.5 w-3.5 ml-2" />حفظ إعداد {slot.label}</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info card */}
      <div className="card bg-card p-5">
        <h3 className="font-bold mb-2 flex items-center gap-2">
          <BadgeDollarSign className="h-4 w-4 text-amber-500" />
          كيف يعمل النظام؟
        </h3>
        <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
          <li><strong>Placeholder:</strong> يعرض البطاقة الذهبية الافتراضية مع نص تجريبي.</li>
          <li><strong>AdSense:</strong> يُحقن كود Google AdSense داخل القالب الذهبي تلقائياً عند أول ظهور.</li>
          <li><strong>راعٍ مباشر:</strong> يعرض شعار + عنوان + رابط الراعي بتصميم Liquid Glass.</li>
        </ul>
      </div>
    </div>
  );
}

function PanelLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
