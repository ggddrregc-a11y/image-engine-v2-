
import {
  Bell,
  Search,
  Menu,
  ChevronDown,
  Sun,
  Moon,
  Zap,
  User,
  CreditCard,
  KeyRound,
  BellRing,
  Shield,
  Palette,
  Globe,
  LifeBuoy,
  BookOpen,
  LogOut,
  Settings,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/components/providers/app-provider';
import { useAdminAuth } from '@/components/providers/admin-auth-provider';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { t } from '@/lib/i18n';

const PROFILE_FOOTER = [
  { icon: LifeBuoy, labelKey: 'topbar.support' },
  { icon: BookOpen, labelKey: 'topbar.documentation' },
] as const;

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { setActiveView, locale } = useApp();
  const [wsOpen, setWsOpen] = useState(false);
  const [wsIndex, setWsIndex] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { logout: adminLogout } = useAdminAuth();
  const profileRef = useRef<HTMLDivElement>(null);

  const WORKSPACES = [
    t(locale, 'workspace.personal'),
    t(locale, 'workspace.acme'),
    t(locale, 'workspace.design'),
  ];

  const PROFILE_MENU = [
    { icon: User, label: t(locale, 'profile.myProfile'), view: 'settings' as const },
    { icon: CreditCard, label: t(locale, 'profile.billing'), view: 'settings' as const },
    { icon: KeyRound, label: t(locale, 'profile.apiKeys'), view: 'api' as const },
    { icon: BellRing, label: t(locale, 'profile.notifications'), view: 'settings' as const },
    { icon: Shield, label: t(locale, 'profile.security'), view: 'settings' as const },
    { icon: Palette, label: t(locale, 'profile.appearance'), view: 'settings' as const },
    { icon: Globe, label: t(locale, 'profile.language'), view: 'settings' as const },
  ] as const;

  // Close profile menu on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/70 px-3 backdrop-blur-xl sm:gap-3 sm:px-4 md:px-6">
      <button
        onClick={onMenu}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Workspace selector */}
      <div className="relative shrink-0">
        <button
          onClick={() => setWsOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-border bg-card/50 px-2.5 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-card sm:px-3"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-lg gradient-amber text-xs font-bold text-black">
            {WORKSPACES[wsIndex][0]}
          </span>
          <span className="hidden md:inline">{WORKSPACES[wsIndex]}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
        <AnimatePresence>
          {wsOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setWsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-2xl"
              >
                {WORKSPACES.map((ws, i) => (
                  <button
                    key={ws}
                    onClick={() => {
                      setWsIndex(i);
                      setWsOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      i === wsIndex
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-secondary',
                    )}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-secondary text-xs font-bold">
                      {ws[0]}
                    </span>
                    {ws}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Search */}
      <div className="relative ml-auto hidden max-w-md flex-1 xs:block sm:flex md:max-w-xs lg:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder={t(locale, 'topbar.searchPlaceholder')}
          className="h-9 w-full rounded-xl border border-border bg-card/50 pl-9 pr-16 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:bg-card"
        />
        <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:block">
          {t(locale, 'settings.searchShortcut')}
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5 md:ml-3">
        {/* Credits */}
        <div className="hidden items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2 lg:flex">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">842</span>
          <span className="text-xs text-muted-foreground">{t(locale, 'topbar.credits')}</span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Toggle theme"
        >
          <Sun className="h-5 w-5 dark:hidden" />
          <Moon className="hidden h-5 w-5 dark:block" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          </button>
          <AnimatePresence>
            {notifOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setNotifOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-sm font-semibold">Notifications</span>
                    <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      3 new
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto scrollbar-thin">
                    {[
                      {
                        title: 'Generation complete',
                        desc: 'Your image "Cinematic Portrait" is ready',
                        time: '2m ago',
                      },
                      {
                        title: 'New model available',
                        desc: 'Lumen-XL v2.1 has been updated',
                        time: '1h ago',
                      },
                      {
                        title: 'Credits refilled',
                        desc: '500 credits added to your account',
                        time: '3h ago',
                      },
                    ].map((n, i) => (
                      <div
                        key={i}
                        className="flex gap-3 border-b border-border/50 px-4 py-3 transition-colors hover:bg-secondary/40"
                      >
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {n.desc}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {n.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Profile dropdown (replaces standalone Settings icon + old profile button) */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-2 transition-colors',
              profileOpen
                ? 'border-primary/40 bg-card'
                : 'border-border bg-card/50 hover:border-primary/40 hover:bg-card',
            )}
            aria-label="Open profile menu"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-amber text-xs font-bold text-black">
              AK
            </div>
            <div className="hidden text-left leading-none lg:block">
              <p className="text-xs font-semibold">Alex Kim</p>
              <p className="text-[10px] text-muted-foreground">Pro Plan</p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                profileOpen && 'rotate-180',
              )}
            />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
              >
                {/* User header */}
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-amber text-sm font-bold text-black">
                    AK
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">Alex Kim</p>
                    <p className="truncate text-xs text-muted-foreground">
                      alex@lumen.ai
                    </p>
                  </div>
                </div>

                {/* Main menu items */}
                <div className="p-1">
                  {PROFILE_MENU.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={() => {
                          setActiveView(item.view);
                          setProfileOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Footer items */}
                <div className="p-1">
                  {PROFILE_FOOTER.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.labelKey}
                        onClick={() => setProfileOpen(false)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {t(locale, item.labelKey)}
                      </button>
                    );
                  })}
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Sign out */}
                <div className="p-1">
                  <button
                    onClick={() => {
                      adminLogout();
                      setProfileOpen(false);
                      setActiveView('generate');
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

// Re-export Settings icon usage suppressed — it was removed from the top bar
// but we keep the import name available to avoid breaking tree-shaking if
// other files re-export from here. (Not actively used.)
export const _SettingsIcon = Settings;
