
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/components/providers/app-provider';
import { GenerateView } from './generate-view';
import { EditorView } from './editor-view';
import { GalleryView } from './gallery-view';
import { HistoryView } from './history-view';
import { CollectionsView } from './collections-view';
import { WorkflowsView } from './workflows-view';
import { ModelsView } from './models-view';
import { ApiView } from './api-view';
import { SettingsView } from './settings-view';
import { AdminView } from './admin/admin-view';
import { ChatView } from './chat-view';
import { VideosView } from './videos-view';
import { VideosAdminView } from './videos-admin-view';
import type { ViewId } from '@/lib/types';

const VIEWS: Record<ViewId, React.ComponentType> = {
  generate: GenerateView,
  editor: EditorView,
  gallery: GalleryView,
  history: HistoryView,
  collections: CollectionsView,
  workflows: WorkflowsView,
  models: ModelsView,
  api: ApiView,
  chat: ChatView,
  settings: SettingsView,
  admin: AdminView,
  videos: VideosView,
  'videos-admin': VideosAdminView,
};

export function ViewRouter() {
  const { activeView } = useApp();
  const View = VIEWS[activeView];

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="min-h-full"
        >
          <View />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
