import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Copy,
  Check,
  Bot,
  User,
  Plus,
  MoreVertical,
  Mic,
  Paperclip,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Share,
  Download,
  Code2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface HistoryItem {
  id: string;
  label: string;
  date: 'today' | '5days' | '7days';
}

const HISTORY_ITEMS: HistoryItem[] = [
  { id: 'h1', label: 'كيف يمكنني تحسين تصميم الواجهة؟', date: 'today' },
  { id: 'h2', label: 'اشرح لي مفهوم الشبكات العصبية', date: 'today' },
  { id: 'h3', label: 'ما هي أفضل لغات البرمجة؟', date: 'today' },
  { id: 'h4', label: 'كيف أكتب كود Python نظيف؟', date: 'today' },
  { id: 'h5', label: 'نصائح لتحسين الأداء في React', date: 'today' },
  { id: 'h6', label: 'ما الفرق بين AI و Machine Learning؟', date: '5days' },
  { id: 'h7', label: 'كيف أبدأ مشروع TypeScript؟', date: '5days' },
  { id: 'h8', label: 'اشرح Docker بشكل مبسط', date: '5days' },
  { id: 'h9', label: 'ما هي أفضل ممارسات REST API؟', date: '7days' },
  { id: 'h10', label: 'كيف أتعلم الذكاء الاصطناعي؟', date: '7days' },
  { id: 'h11', label: 'مقارنة بين SQL و NoSQL', date: '7days' },
];

/* ── Code Block ─────────────────────────────────────────────────── */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/10 bg-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-[11px] text-white/40">{lang || 'code'}</span>
        <button
          onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Code2 className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-green-300/90">
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
              return <strong key={si} className="font-semibold">{seg.slice(2, -2)}</strong>;
            if (seg.startsWith('`') && seg.endsWith('`'))
              return <code key={si} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-green-300">{seg.slice(1, -1)}</code>;
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
      i += 5;
      setDisplayed(content.slice(0, i));
      if (i >= content.length) { setDisplayed(content); setDone(true); clearInterval(iv); }
    }, 10);
    return () => clearInterval(iv);
  }, [content]);
  return (
    <span className="text-sm leading-relaxed break-words">
      {renderContent(displayed)}
      {!done && <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse rounded-full bg-green-400 align-middle" />}
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
      className={cn('group flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div className={cn(
        'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1',
        isUser ? 'bg-green-500/20 ring-green-500/30' : 'bg-[#1a2a1a] ring-green-900/50',
      )}>
        {isUser
          ? <User className="h-3.5 w-3.5 text-green-400" />
          : <div className="h-4 w-4 rounded-full border border-green-500/60 bg-green-500/20 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            </div>
        }
      </div>

      {/* Content */}
      <div className={cn('flex max-w-[72%] flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'rounded-tr-sm bg-green-500/15 text-white/90 ring-1 ring-green-500/20'
            : 'rounded-tl-sm bg-[#0f1f0f]/80 text-white/85 ring-1 ring-green-900/30 backdrop-blur-sm',
        )}>
          {isUser
            ? <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            : isLatest
              ? <TypingMessage content={msg.content} />
              : <div className="whitespace-pre-wrap break-words">{renderContent(msg.content)}</div>
          }
        </div>

        {/* Action row */}
        <div className={cn('flex items-center gap-1 px-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100', isUser ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-[10px] text-white/25 mr-1">
            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {[
            { icon: copiedId === msg.id ? Check : Copy, label: 'Copy', action: () => onCopy(msg.id, msg.content) },
            ...(!isUser ? [
              { icon: ThumbsUp,  label: 'Like',     action: () => {} },
              { icon: ThumbsDown, label: 'Dislike', action: () => {} },
              { icon: Share,     label: 'Share',    action: () => {} },
              { icon: Download,  label: 'Save',     action: () => {} },
              { icon: RotateCcw, label: 'Retry',    action: () => {} },
            ] : []),
          ].map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={action}
              title={label}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
            >
              <Icon className="h-3 w-3" />
            </button>
          ))}
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
  const [historyOpen, setHistoryOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
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
        toast({ title: 'تعذّر الاتصال', description: 'الخدمة غير متاحة حالياً', variant: 'destructive' });
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

  const historyGroups = [
    { label: 'Today',    items: HISTORY_ITEMS.filter(h => h.date === 'today') },
    { label: '5 Days Ago', items: HISTORY_ITEMS.filter(h => h.date === '5days') },
    { label: '7 Days Ago', items: HISTORY_ITEMS.filter(h => h.date === '7days') },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#080f08]">
      {/* ── Main chat panel ── */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Ambient background */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-900/20 blur-[120px]" />
          <div className="absolute right-0 bottom-0 h-[300px] w-[300px] rounded-full bg-green-800/10 blur-[100px]" />
        </div>

        {/* Header */}
        <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/5 bg-black/20 px-5 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
              <Bot className="h-4 w-4 text-green-400" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#080f08] bg-green-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-white/90">AI Chat</span>
              <span className="ml-2 text-[10px] text-white/30">GPT-4o Mini</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/40 transition-all hover:border-green-500/30 hover:text-white/70"
              >
                <Plus className="h-3 w-3" />
                New Chat
              </button>
            )}
            <button
              onClick={() => setHistoryOpen(v => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/40 transition-colors hover:border-green-500/30 hover:text-white/70"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="relative z-10 flex-1 overflow-y-auto scrollbar-thin px-5 py-6 space-y-5">
          {messages.length === 0 ? (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex h-full flex-col items-center justify-center gap-8 pb-16"
            >
              {/* Orb */}
              <div className="relative flex h-24 w-24 items-center justify-center">
                <div className="absolute h-24 w-24 rounded-full border border-green-500/20 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="absolute h-20 w-20 rounded-full border border-green-500/30 animate-pulse" />
                <div className="absolute h-16 w-16 rounded-full bg-green-900/40 blur-sm" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-green-500/40 bg-gradient-to-br from-green-900/60 to-green-800/30 shadow-lg shadow-green-900/50">
                  <Bot className="h-6 w-6 text-green-400" />
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-2xl font-bold text-white/90">
                  كيف يمكنني مساعدتك؟
                </h2>
                <p className="mt-2 text-sm text-white/35">
                  اسألني أي شيء — أنا هنا للمساعدة
                </p>
              </div>

              {/* Suggested */}
              <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  'اشرح لي كيف تعمل الشبكات العصبية',
                  'اكتب كود Python لفرز قائمة',
                  'ما أفضل ممارسات تصميم الواجهات؟',
                  'ساعدني في كتابة وصف احترافي',
                ].map((p) => (
                  <motion.button
                    key={p}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => sendMessage(p)}
                    className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-right text-sm text-white/50 backdrop-blur-sm transition-all hover:border-green-500/25 hover:bg-green-900/20 hover:text-white/80"
                  >
                    {p}
                  </motion.button>
                ))}
              </div>
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
                className="flex items-end gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a2a1a] ring-1 ring-green-900/50">
                  <div className="h-4 w-4 rounded-full border border-green-500/60 bg-green-500/20 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  </div>
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-[#0f1f0f]/80 px-5 py-3.5 ring-1 ring-green-900/30 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500/60 animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-green-500/60 animate-bounce [animation-delay:160ms]" />
                    <span className="h-2 w-2 rounded-full bg-green-500/60 animate-bounce [animation-delay:320ms]" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input area ── */}
        <div className="relative z-10 shrink-0 border-t border-white/5 bg-black/30 px-5 py-4 backdrop-blur-md">
          <div className={cn(
            'flex flex-col gap-2 rounded-2xl border bg-[#0a160a]/80 px-4 py-3 backdrop-blur-sm transition-all duration-200',
            input ? 'border-green-500/30 shadow-lg shadow-green-900/20' : 'border-white/8 hover:border-white/12',
          )}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or make a request."
              rows={1}
              disabled={isLoading}
              className="w-full resize-none bg-transparent text-sm leading-relaxed text-white/80 outline-none placeholder:text-white/25 disabled:opacity-40"
              style={{ maxHeight: 160 }}
            />
            <div className="flex items-center justify-between">
              {/* Left actions */}
              <div className="flex items-center gap-1">
                <button className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/5 hover:text-white/60">
                  <Paperclip className="h-3.5 w-3.5" />
                </button>
                <button className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/5 hover:text-white/60">
                  <Code2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Right actions */}
              <div className="flex items-center gap-2">
                <button className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/5 hover:text-white/60">
                  <Mic className="h-3.5 w-3.5" />
                </button>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200',
                    input.trim() && !isLoading
                      ? 'bg-green-500 text-black shadow-md shadow-green-900/50 hover:bg-green-400 hover:shadow-green-500/30'
                      : 'cursor-not-allowed bg-white/5 text-white/20',
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-white/15">
            Powered by GPT-4o Mini · viscodev.x10.mx
          </p>
        </div>
      </div>

      {/* ── History sidebar ── */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="hidden shrink-0 flex-col overflow-hidden border-l border-white/5 bg-[#050d05]/90 backdrop-blur-md lg:flex"
            style={{ width: 280 }}
          >
            {/* History header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3.5">
              <span className="text-sm font-semibold text-white/80">History Chat</span>
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/40 transition-all hover:border-green-500/30 hover:text-white/70"
              >
                <Plus className="h-3 w-3" />
                New Chat
              </button>
            </div>

            {/* History list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-4">
              {historyGroups.map(({ label, items }) => (
                <div key={label}>
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                    {label}
                  </p>
                  <div className="space-y-0.5">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => sendMessage(item.label)}
                        className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-white/45 transition-all hover:bg-green-900/20 hover:text-white/75"
                      >
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/8 bg-white/4 transition-colors group-hover:border-green-500/25 group-hover:bg-green-900/30">
                          <Bot className="h-2.5 w-2.5 text-white/30 group-hover:text-green-400" />
                        </div>
                        <span className="line-clamp-1 flex-1">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
