import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { FolderOpen, Lightbulb, Newspaper, Rss, TrendingUp, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface AnalyticsData {
  totalFolders: number;
  totalIdeas: number;
  totalContent: number;
  totalSources: number;
  completionRate: number;
  ideasByStatus: Record<string, number>;
  ideasByCategory: Record<string, number>;
  contentByFolder: { folderId: string; folderName: string; count: number }[];
  sourcesByType: Record<string, number>;
  ideasOverTime: { date: string; count: number }[];
  contentOverTime: { date: string; count: number }[];
}

const statusLabels: Record<string, string> = {
  raw_idea: "فكرة خام",
  needs_research: "يحتاج بحث",
  ready_for_script: "جاهز للسكريبت",
  script_in_progress: "السكريبت قيد التنفيذ",
  ready_for_filming: "جاهز للتصوير",
  completed: "مكتمل",
};

const categoryLabels: Record<string, string> = {
  thalathiyat: "ثلاثيات",
  leh: "ليه",
  tech_i_use: "تقنية أستخدمها",
  news_roundup: "جولة أخبار",
  deep_dive: "تعمق",
  comparison: "مقارنة",
  tutorial: "شرح",
  other: "أخرى",
};

const sourceTypeLabels: Record<string, string> = {
  rss: "RSS",
  website: "موقع",
  youtube: "يوتيوب",
  twitter: "تويتر",
};

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Analytics() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics/overview"],
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">التحليلات</h1>
            <p className="text-muted-foreground mt-1">نظرة عامة على أداء المحتوى والأفكار</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[300px]" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">لا توجد بيانات للعرض</p>
        </div>
      </MainLayout>
    );
  }

  const statusData = Object.entries(data.ideasByStatus).map(([key, value]) => ({
    name: statusLabels[key] || key,
    value,
    status: key,
  }));

  const categoryData = Object.entries(data.ideasByCategory).map(([key, value]) => ({
    name: categoryLabels[key] || key,
    value,
  }));

  const sourceTypeData = Object.entries(data.sourcesByType).map(([key, value]) => ({
    name: sourceTypeLabels[key] || key,
    value,
  }));

  const recentIdeasData = data.ideasOverTime.slice(-14).map(item => ({
    date: format(new Date(item.date), "d MMM", { locale: ar }),
    count: item.count,
  }));

  const recentContentData = data.contentOverTime.slice(-14).map(item => ({
    date: format(new Date(item.date), "d MMM", { locale: ar }),
    count: item.count,
  }));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">التحليلات</h1>
          <p className="text-muted-foreground mt-1">نظرة عامة على أداء المحتوى والأفكار</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-stat-folders">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">المجلدات</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalFolders}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-ideas">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">الأفكار</CardTitle>
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalIdeas}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-content">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">المحتوى</CardTitle>
              <Newspaper className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalContent}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-sources">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">المصادر</CardTitle>
              <Rss className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalSources}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-completion-rate">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">معدل الإنجاز</CardTitle>
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">{data.completionRate}%</div>
                <div className="flex-1">
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300" 
                      style={{ width: `${data.completionRate}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {data.ideasByStatus.completed || 0} من {data.totalIdeas} فكرة مكتملة
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-source-types">
            <CardHeader>
              <CardTitle className="text-lg">توزيع المصادر</CardTitle>
            </CardHeader>
            <CardContent>
              {sourceTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={sourceTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {sourceTypeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-muted-foreground">
                  لا توجد مصادر
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-ideas-status">
            <CardHeader>
              <CardTitle className="text-lg">الأفكار حسب الحالة</CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={statusData} layout="vertical">
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  لا توجد أفكار
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-ideas-category">
            <CardHeader>
              <CardTitle className="text-lg">الأفكار حسب الفئة</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {categoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  لا توجد أفكار
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2" data-testid="card-ideas-trend">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">الأفكار خلال آخر أسبوعين</CardTitle>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {recentIdeasData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={recentIdeasData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6" }}
                      name="أفكار جديدة"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  لا توجد بيانات
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2" data-testid="card-content-folder">
            <CardHeader>
              <CardTitle className="text-lg">المحتوى حسب المجلد</CardTitle>
            </CardHeader>
            <CardContent>
              {data.contentByFolder.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.contentByFolder}>
                    <XAxis dataKey="folderName" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="عدد المحتوى" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  لا توجد مجلدات
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
