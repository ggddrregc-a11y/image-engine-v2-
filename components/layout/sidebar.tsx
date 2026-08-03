'use client';

import {
  Sparkles,
  Images,
  History,
  FolderOpen,
  Workflow,
  Boxes,
  Code2,
  Shield,
  ChevronLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from './logo';
import { cn } from '@/lib/utils';
import { useApp } from '@/components/providers/app-provider';
import { t } from '@/lib/i18n';
import type { ViewId } from '@/lib/types';

const NAV_ITEMS: {
  id: ViewId;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}[] = [
  { id: 'generate', labelKey: 'sidebar.generate', icon: Sparkles },
  { id: 'gallery', labelKey: 'sidebar.gallery', icon: Images },
  { id: 'history', labelKey: 'sidebar.history', icon: History },
  { id: 'collections', labelKey: 'sidebar.collections', icon: FolderOpen },
  { id: 'workflows', labelKey: 'sidebar.workflows', icon: Workflow },
  { id: 'models', labelKey: 'sidebar.models', icon: Boxes },
  { id: 'api', labelKey: 'sidebar.api', icon: Code2 },
  { id: 'admin', labelKey: 'sidebar.admin', icon: Shield, badge: 'Admin' },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { activeView, setActiveView, locale } = useApp();

  return (
    <aside
      className={cn(
        'relative z-30 flex h-full flex-col border-r border-border bg-card/40 backdrop-blur-xl transition-[width] duration-300 ease-out',
        collapsed ? 'w-[76px]' : 'w-64',
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <Logo collapsed={collapsed} />
      </div>

      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = activeView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              )}
              title={collapsed ? t(locale, item.labelKey) : undefined}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl border border-primary/30 bg-primary/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              {active && (
                <motion.div
                  layoutId="sidebar-active-bar"
                  className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full gradient-amber"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <Icon
                className={cn(
                  'relative z-10 h-5 w-5 shrink-0 transition-colors',
                  active ? 'text-primary' : 'group-hover:text-foreground',
                )}
              />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="relative z-10 flex-1 text-left"
                  >
                    {t(locale, item.labelKey)}
                  </motion.span>
                )}
              </AnimatePresence>
              {!collapsed && item.badge && (
                <span className="relative z-10 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <ChevronLeft
            className={cn(
              'h-4 w-4 transition-transform duration-300',
              collapsed && 'rotate-180',
            )}
          />
          {!collapsed && <span>{t(locale, 'sidebar.collapse')}</span>}
        </button>
      </div>
    </aside>
  );
}
