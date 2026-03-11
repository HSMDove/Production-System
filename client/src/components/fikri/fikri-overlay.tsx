import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useFikriOverlay } from "@/contexts/fikri-overlay-context";

type Message = { role: "user" | "assistant"; content: string };

export function FikriOverlay() {
  const { open, setOpen } = useFikriOverlay();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "هلا! أنا فكري 👋 جاهز أساعدك بسرعة." },
  ]);
  const [input, setInput] = useState("");

  const sendMutation = useMutation({
    mutationFn: async (message: string) => apiRequest<{ answer: string }>("POST", "/api/assistant/chat", { message }),
    onSuccess: (res) => setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]),
    onError: () => setMessages((prev) => [...prev, { role: "assistant", content: "صار خطأ بسيط، جرّب مرة ثانية." }]),
  });

  const sendMessage = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    sendMutation.mutate(text);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160]" data-testid="fikri-overlay-root">
      <button
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        aria-label="close-fikri-overlay"
        onClick={() => setOpen(false)}
      />

      <aside className="absolute left-0 top-0 h-full w-full max-w-md glass-surface border-r border-white/10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <Bot className="h-4 w-4 text-primary" />
            فكري
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100%-8.5rem)] p-4">
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`rounded-2xl px-3 py-2 text-sm ${m.role === "assistant" ? "bg-white/10" : "bg-primary/25"}`}
              >
                {m.content}
              </div>
            ))}
            {sendMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                فكري يفكّر...
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 border-t border-white/10 p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="اسأل فكري..."
          />
          <Button onClick={sendMessage}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </aside>
    </div>
  );
}
