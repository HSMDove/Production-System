import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { 
  TrendingUp, 
  Sparkles, 
  ThumbsUp, 
  ThumbsDown, 
  Minus,
  RefreshCw,
  Tag,
  Loader2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TrendingTopic {
  topic: string;
  frequency: number;
  sentiment: "positive" | "negative" | "neutral";
  relatedKeywords: string[];
}

interface SentimentStats {
  total: number;
  analyzed: number;
  unanalyzed: number;
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };
  topKeywords: { keyword: string; count: number }[];
}

const sentimentLabels: Record<string, string> = {
  positive: "إيجابي",
  negative: "سلبي",
  neutral: "محايد",
};

const sentimentColors: Record<string, string> = {
  positive: "#10b981",
  negative: "#ef4444",
  neutral: "#6b7280",
};

const COLORS = ["#10b981", "#ef4444", "#6b7280"];

export default function Trends() {
  const { toast } = useToast();

  const { data: sentimentStats, isLoading: loadingStats } = useQuery<SentimentStats>({
    queryKey: ["/api/content/sentiment-stats"],
  });

  const { data: trendingData, isLoading: loadingTrends, refetch: refetchTrends } = useQuery<{ topics: TrendingTopic[] }>({
    queryKey: ["/api/trending-topics"],
  });

  const analyzeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/content/analyze"),
    onSuccess: (data: { analyzed: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content/sentiment-stats"] });
      toast({
        title: "تم التحليل",
        description: `تم تحليل ${data.analyzed} محتوى`,
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل تحليل المحتوى",
        variant: "destructive",
      });
    },
  });

  const refreshTopicsMutation = useMutation({
    mutationFn: () => refetchTrends(),
    onSuccess: () => {
      toast({
        title: "تم التحديث",
        description: "تم تحديث المواضيع الرائجة",
      });
    },
  });

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return <ThumbsUp className="w-4 h-4 text-green-500" />;
      case "negative":
        return <ThumbsDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (loadingStats || loadingTrends) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">تحليل المحتوى</h1>
            <p className="text-muted-foreground mt-1">تحليل المشاعر والمواضيع الرائجة</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-[300px]" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  const pieData = sentimentStats ? [
    { name: "إيجابي", value: sentimentStats.sentimentBreakdown.positive },
    { name: "سلبي", value: sentimentStats.sentimentBreakdown.negative },
    { name: "محايد", value: sentimentStats.sentimentBreakdown.neutral },
  ] : [];

  const keywordsData = sentimentStats?.topKeywords.slice(0, 10).map(k => ({
    name: k.keyword,
    count: k.count,
  })) || [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">تحليل المحتوى</h1>
            <p className="text-muted-foreground mt-1">تحليل المشاعر والمواضيع الرائجة</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              data-testid="button-analyze-content"
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Sparkles className="w-4 h-4 ml-2" />
              )}
              تحليل المحتوى
            </Button>
            <Button
              variant="outline"
              onClick={() => refreshTopicsMutation.mutate()}
              disabled={refreshTopicsMutation.isPending}
              data-testid="button-refresh-trends"
            >
              {refreshTopicsMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <RefreshCw className="w-4 h-4 ml-2" />
              )}
              تحديث الاتجاهات
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-content">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي المحتوى</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sentimentStats?.total || 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-analyzed-content">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">تم تحليله</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sentimentStats?.analyzed || 0}</div>
              {sentimentStats && sentimentStats.total > 0 && (
                <Progress 
                  value={(sentimentStats.analyzed / sentimentStats.total) * 100} 
                  className="mt-2"
                />
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-positive-sentiment">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إيجابي</CardTitle>
              <ThumbsUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {sentimentStats?.sentimentBreakdown.positive || 0}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-negative-sentiment">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">سلبي</CardTitle>
              <ThumbsDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {sentimentStats?.sentimentBreakdown.negative || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card data-testid="card-sentiment-chart">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                توزيع المشاعر
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sentimentStats && sentimentStats.analyzed > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => 
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  لا توجد بيانات محللة
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-keywords-chart">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="w-5 h-5" />
                الكلمات المفتاحية الأكثر شيوعاً
              </CardTitle>
            </CardHeader>
            <CardContent>
              {keywordsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={keywordsData} layout="vertical">
                    <XAxis type="number" />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  لا توجد كلمات مفتاحية
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-trending-topics">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              المواضيع الرائجة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendingData?.topics && trendingData.topics.length > 0 ? (
              <div className="space-y-4">
                {trendingData.topics.map((topic, index) => (
                  <div 
                    key={index} 
                    className="flex flex-wrap items-start gap-3 p-4 rounded-lg bg-muted/50"
                    data-testid={`trending-topic-${index}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getSentimentIcon(topic.sentiment)}
                      <span className="font-semibold truncate">{topic.topic}</span>
                      <Badge 
                        variant="secondary" 
                        className="shrink-0"
                        style={{ 
                          backgroundColor: sentimentColors[topic.sentiment] + "20",
                          color: sentimentColors[topic.sentiment],
                        }}
                      >
                        {sentimentLabels[topic.sentiment]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {topic.relatedKeywords.map((keyword, kIndex) => (
                        <Badge key={kIndex} variant="outline">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                    <Badge className="shrink-0">
                      {topic.frequency} ظهور
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mb-4 opacity-50" />
                <p>لا توجد مواضيع رائجة</p>
                <p className="text-sm mt-1">قم بجلب المحتوى أولاً ثم اضغط "تحديث الاتجاهات"</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
