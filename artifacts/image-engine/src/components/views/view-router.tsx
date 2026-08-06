
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/components/providers/app-provider';
import { GenerateView } from './generate-view';
import { EditorView } from './editor-view';
import { GalleryView } from './gallery-view';
import { HistoryView } from './history-view';
import { CollectionsView } from './collections-view';
import { ApiView } from './api-view';
import { SettingsView } from './settings-view';
import { AdminView } from './admin/admin-view';
import type { ViewId } from '@/lib/types';

import { ChatView } from './chat-view';

const VIEWS: Record<ViewId, React.ComponentType> = {
  generate:    GenerateView,
  editor:      EditorView,
  gallery:     GalleryView,
  history:     HistoryView,
  collections: CollectionsView,
  chat:        ChatView,
  api:         ApiView,
  settings:    SettingsView,
  admin:       AdminView,
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
