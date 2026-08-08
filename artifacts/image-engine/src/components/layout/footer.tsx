import { ShieldCheck, Lock } from 'lucide-react';
import { useApp } from '@/components/providers/app-provider';
import { useEffect, useRef } from 'react';

function AdBanner728() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';

    const s1 = document.createElement('script');
    s1.innerHTML = `atOptions = {'key':'449140387cd4430b4584358a23c87848','format':'iframe','height':90,'width':728,'params':{}};`;
    const s2 = document.createElement('script');
    s2.src = 'https://www.highperformanceformat.com/449140387cd4430b4584358a23c87848/invoke.js';
    s2.async = true;
    s2.setAttribute('data-cfasync', 'false');

    ref.current.appendChild(s1);
    ref.current.appendChild(s2);
  }, []);

  return <div ref={ref} className="flex items-center justify-center overflow-hidden" />;
}

export function Footer() {
  const year = new Date().getFullYear();
  const { activeView } = useApp();
  const isAdmin = activeView === 'admin';

  return (
    <footer className="animate-fade-in border-t border-border/50 bg-background/50 backdrop-blur-sm">
      {/* إعلان 728x90 — مخفي في الأدمن */}
      {!isAdmin && <AdBanner728 />}

      <div className="px-4 py-3">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-[11px] text-muted-foreground">
            © {year} Image Engine. All rights reserved.
          </p>
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
      </div>
    </footer>
  );
}
