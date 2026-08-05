
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Palette,
  Bell,
  Shield,
  CreditCard,
  Globe,
  Check,
  LifeBuoy,
  BookOpen,
  ExternalLink,
  Lock,
  Ban,
  Database,
  Zap,
  Monitor,
  Sparkles,
  Pencil,
  Images,
  SlidersHorizontal,
  Languages,
  Brush,
  Waves,
  Leaf,
  Flower2,
  Bot,
  Star,
  Gem,
  Flame,
} from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useApp } from '@/components/providers/app-provider';
import { t } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const AVATARS = [
  { id: 'a1', bg: 'from-violet-500 to-purple-600', icon: Brush },
  { id: 'a2', bg: 'from-amber-400 to-orange-500', icon: Zap },
  { id: 'a3', bg: 'from-cyan-400 to-blue-500', icon: Waves },
  { id: 'a4', bg: 'from-emerald-400 to-green-500', icon: Leaf },
  { id: 'a5', bg: 'from-rose-400 to-pink-500', icon: Flower2 },
  { id: 'a6', bg: 'from-slate-400 to-gray-600', icon: Bot },
  { id: 'a7', bg: 'from-yellow-400 to-amber-500', icon: Star },
  { id: 'a8', bg: 'from-indigo-400 to-violet-500', icon: Sparkles },
  { id: 'a9', bg: 'from-teal-400 to-cyan-500', icon: Gem },
  { id: 'a10', bg: 'from-red-400 to-rose-500', icon: Flame },
];

import { SiTelegram, SiFacebook, SiX, SiInstagram, SiYoutube, SiLinkedin, SiDiscord } from 'react-icons/si';
import { Mail, Phone, Globe2 } from 'lucide-react';

const SUPPORT_ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  telegram: SiTelegram, facebook: SiFacebook, twitter: SiX, x: SiX,
  instagram: SiInstagram, youtube: SiYoutube, email: Mail, mail: Mail,
  website: Globe2, linkedin: SiLinkedin, discord: SiDiscord, phone: Phone,
};

function SupportLinkIcon({ icon }: { icon: string }) {
  const key = icon.toLowerCase().replace(/[^a-z]/g, '');
  const Icon = SUPPORT_ICON_MAP[key];
  if (Icon) return <Icon className="h-5 w-5 shrink-0 text-primary" size={20} />;
  return <Globe2 className="h-5 w-5 shrink-0 text-primary" />;
}

const SECTIONS = [
  { id: 'profile', labelKey: 'settings.section.profile', icon: User },
  { id: 'appearance', labelKey: 'settings.section.appearance', icon: Palette },
  { id: 'notifications', labelKey: 'settings.section.notifications', icon: Bell },
  { id: 'security', labelKey: 'settings.section.security', icon: Shield },
  { id: 'billing', labelKey: 'settings.section.billing', icon: CreditCard },
  { id: 'support', labelKey: 'settings.section.support', icon: LifeBuoy },
  { id: 'docs', labelKey: 'settings.section.docs', icon: BookOpen },
  { id: 'language', labelKey: 'settings.section.language', icon: Globe },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export function SettingsView({ initialSection }: { initialSection?: string }) {
  const [section, setSection] = useState<SectionId>((initialSection as SectionId) ?? 'profile');
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, avatarId, setAvatarId, credits, settingsSection, setSettingsSection } = useApp();
  const [selectedAvatar, setSelectedAvatar] = useState(avatarId);
  const [savedAvatar, setSavedAvatar] = useState(avatarId);
  const [supportLinks, setSupportLinks] = useState<{ id: string; label: string; url: string; icon: string }[]>([]);
  const [notifications, setNotifications] = useState({
    generationComplete: true,
    modelUpdates: true,
    creditAlerts: false,
    productNews: false,
  });

  useEffect(() => {
    if (initialSection) setSection(initialSection as SectionId);
  }, [initialSection]);

  // Respond to navigation from topbar dropdown
  useEffect(() => {
    if (settingsSection) {
      setSection(settingsSection as SectionId);
      setSettingsSection('');
    }
  }, [settingsSection, setSettingsSection]);

  useEffect(() => {
    supabase.from('support_links').select('*').order('sort_order').then(({ data }) => {
      if (data) setSupportLinks(data);
    });
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, 'settings.title')}
        description={t(locale, 'settings.description')}
        icon={Settings}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* Section nav */}
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  section === s.id
                    ? 'border border-primary/30 bg-primary/10 text-primary'
                    : 'border border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {t(locale, s.labelKey)}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card/40 p-6"
        >
          {section === 'profile' && (
            <div className="space-y-5">
              <h3 className="font-display text-lg font-bold">{t(locale, 'settings.section.profile')}</h3>

              {/* Current avatar */}
              <div className="flex items-center gap-4">
                <AvatarDisplay avatar={AVATARS.find((a) => a.id === savedAvatar)!} size="lg" />
                <div>
                  <p className="text-sm font-medium">Profile Avatar</p>
                  <p className="text-xs text-muted-foreground">Choose from the avatars below</p>
                </div>
              </div>

              {/* Avatar picker */}
              <div>
                <p className="mb-3 text-sm font-medium">Choose Avatar</p>
                <div className="flex flex-wrap gap-3">
                  {AVATARS.map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.id)}
                      className={cn(
                        'relative h-14 w-14 rounded-2xl transition-all',
                        selectedAvatar === avatar.id
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                          : 'opacity-70 hover:opacity-100 hover:scale-105',
                      )}
                    >
                      <AvatarDisplay avatar={avatar} size="md" />
                      {selectedAvatar === avatar.id && (
                        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3 w-3 text-black" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <Field label={t(locale, 'settings.profile.displayName')} value="Alex Kim" />
              <Field label={t(locale, 'settings.profile.email')} value="alex@lumen.ai" />
              <Field label={t(locale, 'settings.profile.username')} value="@alexkim" />
              <button
                onClick={() => {
                  setSavedAvatar(selectedAvatar);
                  setAvatarId(selectedAvatar);
                }}
                className="rounded-xl gradient-amber px-4 py-2.5 text-sm font-semibold text-black transition-all hover:glow-amber"
              >
                {t(locale, 'settings.profile.saveChanges')}
              </button>
            </div>
          )}

          {section === 'appearance' && (
            <div className="space-y-5">
              <h3 className="font-display text-lg font-bold">{t(locale, 'settings.section.appearance')}</h3>
              <div>
                <label className="mb-2 block text-sm font-medium">{t(locale, 'settings.appearance.theme')}</label>
                <div className="flex gap-3">
                  {(['dark', 'light'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium capitalize transition-all',
                        theme === t
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-card/40 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {theme === t && <Check className="h-4 w-4" />}
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">{t(locale, 'settings.appearance.accentColor')}</label>
                <div className="flex gap-3">
                  {['amber', 'blue', 'green', 'rose'].map((c) => (
                    <button
                      key={c}
                      className={cn(
                        'h-10 w-10 rounded-xl border-2 transition-all',
                        c === 'amber' ? 'border-primary' : 'border-transparent',
                      )}
                      style={{
                        background:
                          c === 'amber'
                            ? 'hsl(43 96% 56%)'
                            : c === 'blue'
                              ? 'hsl(217 91% 60%)'
                              : c === 'green'
                                ? 'hsl(142 71% 45%)'
                                : 'hsl(350 84% 60%)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <div className="space-y-5">
              <h3 className="font-display text-lg font-bold">{t(locale, 'settings.section.notifications')}</h3>
              {(
                [
                  ['generationComplete', 'Generation Complete', 'Get notified when your image is ready'],
                  ['modelUpdates', 'Model Updates', 'New model releases and updates'],
                  ['creditAlerts', 'Credit Alerts', 'Low credit balance warnings'],
                  ['productNews', 'Product News', 'Feature announcements and tips'],
                ] as const
              ).map(([key, label, desc]) => (
                <Toggle
                  key={key}
                  label={label}
                  desc={desc}
                  checked={notifications[key]}
                  onChange={(v) => setNotifications((prev) => ({ ...prev, [key]: v }))}
                />
              ))}
            </div>
          )}

          {section === 'security' && (
            <div className="space-y-5">
              <h3 className="font-display text-lg font-bold">{t(locale, 'settings.section.security')}</h3>

              {/* Security status */}
              <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15">
                  <Shield className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-success">Your session is secure</p>
                  <p className="text-xs text-muted-foreground">All data is encrypted and protected</p>
                </div>
              </div>

              {/* Security tips */}
              {[
                {
                  icon: Lock,
                  title: 'End-to-End Encryption',
                  desc: 'All images and prompts are transmitted over HTTPS with TLS 1.3 encryption.',
                },
                {
                  icon: Shield,
                  title: 'No Data Stored Permanently',
                  desc: 'Generated images are stored temporarily and never shared with third parties.',
                },
                {
                  icon: Database,
                  title: 'Local Storage Only',
                  desc: 'Your preferences (theme, avatar, credits) are saved only in your browser — never on a server.',
                },
                {
                  icon: Ban,
                  title: 'No Tracking',
                  desc: 'We do not use advertising trackers or sell your data to any third party.',
                },
                {
                  icon: Zap,
                  title: 'Secure API Connections',
                  desc: 'All AI generation requests are routed through our secure backend — your API keys are never exposed.',
                },
                {
                  icon: Monitor,
                  title: 'Browser Security',
                  desc: 'For best security, keep your browser up to date and avoid using shared or public devices.',
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 rounded-xl border border-border bg-card/40 p-4">
                  <item.icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}

              {/* Session info */}
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <p className="mb-3 text-sm font-semibold">Current Session</p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Browser</span>
                    <span className="font-medium text-foreground">{navigator.userAgent.split(' ').slice(-2).join(' ').split('/')[0]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Started</span>
                    <span className="font-medium text-foreground">{new Date().toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connection</span>
                    <span className="flex items-center gap-1 font-medium text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Encrypted (HTTPS)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'billing' && (
            <div className="space-y-5">
              <h3 className="font-display text-lg font-bold">{t(locale, 'settings.section.billing')}</h3>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">{t(locale, 'settings.billing.proPlan')}</p>
                    <p className="text-xs text-muted-foreground">{t(locale, 'settings.billing.planDetails')}</p>
                  </div>
                  <button className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary/70">
                    {t(locale, 'settings.billing.manage')}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card/40 p-4">
                  <p className="text-xs text-muted-foreground">{t(locale, 'settings.billing.creditsRemaining')}</p>
                  <p className="mt-1 font-display text-2xl font-bold">{credits}</p>
                </div>
                <div className="rounded-xl border border-border bg-card/40 p-4">
                  <p className="text-xs text-muted-foreground">{t(locale, 'settings.billing.nextRenewal')}</p>
                  <p className="mt-1 font-display text-2xl font-bold">Aug 15</p>
                </div>
              </div>
            </div>
          )}
          {section === 'support' && (
            <div className="space-y-5">
              <h3 className="font-display text-lg font-bold">Support</h3>
              <p className="text-sm text-muted-foreground">
                Need help? Reach us through any of the channels below.
              </p>
              {supportLinks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-muted-foreground">
                  <LifeBuoy className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No support links available yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {supportLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl border border-border bg-card/40 p-4 transition-all hover:border-primary/30 hover:bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <SupportLinkIcon icon={link.icon} />
                        <span className="text-sm font-medium">{link.label}</span>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'docs' && (
            <div className="space-y-5">
              <h3 className="font-display text-lg font-bold">Documentation</h3>
              <p className="text-sm text-muted-foreground">Learn how to get the most out of Image Engine.</p>
              {[
                {
                  icon: Sparkles,
                  title: 'Generate Images',
                  desc: 'Go to the Generate section, write a detailed prompt describing the image you want, choose your settings (model, aspect ratio, quality), then press Generate.',
                },
                {
                  icon: Pencil,
                  title: 'Edit Images',
                  desc: 'Go to the Editor section, upload any image, write a description of the change you want (e.g. "add a blue sky background"), then press Edit Image.',
                },
                {
                  icon: Zap,
                  title: 'Credits System',
                  desc: 'Every visitor starts with a set number of credits. Each generation or edit costs a certain amount. Credits are stored in your browser.',
                },
                {
                  icon: Images,
                  title: 'Gallery & History',
                  desc: 'All your generated images are saved in the Gallery. You can view, favorite, and download them from there.',
                },
                {
                  icon: SlidersHorizontal,
                  title: 'Advanced Settings',
                  desc: 'In the Generate section, expand "Generation Settings" to control steps, CFG scale, sampler, and batch count for fine-tuned results.',
                },
                {
                  icon: Languages,
                  title: 'Language',
                  desc: 'You can switch the interface language between English and Arabic from Settings → Language.',
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4 rounded-xl border border-border bg-card/40 p-4">
                  <item.icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {section === 'language' && (
            <div className="space-y-5">
              <h3 className="font-display text-lg font-bold">{t(locale, 'settings.section.language')}</h3>
              <p className="text-sm text-muted-foreground">{t(locale, 'settings.language.description')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['en', 'ar'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLocale(lang)}
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-sm font-medium transition-all',
                      locale === lang
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:bg-secondary/50 hover:text-foreground',
                    )}
                  >
                    {t(locale, lang === 'en' ? 'settings.language.english' : 'settings.language.arabic')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </PageContainer>
  );
}

function AvatarDisplay({ avatar, size = 'md' }: { avatar: typeof AVATARS[0]; size?: 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-16 w-16' : 'h-14 w-14';
  const iconClass = size === 'lg' ? 'h-7 w-7' : 'h-6 w-6';
  const Icon = avatar.icon;
  return (
    <div className={cn('flex items-center justify-center rounded-2xl bg-gradient-to-br', sizeClass, avatar.bg)}>
      <Icon className={cn(iconClass, 'text-white')} />
    </div>
  );
}

function Field({
  label,
  value,
  type = 'text',
}: {
  label: string;
  value: string;
  type?: string;
}) {
  const [v, setV] = useState(value);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-background/50 px-3 text-sm outline-none transition-colors focus:border-primary/40"
      />
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-secondary',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}
