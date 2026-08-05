import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Loader2,
  RotateCcw,
  Copy,
  Check,
  Bot,
  User,
} from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  'اشرح لي كيف تعمل الشبكات العصبية',
  'اكتب لي قصيدة عن الذكاء الاصطناعي',
  'ما هي أفضل ممارسات تصميم الواجهات؟',
  'ساعدني في كتابة وصف احترافي لصورة',
];

export function ChatView() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json() as { ok: boolean; reply?: string; error?: string };

      if (!data.ok) {
        toast({ title: 'فشل الإرسال', description: data.error ?? 'خطأ غير معروف', variant: 'destructive' });
        // Remove the user message on failure
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        return;
      }

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply ?? '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      toast({ title: 'خطأ', description: String(err), variant: 'destructive' });
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard?.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleClear = () => {
    setMessages([]);
    setInput('');
  };

  return (
    <PageContainer>
      <PageHeader
        title="AI Chat"
        description="تحدث مع GPT-4o Mini"
        icon={MessageSquare}
        actions={
          messages.length > 0 ? (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              محادثة جديدة
            </button>
          ) : undefined
        }
      />

      {/* Chat area */}
      <div className="mt-6 flex flex-col" style={{ height: 'calc(100vh - 260px)', minHeight: 400 }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 pb-4 pr-1">
          {messages.length === 0 ? (
            /* Empty state with suggested prompts */
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center gap-6 py-12"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card/60">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-semibold">GPT-4o Mini</h3>
                <p className="mt-1 text-sm text-muted-foreground">اسألني أي شيء، أنا هنا للمساعدة</p>
              </div>
              <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="rounded-xl border border-border bg-card/40 px-4 py-3 text-right text-sm text-muted-foreground transition-all hover:border-primary/30 hover:bg-card hover:text-foreground"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'group flex gap-3',
                    msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border',
                      msg.role === 'user'
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    {msg.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={cn(
                      'relative max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'rounded-tr-sm bg-primary/10 text-foreground'
                        : 'rounded-tl-sm border border-border bg-card/60 text-foreground',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <div
                      className={cn(
                        'mt-1.5 flex items-center gap-2',
                        msg.role === 'user' ? 'justify-end' : 'justify-start',
                      )}
                    >
                      <span className="text-[10px] text-muted-foreground/60">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        title="Copy"
                      >
                        {copiedId === msg.id ? (
                          <Check className="h-3 w-3 text-primary" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* Typing indicator */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-card/60 px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="mt-4 flex items-end gap-3 rounded-2xl border border-border bg-card/60 p-3 backdrop-blur-sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك هنا... (Enter للإرسال، Shift+Enter لسطر جديد)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60"
            style={{ maxHeight: 160 }}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
              input.trim() && !isLoading
                ? 'gradient-amber text-black hover:glow-amber'
                : 'bg-secondary text-muted-foreground cursor-not-allowed',
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/50">
          Powered by GPT-4o Mini · viscodev.x10.mx
        </p>
      </div>
    </PageContainer>
  );
}
