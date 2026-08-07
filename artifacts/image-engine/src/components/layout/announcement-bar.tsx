import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Sparkles, Zap, Star, Bell, Megaphone, Rocket, Gift } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface BannerConfig {
  enabled: boolean;
  text: string;
  cta_text: string;
  cta_url: string;
  icon: string;
  color: 'amber' | 'blue' | 'green' | 'rose' | 'violet' | 'cyan';
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  zap: Zap,
  star: Star,
  bell: Bell,
  megaphone: Megaphone,
  rocket: Rocket,
  gift: Gift,
};

const COLOR_MAP: Record<BannerConfig['color'], { bar: string; badge: string; cta: string; dot: string }> = {
  amber:  { bar: 'from-amber-500/15 via-orange-500/10 to-amber-500/15',  badge: 'bg-amber-500/20 text-amber-300',  cta: 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30',  dot: 'bg-amber-400' },
  blue:   { bar: 'from-blue-500/15 via-indigo-500/10 to-blue-500/15',    badge: 'bg-blue-500/20 text-blue-300',    cta: 'bg-blue-500/20 text-blue-200 hover:bg-blue-500/30',    dot: 'bg-blue-400' },
  green:  { bar: 'from-emerald-500/15 via-green-500/10 to-emerald-500/15', badge: 'bg-emerald-500/20 text-emerald-300', cta: 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30', dot: 'bg-emerald-400' },
  rose:   { bar: 'from-rose-500/15 via-pink-500/10 to-rose-500/15',      badge: 'bg-rose-500/20 text-rose-300',    cta: 'bg-rose-500/20 text-rose-200 hover:bg-rose-500/30',    dot: 'bg-rose-400' },
  violet: { bar: 'from-violet-500/15 via-purple-500/10 to-violet-500/15', badge: 'bg-violet-500/20 text-violet-300', cta: 'bg-violet-500/20 text-violet-200 hover:bg-violet-500/30', dot: 'bg-violet-400' },
  cyan:   { bar: 'from-cyan-500/15 via-teal-500/10 to-cyan-500/15',      badge: 'bg-cyan-500/20 text-cyan-300',    cta: 'bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30',    dot: 'bg-cyan-400' },
};

const DISMISS_KEY = 'ie_banner_dismissed';

export function AnnouncementBar() {
  const [config, setConfig] = useState<BannerConfig | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    supabase
      .from('banner_config')
      .select('*')
      .eq('id', 'main')
      .maybeSingle()
      .then(({ data }) => {
        if (!data || !data.enabled) return;
        const dismissedText = window.sessionStorage.getItem(DISMISS_KEY);
        if (dismissedText === data.text) return;
        setConfig(data as BannerConfig);
        setVisible(true);
      });
  }, []);

  const dismiss = () => {
    setVisible(false);
    if (config) window.sessionStorage.setItem(DISMISS_KEY, config.text);
  };

  const colors = config ? COLOR_MAP[config.color] ?? COLOR_MAP.amber : COLOR_MAP.amber;
  const Icon = config ? (ICON_MAP[config.icon] ?? Sparkles) : Sparkles;

  return (
    <AnimatePresence>
      {visible && config && (
        <motion.div
          initial={{ opacity: 0, y: -40, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className={cn('relative overflow-hidden bg-gradient-to-r border-b border-white/5 backdrop-blur-sm', colors.bar)}>
            {/* Shimmer effect */}
            <span className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer-slow-banner bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2 sm:px-6">

              {/* Left spacer (mirrors close button) */}
              <div className="hidden w-7 shrink-0 sm:block" />

              {/* Content */}
              <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5 sm:gap-3">
                {/* Icon badge */}
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', colors.badge)}>
                  <Icon className="h-3.5 w-3.5" />
                </span>

                {/* Live dot */}
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', colors.dot)} />
                  <span className={cn('relative inline-flex h-2 w-2 rounded-full', colors.dot)} />
                </span>

                {/* Text */}
                <p className="truncate text-xs font-medium text-white/90 sm:text-sm">
                  {config.text}
                </p>

                {/* CTA */}
                {config.cta_text && config.cta_url && (
                  <a
                    href={config.cta_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all sm:flex',
                      colors.cta,
                    )}
                  >
                    {config.cta_text}
                    <ArrowRight className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Close */}
              <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/50 transition-all hover:bg-white/10 hover:text-white/90"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
