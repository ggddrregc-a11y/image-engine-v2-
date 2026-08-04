
import { useState } from 'react';
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
} from 'lucide-react';
import { PageContainer, PageHeader } from './shared';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useApp } from '@/components/providers/app-provider';
import { t } from '@/lib/i18n';

const AVATARS = [
  { id: 'a1', bg: 'from-violet-500 to-purple-600', initials: '🎨' },
  { id: 'a2', bg: 'from-amber-400 to-orange-500', initials: '⚡' },
  { id: 'a3', bg: 'from-cyan-400 to-blue-500', initials: '🌊' },
  { id: 'a4', bg: 'from-emerald-400 to-green-500', initials: '🌿' },
  { id: 'a5', bg: 'from-rose-400 to-pink-500', initials: '🌸' },
  { id: 'a6', bg: 'from-slate-400 to-gray-600', initials: '🤖' },
  { id: 'a7', bg: 'from-yellow-400 to-amber-500', initials: '⭐' },
  { id: 'a8', bg: 'from-indigo-400 to-violet-500', initials: '🔮' },
  { id: 'a9', bg: 'from-teal-400 to-cyan-500', initials: '💎' },
  { id: 'a10', bg: 'from-red-400 to-rose-500', initials: '🔥' },
];

const SECTIONS = [
  { id: 'profile', labelKey: 'settings.section.profile', icon: User },
  { id: 'appearance', labelKey: 'settings.section.appearance', icon: Palette },
  { id: 'notifications', labelKey: 'settings.section.notifications', icon: Bell },
  { id: 'security', labelKey: 'settings.section.security', icon: Shield },
  { id: 'billing', labelKey: 'settings.section.billing', icon: CreditCard },
  { id: 'language', labelKey: 'settings.section.language', icon: Globe },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export function SettingsView() {
  const [section, setSection] = useState<SectionId>('profile');
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useApp();
  const [selectedAvatar, setSelectedAvatar] = useState('a1');
  const [savedAvatar, setSavedAvatar] = useState('a1');
  const [notifications, setNotifications] = useState({
    generationComplete: true,
    modelUpdates: true,
    creditAlerts: false,
    productNews: false,
  });

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
                onClick={() => setSavedAvatar(selectedAvatar)}
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
              <Field label={t(locale, 'settings.security.currentPassword')} value="" type="password" />
              <Field label={t(locale, 'settings.security.newPassword')} value="" type="password" />
              <Field label={t(locale, 'settings.security.confirmPassword')} value="" type="password" />
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{t(locale, 'settings.security.twoFactorTitle')}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(locale, 'settings.security.twoFactorDesc')}
                </p>
                <button className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/30">
                  {t(locale, 'settings.security.enable2fa')}
                </button>
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
                  <p className="mt-1 font-display text-2xl font-bold">842</p>
                </div>
                <div className="rounded-xl border border-border bg-card/40 p-4">
                  <p className="text-xs text-muted-foreground">{t(locale, 'settings.billing.nextRenewal')}</p>
                  <p className="mt-1 font-display text-2xl font-bold">Aug 15</p>
                </div>
              </div>
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
  const sizeClass = size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-14 w-14 text-xl';
  return (
    <div className={cn('flex items-center justify-center rounded-2xl bg-gradient-to-br', sizeClass, avatar.bg)}>
      {avatar.initials}
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
