import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  BarChart3, Users, Megaphone, Bell, Settings, Shield, LogOut,
  Plus, Trash2, Edit, Save, X, Loader2, FileText, Eye, EyeOff,
  Lock, AlertTriangle, ChevronLeft, MessageSquare, Send, Clock,
  Sparkles, RotateCcw
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { defaultLoginPageContent, parseLoginPageContent, type LoginPageContent } from "@shared/login-page-content";
import { ADMIN_MODEL_CATALOG, getDefaultModel, type AdminAIProvider } from "@/lib/model-catalog";

type Tab = "analytics" | "users" | "announcements" | "banners" | "welcome" | "tickets" | "pages" | "settings" | "admins" | "audit";

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

function PagesPanel() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<LoginPageContent>({
    queryKey: ["/api/admin/page-content/login"],
  });
  const [selectedPage, setSelectedPage] = useState<"login">("login");
  const [form, setForm] = useState<LoginPageContent>(defaultLoginPageContent);

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

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

  if (isLoading) return <PanelLoader />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="card bg-card p-4">
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
        </aside>

        <div className="space-y-4">
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

function PanelLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
