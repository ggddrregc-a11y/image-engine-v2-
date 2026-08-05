import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  RotateCcw,
  Copy,
  Check,
  Bot,
  User,
  Sparkles,
  Code2,
  Zap,
  Globe,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  Share,
  Download,
  Paperclip,
  X,
  FileText,
} from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: { name: string; type: string; dataUrl: string }[];
}

interface ChatProviderOption {
  id: string;
  name: string;
  model_name: string;
  is_default?: boolean;
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
          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
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
        isUser ? 'bg-primary ring-primary/20' : 'bg-primary/10 ring-primary/30',
      )}>
        {isUser
          ? <User className="h-4 w-4 text-black" />
          : <Bot className="h-4 w-4 text-primary" />
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
          {/* Attachments */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {msg.attachments.map((att, i) => (
                att.type.startsWith('image/') ? (
                  <img
                    key={i}
                    src={att.dataUrl}
                    alt={att.name}
                    className="max-h-48 max-w-[240px] rounded-xl object-cover border border-border/50"
                  />
                ) : (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs">
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="max-w-[160px] truncate">{att.name}</span>
                  </div>
                )
              ))}
            </div>
          )}
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
            {copiedId === msg.id ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
          </button>
          {!isUser && (<>
            <button className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-foreground" title="Like"><ThumbsUp className="h-3 w-3" /></button>
            <button className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-foreground" title="Dislike"><ThumbsDown className="h-3 w-3" /></button>
            <button className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-foreground" title="Share"><Share className="h-3 w-3" /></button>
            <button className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-foreground" title="Save"><Download className="h-3 w-3" /></button>
          </>)}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Model Selector ─────────────────────────────────────────────── */
function ModelSelector({
  providers,
  selectedId,
  onSelect,
}: {
  providers: ChatProviderOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = providers.find(p => p.id === selectedId) ?? providers[0];

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
      >
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15">
          <Bot className="h-2.5 w-2.5 text-primary" />
        </div>
        <span className="max-w-[140px] truncate">{selected?.name ?? 'اختر نموذج'}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
            >
              <div className="border-b border-border/50 px-4 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">النماذج المتاحة</p>
              </div>
              <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
                {providers.map(p => {
                  const isActive = p.id === selectedId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { onSelect(p.id); setOpen(false); }}
                      className={cn(
                        'group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                        isActive ? 'bg-primary/10' : 'hover:bg-secondary',
                      )}
                    >
                      <div className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
                        isActive ? 'border-primary/30 bg-primary/10' : 'border-border bg-secondary',
                      )}>
                        <img src="/icons/bot.png" alt="" width={14} height={14} className={cn('transition-opacity', isActive ? 'opacity-80' : 'opacity-40 group-hover:opacity-60')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium leading-tight', isActive ? 'text-primary' : 'text-foreground')}>
                          {p.name}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate">{p.model_name}</p>
                      </div>
                      {isActive && (
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */
const STORAGE_KEY = 'chat_messages';

export function ChatView() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved) as { id: string; role: string; content: string; timestamp: string }[];
      return parsed.map(m => ({ ...m, role: m.role as 'user' | 'assistant', timestamp: new Date(m.timestamp) }));
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [latestId, setLatestId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ChatProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('viscodev');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<{ name: string; type: string; dataUrl: string }[]>([]);

  // Fetch available providers
  useEffect(() => {
    fetch('/api/chat/providers')
      .then(r => r.json())
      .then((data: { ok: boolean; providers?: ChatProviderOption[] }) => {
        if (data.ok && data.providers && data.providers.length > 0) {
          setProviders(data.providers);
          const def = data.providers.find(p => p.is_default) ?? data.providers[0];
          setSelectedProviderId(def.id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Save messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* quota exceeded */ }
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachments(prev => [...prev, {
          name: file.name,
          type: file.type,
          dataUrl: e.target?.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || isLoading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, providerId: selectedProviderId }),
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
  }, [isLoading, toast, selectedProviderId, attachments]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard?.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleClear = () => {
    setMessages([]);
    setInput('');
    setLatestId(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
      <PageContainer>
        <PageHeader
          title="AI Chat"
          description="تحدث مع الذكاء الاصطناعي"
          icon={MessageSquare}
          actions={
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-card hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" />
                  محادثة جديدة
                </button>
              )}
            </div>
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
                {/* Avatar with bot icon + checked */}
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 shadow-lg">
                    <Bot className="h-10 w-10 text-primary" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary">
                    <img src="/icons/checked.png" alt="online" width={12} height={12} className="brightness-0" />
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold tracking-tight">مرحباً! كيف يمكنني مساعدتك؟</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    اسألني أي شيء، أنا هنا للمساعدة
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
                  <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/30">
                    <Bot className="h-4 w-4 text-primary" />
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
              'rounded-2xl border bg-card/80 shadow-sm transition-all duration-200',
              input ? 'border-primary/40' : 'border-border hover:border-border/80',
            )}>
              {/* Textarea */}
              <div className="flex items-end gap-3 px-4 pt-3 pb-2">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.txt,.doc,.docx"
                  className="hidden"
                  onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
                />
                {/* Paperclip button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-all hover:border-primary/30 hover:bg-secondary hover:text-foreground disabled:opacity-40"
                  title="إرفاق ملف أو صورة"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
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
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={() => sendMessage(input)}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  className={cn(
                    'mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200',
                    (input.trim() || attachments.length > 0) && !isLoading
                      ? 'gradient-amber text-black shadow-sm hover:glow-amber hover:scale-105'
                      : 'cursor-not-allowed bg-secondary text-muted-foreground opacity-50',
                  )}
                >
                  <Send className="h-4 w-4" />
                </motion.button>
              </div>

              {/* Attachments preview */}
              <AnimatePresence>
                {attachments.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-wrap gap-2 overflow-hidden border-t border-border/50 px-4 py-2"
                  >
                    {attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-2 py-1.5">
                        {att.type.startsWith('image/') ? (
                          <img src={att.dataUrl} alt={att.name} className="h-8 w-8 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <span className="max-w-[100px] truncate text-[11px] text-muted-foreground">{att.name}</span>
                        <button
                          onClick={() => removeAttachment(i)}
                          className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Model selector bar */}
              {providers.length > 0 && (
                <div className="border-t border-border/50 px-3 py-2">
                  <ModelSelector
                    providers={providers}
                    selectedId={selectedProviderId}
                    onSelect={setSelectedProviderId}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
