import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  RotateCcw,
  Sparkles,
  Code2,
  Zap,
  Globe,
} from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/* ── Custom PNG icon component ──────────────────────────────────── */
function Icon({
  src,
  size = 16,
  className,
  invert = true,
}: {
  src: string;
  size?: number;
  className?: string;
  invert?: boolean;
}) {
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0 select-none', invert && 'invert opacity-70', className)}
      draggable={false}
    />
  );
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  { icon: Sparkles, text: 'اشرح لي كيف تعمل الشبكات العصبية' },
  { icon: Code2,    text: 'اكتب لي كود Python لفرز قائمة' },
  { icon: Globe,    text: 'ما هي أفضل ممارسات تصميم الواجهات؟' },
  { icon: Zap,      text: 'ساعدني في كتابة وصف احترافي لصورة' },
];

/* ── Code Block ─────────────────────────────────────────────────── */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-border bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <span className="font-mono text-[11px] text-muted-foreground/70">{lang || 'code'}</span>
        <button
          onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          {copied
            ? <Icon src="/icons/checked.png" size={12} />
            : <Icon src="/icons/copy.png" size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-[#e6edf3]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```')) {
      const lines = part.slice(3, -3).split('\n');
      const lang = lines[0].trim();
      const code = lines.slice(1).join('\n').trim();
      return <CodeBlock key={i} code={code} lang={lang} />;
    }
    return (
      <span key={i}>
        {part.split('\n').map((line, li, arr) => {
          const formatted = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((seg, si) => {
            if (seg.startsWith('**') && seg.endsWith('**'))
              return <strong key={si} className="font-semibold text-foreground">{seg.slice(2, -2)}</strong>;
            if (seg.startsWith('`') && seg.endsWith('`'))
              return <code key={si} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-primary">{seg.slice(1, -1)}</code>;
            return <span key={si}>{seg}</span>;
          });
          return <span key={li}>{formatted}{li < arr.length - 1 && <br />}</span>;
        })}
      </span>
    );
  });
}

/* ── Typing Effect ──────────────────────────────────────────────── */
function TypingMessage({ content }: { content: string }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed(''); setDone(false);
    let i = 0;
    const iv = setInterval(() => {
      i += 4;
      setDisplayed(content.slice(0, i));
      if (i >= content.length) { setDisplayed(content); setDone(true); clearInterval(iv); }
    }, 12);
    return () => clearInterval(iv);
  }, [content]);
  return (
    <span className="text-sm leading-relaxed break-words">
      {renderContent(displayed)}
      {!done && <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse rounded-full bg-primary align-middle" />}
    </span>
  );
}

/* ── Message bubble ─────────────────────────────────────────────── */
function MessageBubble({
  msg, isLatest, onCopy, copiedId,
}: {
  msg: Message; isLatest: boolean; onCopy: (id: string, c: string) => void; copiedId: string | null;
}) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={cn('group flex items-end gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div className={cn(
        'mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2',
        isUser ? 'bg-primary ring-primary/20 text-black' : 'bg-card ring-border text-muted-foreground',
      )}>
        {isUser
          ? <Icon src="/icons/user.png" size={14} invert={false} className="opacity-80" />
          : <Icon src="/icons/bot.png" size={14} invert={false} className="opacity-80" />
        }
      </div>

      {/* Bubble */}
      <div className={cn('flex max-w-[78%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 shadow-sm',
          isUser
            ? 'rounded-br-sm bg-primary/15 text-foreground ring-1 ring-primary/20'
            : 'rounded-bl-sm border border-border/80 bg-card text-foreground',
        )}>
          {isUser
            ? <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
            : isLatest
              ? <TypingMessage content={msg.content} />
              : <div className="text-sm leading-relaxed break-words">{renderContent(msg.content)}</div>
          }
        </div>

        {/* Meta + actions */}
        <div className={cn('flex items-center gap-1 px-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100', isUser ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-[10px] text-muted-foreground/50 mx-1">
            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={() => onCopy(msg.id, msg.content)} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-foreground" title="Copy">
            {copiedId === msg.id
              ? <Icon src="/icons/checked.png" size={12} />
              : <Icon src="/icons/copy.png" size={12} />}
          </button>
          {!isUser && (<>
            <button className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-secondary" title="Like"><Icon src="/icons/like.png" size={12} /></button>
            <button className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-secondary" title="Dislike"><Icon src="/icons/dont-like.png" size={12} /></button>
            <button className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-secondary" title="History"><Icon src="/icons/history.png" size={12} /></button>
          </>)}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */
export function ChatView() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [latestId, setLatestId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: trimmed, timestamp: new Date() };
    setMessages(p => [...p, userMsg]);
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
        toast({ title: 'تعذّر الاتصال', description: 'الخدمة غير متاحة حالياً، يرجى المحاولة لاحقاً.', variant: 'destructive' });
        setMessages(p => p.filter(m => m.id !== userMsg.id));
        return;
      }

      const aMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', content: data.reply ?? '', timestamp: new Date() };
      setMessages(p => [...p, aMsg]);
      setLatestId(aMsg.id);
    } catch (err) {
      toast({ title: 'خطأ', description: String(err), variant: 'destructive' });
      setMessages(p => p.filter(m => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard?.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleClear = () => { setMessages([]); setInput(''); setLatestId(null); };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
      {/* Header */}
      <PageContainer>
        <PageHeader
          title="AI Chat"
          description="تحدث مع GPT-4o Mini"
          icon={MessageSquare}
          actions={
            messages.length > 0 ? (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-card hover:text-foreground"
              >
                <Icon src="/icons/plus.png" size={12} />
                محادثة جديدة
              </button>
            ) : undefined
          }
        />

        {/* Chat container */}
        <div className="mt-4 flex flex-col" style={{ height: 'calc(100vh - 240px)', minHeight: 400 }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-5 pb-4 pr-1">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex h-full flex-col items-center justify-center gap-8 py-8"
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card shadow-lg">
                    <Icon src="/icons/bot.png" size={40} invert={false} className="opacity-80" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary">
                    <Icon src="/icons/checked.png" size={12} invert={false} className="brightness-0" />
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold tracking-tight">مرحباً! كيف يمكنني مساعدتك؟</h2>
                  <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                    مدعوم بـ GPT-4o Mini — اسألني أي شيء
                  </p>
                </div>

                <div className="grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SUGGESTED_PROMPTS.map(({ icon: Icon, text }) => (
                    <motion.button
                      key={text}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => sendMessage(text)}
                      className="group flex items-start gap-3 rounded-2xl border border-border bg-card/50 px-4 py-3.5 text-right text-sm text-muted-foreground transition-all hover:border-primary/30 hover:bg-card hover:text-foreground hover:shadow-sm"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary/60 transition-colors group-hover:text-primary" />
                      <span className="leading-relaxed">{text}</span>
                    </motion.button>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground/40">
                  Enter للإرسال · Shift+Enter لسطر جديد
                </p>
              </motion.div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isLatest={msg.id === latestId && msg.role === 'assistant'}
                    onCopy={handleCopy}
                    copiedId={copiedId}
                  />
                ))}
              </AnimatePresence>
            )}

            {/* Typing indicator */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-end gap-3"
                >
                  <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card ring-2 ring-border">
                    <Icon src="/icons/bot.png" size={14} invert={false} className="opacity-70" />
                  </div>
                  <div className="rounded-2xl rounded-bl-sm border border-border/80 bg-card px-5 py-3.5 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                      <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:160ms]" />
                      <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:320ms]" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="mt-3 shrink-0">
            <div className={cn(
              'flex items-end gap-3 rounded-2xl border bg-card/80 px-4 py-3 shadow-sm transition-all duration-200',
              input ? 'border-primary/40' : 'border-border hover:border-border/80',
            )}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب رسالتك هنا..."
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
                style={{ maxHeight: 180 }}
              />
            <div className="flex items-end gap-2">
              <button className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/50 transition-colors hover:border-primary/30 hover:bg-secondary" title="Attach">
                <Icon src="/icons/attach.png" size={16} />
              </button>
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className={cn(
                  'mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200',
                  input.trim() && !isLoading
                    ? 'gradient-amber text-black shadow-sm hover:glow-amber hover:scale-105'
                    : 'cursor-not-allowed bg-secondary opacity-50',
                )}
              >
                <Icon src="/icons/mic.png" size={16} invert={false} className={cn(input.trim() && !isLoading ? 'brightness-0' : 'opacity-30')} />
              </motion.button>
            </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground/35">
              Powered by GPT-4o Mini · viscodev.x10.mx
            </p>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
