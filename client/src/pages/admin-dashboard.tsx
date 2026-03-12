import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  BarChart3, Users, Megaphone, Bell, Settings, Shield, LogOut,
  Plus, Trash2, Edit, Save, X, Loader2, FileText, Eye, EyeOff,
  Lock, AlertTriangle, ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type Tab = "analytics" | "users" | "announcements" | "banners" | "settings" | "admins" | "audit";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("analytics");
  const { user, exitAdmin, isSuperAdmin } = useAuth();
  const [, navigate] = useLocation();

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "analytics", label: "الإحصائيات", icon: BarChart3 },
    { id: "users", label: "المستخدمون", icon: Users },
    { id: "announcements", label: "الإعلانات", icon: Megaphone },
    { id: "banners", label: "الشريط العلوي", icon: Bell },
    { id: "settings", label: "إعدادات النظام", icon: Settings },
    { id: "admins", label: "إدارة المدراء", icon: Shield },
    { id: "audit", label: "سجل التدقيق", icon: FileText },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-background flex">
      <aside className="w-64 border-l bg-card min-h-screen p-4 flex flex-col" data-testid="admin-sidebar">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">لوحة التحكم</h1>
          </div>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          {isSuperAdmin && <Badge variant="outline" className="mt-1 text-xs">مدير أعلى</Badge>}
        </div>

        <nav className="space-y-1 flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="space-y-2 pt-4 border-t">
          <Button variant="ghost" className="w-full justify-start gap-2 text-sm" onClick={() => navigate("/")} data-testid="button-back-app">
            <ChevronLeft className="h-4 w-4" />
            العودة للتطبيق
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2 text-sm text-destructive" onClick={() => exitAdmin()} data-testid="button-exit-admin">
            <LogOut className="h-4 w-4" />
            خروج من الإدارة
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        {activeTab === "analytics" && <AnalyticsPanel />}
        {activeTab === "users" && <UsersPanel />}
        {activeTab === "announcements" && <AnnouncementsPanel />}
        {activeTab === "banners" && <BannersPanel />}
        {activeTab === "settings" && <SystemSettingsPanel />}
        {activeTab === "admins" && <AdminsPanel />}
        {activeTab === "audit" && <AuditPanel />}
      </main>
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
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");

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

  if (isLoading) return <PanelLoader />;

  const knownFlags = [
    { key: "fikri_enabled", desc: "تفعيل فكري" },
    { key: "registration_enabled", desc: "تفعيل التسجيل" },
    { key: "web_search_enabled", desc: "تفعيل البحث" },
    { key: "ai_generation_enabled", desc: "تفعيل توليد المحتوى" },
    { key: "default_search_api_key", desc: "مفتاح البحث الافتراضي" },
    { key: "app_version", desc: "رقم إصدار التطبيق" },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">إعدادات النظام</h2>

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

        {settings?.filter((s: any) => !knownFlags.some((f) => f.key === s.key)).map((s: any) => (
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

function PanelLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
