import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './sidebar';
import { TopBar } from './topbar';
import { AppProvider, useApp } from '@/components/providers/app-provider';
import { AdminAuthProvider } from '@/components/providers/admin-auth-provider';
import { ViewRouter } from '@/components/views/view-router';
import { X } from 'lucide-react';

function ShellContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeView } = useApp();

  useEffect(() => {
    setMobileOpen(false);
  }, [activeView]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
              className="fixed left-0 top-0 z-50 h-full w-64 lg:hidden"
            >
              <div className="relative h-full">
                <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="absolute -right-12 top-4 flex h-9 w-9 items-center justify-center rounded-lg bg-card text-foreground shadow-lg"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-hidden">
          <ViewRouter />
        </main>
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <AppProvider>
      <AdminAuthProvider>
        <ShellContent />
      </AdminAuthProvider>
    </AppProvider>
  );
}
