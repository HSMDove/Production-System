import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Bot, Check, Edit2, Loader2, MessageSquarePlus, Plus, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useFikriOverlay } from "@/contexts/fikri-overlay-context";

type ChatRole = "user" | "assistant";
interface ConversationItem { id: string; title: string; createdAt: string; updatedAt: string; }
interface MessageItem { id: string; role: ChatRole; content: string; action?: string | null; createdAt: string; }
interface ConversationMessagesResponse { conversation: ConversationItem; messages: MessageItem[]; }

const loadingLabels: Record<string, string> = {
  searching_news: "يبحث في الأخبار...",
  saving_idea: "يحفظ الفكرة...",
  thinking: "يفكّر...",
};

export function FikriOverlay() {
  const { open, setOpen } = useFikriOverlay();

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isNewMode, setIsNewMode] = useState(false);
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const { data: conversations } = useQuery<ConversationItem[]>({
    queryKey: ["/api/assistant/conversations"],
    enabled: open,
  });

  const { data: conversationData, isLoading: messagesLoading } = useQuery<ConversationMessagesResponse>({
    queryKey: ["/api/assistant/conversations", activeConversationId, "messages"],
    enabled: !!activeConversationId,
  });

  useEffect(() => {
    if (!activeConversationId && !isNewMode && conversations && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, isNewMode, conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationData?.messages, chatError]);

  const chatMutation = useMutation({
    mutationFn: async ({ message, conversationId }: { message: string; conversationId: string }) => {
      setChatError(null);
      return apiRequest<{ answer: string; statusLabel?: string; conversationId: string }>("POST", "/api/assistant/chat", { message, conversationId });
    },
    onSuccess: (data) => {
      const convId = data.conversationId || activeConversationId;
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations", convId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
    },
    onError: (error: Error) => {
      const errorText = error.message || "فشل إرسال الرسالة";
      const match = errorText.match(/\d+:\s*\{?"?error"?:?\s*"?([^"}\n]+)"?\}?/);
      const cleanMessage = match ? match[1] : errorText.replace(/^\d+:\s*/, "");
      setChatError(cleanMessage);
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/assistant/conversations/${id}`),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      if (activeConversationId === deletedId) { setActiveConversationId(null); setIsNewMode(true); }
    },
  });

  const updateConversationMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => apiRequest("PATCH", `/api/assistant/conversations/${id}`, { title }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] }); setEditingId(null); },
  });

  const handleSend = async () => {
    const text = input.trim();
    if (!text || chatMutation.isPending) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "36px";
    const convId = activeConversationId || "new";
    chatMutation.mutate(
      { message: text, conversationId: convId === "new" ? "" : convId },
      {
        onSuccess: (data) => {
          if (data.conversationId && !activeConversationId) {
            setActiveConversationId(data.conversationId);
            setIsNewMode(false);
          }
        },
      }
    );
  };

  const messages = conversationData?.messages || [];
  const pendingLabel = chatMutation.isPending ? (loadingLabels[(chatMutation.variables as any)?.statusLabel || "thinking"] ?? "يفكّر...") : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200]" data-testid="fikri-overlay-root">
      <button
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="close-fikri-overlay"
        onClick={() => setOpen(false)}
      />

      <aside
        dir="rtl"
        className="absolute right-0 top-0 h-full w-full max-w-sm sm:max-w-md flex flex-col bg-card border-l border-border shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 font-semibold">
            <Bot className="h-4 w-4 text-primary" />
            <span>فكري</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs h-8"
              onClick={() => { setShowHistory((p) => !p); }}
              data-testid="button-toggle-history"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              {showHistory ? "المحادثة" : "السجل"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs h-8"
              onClick={() => { setActiveConversationId(null); setIsNewMode(true); setShowHistory(false); }}
              data-testid="button-new-conversation-overlay"
            >
              <Plus className="h-3.5 w-3.5" />
              جديد
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Conversation History Panel */}
        {showHistory ? (
          <ScrollArea className="flex-1 p-3">
            {!conversations || conversations.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">لا توجد محادثات سابقة</p>
            ) : (
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer border transition-colors ${
                      activeConversationId === conv.id
                        ? "bg-primary/10 border-primary/30"
                        : "hover:bg-muted/50 border-transparent"
                    }`}
                    onClick={() => { if (!editingId) { setActiveConversationId(conv.id); setIsNewMode(false); setShowHistory(false); } }}
                    data-testid={`conversation-item-${conv.id}`}
                  >
                    {editingId === conv.id ? (
                      <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="h-7 text-xs flex-1"
                          onKeyDown={(e) => { if (e.key === "Enter") updateConversationMutation.mutate({ id: conv.id, title: editTitle }); if (e.key === "Escape") setEditingId(null); }}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateConversationMutation.mutate({ id: conv.id, title: editTitle })}><Check className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-xs truncate">{conv.title}</span>
                        <div className="hidden group-hover:flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingId(conv.id); setEditTitle(conv.title); }}><Edit2 className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(conv.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        ) : (
          <>
            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-4">
              {!activeConversationId && isNewMode && (
                <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
                  <Bot className="h-8 w-8 text-primary/50" />
                  <p className="text-sm text-muted-foreground">ابدأ محادثة جديدة مع فكري</p>
                </div>
              )}
              {messagesLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="space-y-3">
                {messages.length === 0 && activeConversationId && !messagesLoading && (
                  <p className="text-center text-muted-foreground text-sm py-4">ابدأ المحادثة بسؤال فكري</p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === "assistant"
                        ? "bg-muted text-foreground"
                        : "bg-primary text-primary-foreground mr-6"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="mr-2">{children}</li>,
                          h1: ({ children }) => <h3 className="font-bold text-base mb-1">{children}</h3>,
                          h2: ({ children }) => <h3 className="font-bold text-base mb-1">{children}</h3>,
                          h3: ({ children }) => <h3 className="font-bold text-sm mb-1">{children}</h3>,
                          code: ({ children }) => <code className="bg-background/50 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
                          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>,
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    ) : (
                      m.content
                    )}
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {pendingLabel ?? "يفكّر..."}
                  </div>
                )}
                {chatError && !chatMutation.isPending && (
                  <div className="rounded-2xl px-3 py-2 text-sm leading-relaxed bg-destructive/10 border border-destructive/30 text-destructive" data-testid="fikri-chat-error">
                    <div className="flex items-center justify-between gap-2">
                      <span>⚠️ {chatError}</span>
                      <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0 text-destructive hover:text-destructive" onClick={() => setChatError(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="flex gap-2 border-t border-border p-3 shrink-0 items-end">
              <Button
                onClick={handleSend}
                disabled={chatMutation.isPending || !input.trim()}
                size="icon"
                className="shrink-0"
                data-testid="button-send-fikri"
              >
                {chatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="اسأل فكري..."
                rows={1}
                className="flex-1 resize-none rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto"
                style={{ minHeight: "36px", maxHeight: "160px" }}
                data-testid="input-fikri-message"
              />
            </div>
          </>
        )}
      </aside>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المحادثة</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteConfirmId) deleteConversationMutation.mutate(deleteConfirmId); setDeleteConfirmId(null); }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
