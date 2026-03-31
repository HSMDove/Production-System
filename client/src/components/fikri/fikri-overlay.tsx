import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Bot, Check, Edit2, Loader2, MessageSquarePlus, Plus, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FikriAdCard } from "@/components/ads/fikri-ad-card";
import { useAdSettings } from "@/hooks/use-ad-settings";
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

interface MessageItem {
  id: string;
  role: ChatRole;
  content: string;
  action?: string | null;
  createdAt: string;
}

// Extends MessageItem with an optimistic flag so we can identify
// locally-added messages that haven't been confirmed by the server yet.
interface LocalMessage extends MessageItem {
  isOptimistic?: boolean;
}

interface ConversationItem { id: string; title: string; createdAt: string; updatedAt: string; }
interface ConversationMessagesResponse { conversation: ConversationItem; messages: MessageItem[]; }

// Reusable Markdown renderer for assistant messages
const MarkdownMessage = ({ content }: { content: string }) => (
  <ReactMarkdown
    components={{
      p:      ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      strong: ({ children }) => <strong className="font-bold">{children}</strong>,
      em:     ({ children }) => <em className="italic">{children}</em>,
      ul:     ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
      ol:     ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
      li:     ({ children }) => <li className="ml-4">{children}</li>,
      h1:     ({ children }) => <h3 className="font-bold text-base mb-1">{children}</h3>,
      h2:     ({ children }) => <h3 className="font-bold text-base mb-1">{children}</h3>,
      h3:     ({ children }) => <h3 className="font-bold text-sm mb-1">{children}</h3>,
      code:   ({ children }) => <code className="bg-background/50 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
      a:      ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>,
    }}
  >
    {content}
  </ReactMarkdown>
);

export function FikriOverlay() {
  const { open, setOpen } = useFikriOverlay();

  // ── Conversation navigation ──────────────────────────────────────────────
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isNewMode, setIsNewMode]     = useState(false);
  const [input, setInput]             = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editTitle, setEditTitle]     = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [chatError, setChatError]     = useState<string | null>(null);

  // ── Ad tracking ──────────────────────────────────────────────────────────
  const { fikriAds } = useAdSettings();
  const aiResponseCountRef = useRef(0);
  const [dismissedAdIndexes, setDismissedAdIndexes] = useState<Set<number>>(new Set());

  // ── Single-source-of-truth message list ─────────────────────────────────
  // This is the ONLY array rendered. It is synced from the server query
  // exclusively when the query has settled (not streaming, not fetching).
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);

  // ── Streaming display ────────────────────────────────────────────────────
  // The live assistant response while the SSE stream is in flight.
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming]     = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevLocalLenRef = useRef(0);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: conversations } = useQuery<ConversationItem[]>({
    queryKey: ["/api/assistant/conversations"],
    enabled: open,
  });

  // isFetching is true during both the initial load AND after invalidateQueries triggers a refetch.
  // We use it as a gate to prevent syncing localMessages while a refetch is in flight.
  const {
    data: conversationData,
    isLoading: messagesLoading,
    isFetching: isMsgFetching,
  } = useQuery<ConversationMessagesResponse>({
    queryKey: ["/api/assistant/conversations", activeConversationId, "messages"],
    enabled: !!activeConversationId,
  });

  // ── Auto-select first conversation ───────────────────────────────────────
  useEffect(() => {
    if (!activeConversationId && !isNewMode && conversations && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, isNewMode, conversations]);

  // ── Sync localMessages from server ───────────────────────────────────────
  // ONLY runs when BOTH conditions are true:
  //   1. Not currently streaming (no active SSE connection)
  //   2. The query is not fetching (avoids syncing while awaiting fresh data after invalidation)
  //
  // This is the architectural fix for the race condition:
  // - After stream ends, `isStreaming = false` fires before the refetch completes.
  //   The old code ran its settle effect here and cleared the optimistic message.
  // - Now we ALSO require `!isMsgFetching`. Since `invalidateQueries` sets `isFetching = true`
  //   immediately, this gate holds until the HTTP response returns fresh data.
  // - Only then do we replace localMessages, atomically swapping optimistic content for
  //   the authoritative server record — zero flicker, zero duplication.
  useEffect(() => {
    if (!isStreaming && !isMsgFetching) {
      setLocalMessages(conversationData?.messages ?? []);
      setStreamingText("");
    }
  }, [conversationData?.messages, isStreaming, isMsgFetching]);

  // ── Scroll management ────────────────────────────────────────────────────
  // Smooth scroll only when a new message is appended to localMessages.
  useEffect(() => {
    if (localMessages.length !== prevLocalLenRef.current) {
      prevLocalLenRef.current = localMessages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [localMessages.length]);

  // Instant-pin during streaming to avoid scroll animation thrashing.
  useEffect(() => {
    if (isStreaming && streamingText) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
    }
  }, [isStreaming, streamingText]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/assistant/conversations/${id}`),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      if (activeConversationId === deletedId) {
        setActiveConversationId(null);
        setLocalMessages([]);
        setIsNewMode(true);
      }
    },
  });

  const updateConversationMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiRequest("PATCH", `/api/assistant/conversations/${id}`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      setEditingId(null);
    },
  });

  // ── Send handler ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "36px";
    setChatError(null);
    setStreamingText("");
    setIsStreaming(true);
    let streamSucceeded = false;

    const convId = activeConversationId || "";

    // Append the optimistic user message directly into localMessages.
    // This is the single render source — no separate "pendingUserMsg" state.
    const optimisticMsg: LocalMessage = {
      id: `opt-user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };
    setLocalMessages(prev => [...prev, optimisticMsg]);

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const response = await fetch("/api/assistant/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId: convId }),
        signal: ctrl.signal,
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => "");
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      let doneConvId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on SSE event boundaries (double newline)
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          let eventType = "message";
          let dataStr   = "";

          for (const line of part.split("\n")) {
            if (line.startsWith("event: "))     eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr   = line.slice(6).trim();
          }

          if (!dataStr) continue;

          let data: any;
          try { data = JSON.parse(dataStr); } catch { continue; }

          if (eventType === "meta" && data.conversationId) {
            doneConvId = data.conversationId;
            if (!activeConversationId) {
              // New conversation: set ID so the messages query starts.
              // The sync effect is blocked by isStreaming=true, so localMessages
              // (including the optimistic user message) are preserved.
              setActiveConversationId(data.conversationId);
              setIsNewMode(false);
            }
          } else if (eventType === "token" && typeof data.text === "string") {
            setStreamingText(prev => prev + data.text);
          } else if (eventType === "done") {
            streamSucceeded = true;
            const finalConvId = data.conversationId || doneConvId || activeConversationId;
            // Fire both invalidations WITHOUT awaiting.
            // We don't need to await here — the sync effect is gated on isFetching,
            // which TanStack Query sets true immediately when the refetch starts.
            queryClient.invalidateQueries({
              queryKey: ["/api/assistant/conversations", finalConvId, "messages"],
            });
            queryClient.invalidateQueries({
              queryKey: ["/api/assistant/conversations"],
            });
          } else if (eventType === "error") {
            throw new Error(data.message || "فشل إرسال الرسالة");
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        const errorText = err.message || "فشل إرسال الرسالة";
        const match = errorText.match(/\d+:\s*\{?"?error"?:?\s*"?([^"}\n]+)"?\}?/);
        setChatError(match ? match[1] : errorText.replace(/^\d+:\s*/, ""));
        // On error: remove the optimistic message so the user can retry.
        setLocalMessages(prev => prev.filter(m => !m.isOptimistic));
        setStreamingText("");
      }
    } finally {
      if (streamSucceeded) {
        aiResponseCountRef.current += 1;
      }
      setIsStreaming(false);
      abortRef.current = null;
      // localMessages is NOT touched here.
      // streamingText is cleared by the sync effect once isMsgFetching goes false.
    }
  };

  if (!open) return null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200]" data-testid="fikri-overlay-root">
      <button
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="close-fikri-overlay"
        onClick={() => setOpen(false)}
      />

      <aside
        dir="rtl"
        className="absolute right-0 top-0 h-full w-full max-w-sm sm:max-w-md flex flex-col liquid-glass border-l shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/20 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 font-semibold">
            <Bot className="h-4 w-4 text-primary" />
            <span>فكري</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs h-8"
              onClick={() => setShowHistory(p => !p)}
              data-testid="button-toggle-history"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              {showHistory ? "المحادثة" : "السجل"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs h-8"
              onClick={() => {
                setActiveConversationId(null);
                setLocalMessages([]);
                setStreamingText("");
                setIsNewMode(true);
                setShowHistory(false);
                setChatError(null);
              }}
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
                    onClick={() => {
                      if (!editingId) {
                        setActiveConversationId(conv.id);
                        setLocalMessages([]);
                        setIsNewMode(false);
                        setShowHistory(false);
                      }
                    }}
                    data-testid={`conversation-item-${conv.id}`}
                  >
                    {editingId === conv.id ? (
                      <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                        <Input
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="h-7 text-xs flex-1"
                          onKeyDown={e => {
                            if (e.key === "Enter") updateConversationMutation.mutate({ id: conv.id, title: editTitle });
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6"
                          onClick={() => updateConversationMutation.mutate({ id: conv.id, title: editTitle })}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-xs truncate">{conv.title}</span>
                        <div className="hidden group-hover:flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-6 w-6"
                            onClick={() => { setEditingId(conv.id); setEditTitle(conv.title); }}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(conv.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
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
              {/* New conversation empty state */}
              {!activeConversationId && isNewMode && localMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
                  <Bot className="h-8 w-8 text-primary/50" />
                  <p className="text-sm text-muted-foreground">ابدأ محادثة جديدة مع فكري</p>
                </div>
              )}

              {/* Loading spinner for initial query */}
              {messagesLoading && !isStreaming && localMessages.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              <div className="space-y-3">
                {localMessages.length === 0 && activeConversationId && !messagesLoading && !isStreaming && (
                  <p className="text-center text-muted-foreground text-sm py-4">ابدأ المحادثة بسؤال فكري</p>
                )}

                {/* Single source: localMessages (includes optimistic entries during streaming) */}
                {(() => {
                  let assistantCount = 0;
                  return localMessages.map((m) => {
                    const isAssistant = m.role === "assistant" && !m.isOptimistic;
                    if (isAssistant) assistantCount += 1;
                    const showAd = fikriAds && isAssistant && assistantCount % 3 === 0 && !dismissedAdIndexes.has(assistantCount);
                    return (
                      <div key={m.id}>
                        <div
                          dir={m.role === "assistant" ? "rtl" : undefined}
                          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed text-right ${
                            m.role === "assistant"
                              ? "bg-muted text-foreground"
                              : "bg-primary text-primary-foreground mr-6 text-left"
                          }`}
                        >
                          {m.role === "assistant" ? <MarkdownMessage content={m.content} /> : m.content}
                        </div>
                        {showAd && (
                          <div className="mt-2">
                            <FikriAdCard
                              onDismiss={() =>
                                setDismissedAdIndexes(prev => new Set([...prev, assistantCount]))
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}

                {/*
                  Streaming / loading bubble.
                  Shown when:
                    - isStreaming: SSE is active, displaying live tokens
                    - isMsgFetching && streamingText: stream ended but query hasn't settled yet;
                      we keep the final streamed text visible to prevent any blank flash
                */}
                {(isStreaming || (isMsgFetching && streamingText)) && (
                  <div
                    dir="rtl"
                    className="rounded-2xl px-3 py-2 text-sm leading-relaxed text-right bg-muted text-foreground will-change-transform"
                  >
                    {streamingText ? (
                      <>
                        <MarkdownMessage content={streamingText} />
                        {isStreaming && (
                          <span className="inline-block w-0.5 h-4 bg-primary/70 animate-pulse ml-0.5 align-middle" />
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>يفكّر...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Error message */}
                {chatError && !isStreaming && (
                  <div
                    className="rounded-2xl px-3 py-2 text-sm leading-relaxed bg-destructive/10 border border-destructive/30 text-destructive"
                    data-testid="fikri-chat-error"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>⚠️ {chatError}</span>
                      <Button
                        size="icon" variant="ghost"
                        className="h-5 w-5 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => setChatError(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="flex gap-2 border-t border-white/20 p-3 shrink-0 items-end">
              <Button
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
                size="icon"
                className="shrink-0"
                data-testid="button-send-fikri"
              >
                {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize(); }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="اسأل فكري..."
                rows={1}
                className="flex-1 resize-none rounded-md border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto"
                style={{ minHeight: "36px", maxHeight: "160px" }}
                data-testid="input-fikri-message"
              />
            </div>
          </>
        )}
      </aside>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={o => { if (!o) setDeleteConfirmId(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المحادثة</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId) deleteConversationMutation.mutate(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
