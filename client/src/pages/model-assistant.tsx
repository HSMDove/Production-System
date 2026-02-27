import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Loader2, Send, User, Search, Save } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  statusLabel?: string;
  matchedContent?: Array<{
    id: string;
    title: string;
    folderName: string;
    originalUrl: string;
  }>;
}

interface AssistantResponse {
  action: "search_news" | "save_idea" | "chat";
  statusLabel: "searching_news" | "saving_idea" | "thinking";
  answer: string;
  matchedContent?: Array<{
    id: string;
    title: string;
    folderName: string;
    originalUrl: string;
  }>;
  createdIdea?: { id: string; title: string };
}

const loadingLabelMap = {
  searching_news: "جاري البحث في الأخبار والمجلدات...",
  saving_idea: "جاري فهم الفكرة وحفظها في قسم الأفكار...",
  thinking: "المساعد يفكّر...",
} as const;

export default function ModelAssistantPage() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "مرحباً، أنا مساعدك الذكي في صفحة النموذج. أستطيع البحث داخل الأخبار والمجلدات، وكذلك حفظ أفكارك مباشرة في صفحة الأفكار.",
      statusLabel: "thinking",
    },
  ]);

  const history = useMemo(
    () =>
      messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-12),
    [messages],
  );

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest<AssistantResponse>("POST", "/api/assistant/chat", {
        message,
        history,
      });
    },
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answer,
          statusLabel: response.statusLabel,
          matchedContent: response.matchedContent,
        },
      ]);

      if (response.createdIdea) {
        queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
        toast({ title: "تم حفظ الفكرة", description: response.createdIdea.title });
      }
    },
    onError: (error: any) => {
      toast({
        title: "تعذر إكمال الطلب",
        description: error?.message || "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    const value = input.trim();
    if (!value || chatMutation.isPending) return;

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: value,
      },
    ]);

    setInput("");
    chatMutation.mutate(value);
  };

  const loadingText =
    loadingLabelMap[chatMutation.data?.statusLabel || "thinking"] || loadingLabelMap.thinking;

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-4" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-model-page-title">النموذج</h1>
          <p className="text-muted-foreground mt-1">
            مساعد ذكي متصل بالأخبار والمجلدات وقسم الأفكار داخل نظامك.
          </p>
        </div>

        <Card className="min-h-[68vh] flex flex-col">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-primary" />
              محادثة ذكية
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-sm border ${
                    message.role === "assistant"
                      ? "bg-muted/40 border-border"
                      : "bg-primary text-primary-foreground border-primary"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 text-xs opacity-80">
                    {message.role === "assistant" ? (
                      <>
                        <Bot className="h-3.5 w-3.5" />
                        <span>المساعد</span>
                      </>
                    ) : (
                      <>
                        <User className="h-3.5 w-3.5" />
                        <span>أنت</span>
                      </>
                    )}
                  </div>
                  <p className="leading-7 whitespace-pre-wrap">{message.content}</p>

                  {message.role === "assistant" && message.matchedContent && message.matchedContent.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.matchedContent.map((item) => (
                        <a
                          key={item.id}
                          href={item.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-lg border border-border/60 bg-background/80 p-2 text-sm hover:bg-background"
                        >
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">{item.folderName}</div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 border bg-muted/40 max-w-[90%] sm:max-w-[80%]">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{loadingText}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <div className="border-t p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                placeholder="اسأل عن آخر الأخبار، أو اكتب فكرة واطلب مني حفظها..."
                className="text-right"
                data-testid="input-assistant-message"
              />
              <Button
                onClick={handleSend}
                disabled={chatMutation.isPending || !input.trim()}
                className="gap-2"
                data-testid="button-send-assistant-message"
              >
                <Send className="h-4 w-4" />
                إرسال
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1"><Search className="h-3 w-3" /> بحث الأخبار</Badge>
              <Badge variant="secondary" className="gap-1"><Save className="h-3 w-3" /> حفظ فكرة تلقائياً</Badge>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
