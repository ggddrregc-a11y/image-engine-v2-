import { ShieldCheck, Lock } from 'lucide-react';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="animate-fade-in border-t border-border/50 bg-background/50 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-2 sm:flex-row">
        {/* Copyright */}
        <p className="text-[11px] text-muted-foreground">
          © {year} Image Engine. All rights reserved.
        </p>

        {/* Security badges */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3 text-success" />
            SSL Secured
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-success" />
            Data Protected
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="text-[11px] text-muted-foreground">
            Powered by AI
          </span>
        </div>
      </div>
    </footer>
  );
}
