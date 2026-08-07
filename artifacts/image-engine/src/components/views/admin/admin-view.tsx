
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Workflow,
  FileText,
  SlidersHorizontal,
  ListOrdered,
  HardDrive,
  Users,
  ScrollText,
  ShieldCheck,
  LogOut,
  Wand2,
  Zap,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  Image as ImageIcon,
  Film,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminPageContainer } from './shared';
import { AdminTemplatesPage } from './pages/templates-page';
import { AdminGenerationSettingsPage } from './pages/gen-settings-page';
import { AdminQueuePage } from './pages/queue-page';
import { AdminStoragePage } from './pages/storage-page';
import { AdminUsersPage } from './pages/users-page';
import { AdminLogsPage } from './pages/logs-page';
import { AdminLoginPage } from './admin-login-page';
import { useAdminAuth } from '@/components/providers/admin-auth-provider';
import { useApp } from '@/components/providers/app-provider';
import { AdminImageEditorPage } from './pages/image-editor-page';
import { AdminCreditsPage } from './pages/credits-page';
import { AdminSupportPage } from './pages/support-page';
import { AdminBannerPage } from './pages/banner-page';
import { AdminChatProvidersPage } from './pages/chat-providers-page';
import { AdminImageProvidersPage } from './pages/image-providers-page';
import { AdminVideoSyncPage } from './pages/video-sync-page';

export type AdminSubPage =
  | 'image-providers'
  | 'chat-providers'
  | 'templates'
  | 'gen-settings'
  | 'queue'
  | 'storage'
  | 'users'
  | 'logs'
  | 'image-editor'
  | 'credits'
  | 'support'
  | 'banner'
  | 'video-sync';

const SUB_PAGES: {
  id: AdminSubPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  { id: 'image-providers', label: 'Image Providers', icon: ImageIcon,        description: 'Manage image generation models & API keys' },
  { id: 'chat-providers',  label: 'Chat Providers',  icon: MessageSquare,    description: 'Manage AI chat models & API keys' },
  { id: 'video-sync',      label: 'Video Sync',      icon: Film,             description: 'مزامنة وإدارة فيديوهات Facebook' },
  { id: 'image-editor',    label: 'Image Editor',    icon: Wand2,            description: 'Enable/disable AI image editing feature' },
  { id: 'credits',         label: 'Credits',         icon: Zap,              description: 'Visitor credits & cost per operation' },
  { id: 'banner',          label: 'Banner',          icon: Megaphone,        description: 'Announcement bar shown at the top of the site' },
  { id: 'support',         label: 'Support Links',   icon: LifeBuoy,         description: 'Manage support & social links shown to users' },
  { id: 'templates',       label: 'Prompt Templates',icon: FileText,         description: 'Reusable prompt library' },
  { id: 'gen-settings',    label: 'Generation Settings', icon: SlidersHorizontal, description: 'Global generation defaults' },
  { id: 'queue',           label: 'Queue Manager',   icon: ListOrdered,      description: 'Real-time generation queue' },
  { id: 'storage',         label: 'Storage',         icon: HardDrive,        description: 'Generated image library' },
  { id: 'users',           label: 'User Management', icon: Users,            description: 'Roles and permissions' },
  { id: 'logs',            label: 'System Logs',     icon: ScrollText,       description: 'API, generation, and error logs' },
];

export function AdminView() {
  const { isAuthenticated, username, logout } = useAdminAuth();
  const { setActiveView } = useApp();
  const [subPage, setSubPage] = useState<AdminSubPage>('image-providers');

  if (!isAuthenticated) {
    return <AdminLoginPage />;
  }

  const current = SUB_PAGES.find((p) => p.id === subPage)!;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/60">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Engine Control Center
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{current.description}</p>
          </div>
        </div>

        {/* Admin session indicator + logout */}
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2 sm:flex">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">{username ?? 'admin'}</span>
          </span>
          <button
            onClick={() => { logout(); setActiveView('generate'); }}
            className="flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            Admin Sign Out
          </button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="mt-6 flex gap-2 overflow-x-auto scrollbar-thin pb-2">
        {SUB_PAGES.map((p) => {
          const Icon = p.icon;
          const active = subPage === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSubPage(p.id)}
              className={cn(
                'group relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
              )}
            >
              {active && (
                <motion.div
                  layoutId="admin-subpage-active"
                  className="absolute inset-0 rounded-xl border border-primary/30 bg-primary/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <Icon
                className={cn(
                  'relative z-10 h-4 w-4 transition-colors',
                  active ? 'text-primary' : 'group-hover:text-foreground',
                )}
              />
              <span className="relative z-10 whitespace-nowrap">{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          <AdminPageContainer key={subPage}>
            {subPage === 'image-providers' && <AdminImageProvidersPage />}
            {subPage === 'chat-providers'  && <AdminChatProvidersPage />}
            {subPage === 'video-sync'      && <AdminVideoSyncPage />}
            {subPage === 'templates'       && <AdminTemplatesPage />}
            {subPage === 'gen-settings'    && <AdminGenerationSettingsPage />}
            {subPage === 'queue'           && <AdminQueuePage />}
            {subPage === 'storage'         && <AdminStoragePage />}
            {subPage === 'users'           && <AdminUsersPage />}
            {subPage === 'logs'            && <AdminLogsPage />}
            {subPage === 'image-editor'    && <AdminImageEditorPage />}
            {subPage === 'credits'         && <AdminCreditsPage />}
            {subPage === 'banner'          && <AdminBannerPage />}
            {subPage === 'support'         && <AdminSupportPage />}
          </AdminPageContainer>
        </AnimatePresence>
      </div>
    </div>
  );
}
