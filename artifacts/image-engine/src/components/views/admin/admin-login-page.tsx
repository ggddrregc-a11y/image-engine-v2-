
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, ShieldAlert, Lock } from 'lucide-react';
import { useAdminAuth } from '@/components/providers/admin-auth-provider';
import { BrandLogo } from '@/components/layout/logo';
import { cn } from '@/lib/utils';

export function AdminLoginPage() {
  const { login } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setError('');
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, hsl(43 96% 56% / 0.12), transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="border-b border-border bg-gradient-to-r from-card to-card/50 px-8 pt-8 pb-6">
            <div className="mb-6 flex justify-center">
              <BrandLogo size="lg" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-amber">
                <ShieldAlert className="h-5 w-5 text-black" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold tracking-tight">
                  Admin Access
                </h1>
                <p className="text-xs text-muted-foreground">
                  Engine Control Center — restricted area
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 px-8 py-6">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="h-11 w-full rounded-xl border border-border bg-background/60 px-3 text-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-xl border border-border bg-background/60 px-3 pr-10 text-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              >
                <Lock className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className={cn(
                'flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50',
                'gradient-amber text-black hover:glow-amber',
              )}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4" />
                  Sign In to Admin
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="border-t border-border px-8 py-4">
            <p className="text-center text-xs text-muted-foreground">
              Unauthorized access is prohibited and monitored.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
