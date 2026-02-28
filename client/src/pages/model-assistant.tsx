import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Loader2, MessageSquarePlus, Plus, Save, Search, Send, User } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ChatRole = "user" | "assistant";

interface ConversationItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface MessageItem {
  id: string;
  role: ChatRole;
  content: string;
  action?: string | null;
  statusLabel?: "searching_news" | "saving_idea" | "thinking" | null;
  metadata?: {
    matchedContent?: Array<{
      id: string;
      title: string;
      folderName: string;
      originalUrl: string;
    }>;
  } | null;
  createdAt: string;
}

interface ConversationMessagesResponse {
  conversation: ConversationItem;
  messages: MessageItem[];
}

interface AssistantResponse {
  conversationId: string;
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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const { data: conversations } = useQuery<ConversationItem[]>({
    queryKey: ["/api/assistant/conversations"],
  });

  const { data: conversationData, isLoading: messagesLoading } = useQuery<ConversationMessagesResponse>({
    queryKey: ["/api/assistant/conversations", activeConversationId, "messages"],
    enabled: !!activeConversationId,
  });

  useEffect(() => {
    if (!activeConversationId && conversations && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  const createConversationMutation = useMutation({
    mutationFn: async () => apiRequest<ConversationItem>("POST", "/api/assistant/conversations", { title: "محادثة جديدة" }),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      setActiveConversationId(conversation.id);
    },
  });

  const history = useMemo(
    () =>
      (conversationData?.messages || [])
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-16),
    [conversationData?.messages],
  );

  const chatMutation = useMutation({
    mutationFn: async ({ message, conversationId }: { message: string; conversationId?: string | null }) => {
      return apiRequest<AssistantResponse>("POST", "/api/assistant/chat", {
        message,
        conversationId,
        history,
      });
    },
    onSuccess: (response) => {
      if (!activeConversationId) {
        setActiveConversationId(response.conversationId);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations", response.conversationId, "messages"] });
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

  const handleSend = async () => {
    const value = input.trim();
    if (!value || chatMutation.isPending) return;

    let conversationId = activeConversationId;
    if (!conversationId) {
      const created = await createConversationMutation.mutateAsync();
      conversationId = created.id;
      setActiveConversationId(created.id);
    }

    setInput("");
    chatMutation.mutate({ message: value, conversationId });
  };

  const loadingText = loadingLabelMap[chatMutation.data?.statusLabel || "thinking"];
  const messages = conversationData?.messages || [];

  return (
    <MainLayout>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4" dir="rtl">
        <Card className="h-[76vh] flex flex-col">
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><MessageSquarePlus className="h-4 w-4" /> سجل المحادثات</span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => createConversationMutation.mutate()}
                data-testid="button-new-conversation"
              >
                <Plus className="h-3.5 w-3.5" /> جديد
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {(conversations || []).map((conversation) => (
                  <button
                    key={conversation.id}
                    className={`w-full text-right rounded-lg px-3 py-2 transition-colors border ${
                      activeConversationId === conversation.id
                        ? "bg-primary/10 border-primary/30"
                        : "hover:bg-muted/50 border-transparent"
                    }`}
                    onClick={() => setActiveConversationId(conversation.id)}
                    data-testid={`conversation-item-${conversation.id}`}
                  >
                    <div className="font-medium text-sm line-clamp-1">{conversation.title || "محادثة بدون عنوان"}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(conversation.updatedAt).toLocaleString("ar")}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-4 min-w-0">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-model-page-title">النموذج</h1>
            <p className="text-muted-foreground mt-1">مساعد ذكي متصل بالأخبار والمجلدات وقسم الأفكار، مع حفظ كامل لجلسات المحادثة.</p>
          </div>

          <Card className="min-h-[68vh] flex flex-col">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="h-5 w-5 text-primary" />
                محادثة ذكية
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
              {messagesLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري تحميل الرسائل...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-muted-foreground">ابدأ محادثة جديدة واسأل المساعد عن الأخبار أو اطلب منه حفظ فكرة.</div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}>
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

                      {message.role === "assistant" && message.metadata?.matchedContent && message.metadata.matchedContent.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.metadata.matchedContent.map((item) => (
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
                ))
              )}

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

            <Separator />
            <div className="p-3 sm:p-4">
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
      </div>
    </MainLayout>
  );
}
