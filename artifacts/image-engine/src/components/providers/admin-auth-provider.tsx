
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';

interface AdminAuthState {
  isAuthenticated: boolean;
  username: string | null;
}

interface AdminAuthContextValue extends AdminAuthState {
  login: (username: string, password: string) => Promise<{ error: string | null }>;
  logout: () => void;
}

const STORAGE_KEY = 'admin_session_v1';

// Hardcoded credentials — swap these for a real backend call later.
// The architecture is already separated: swap `attemptLogin` below.
const ADMIN_CREDENTIALS = [
  { username: 'admin', password: 'admin123' },
  { username: 'superadmin', password: 'imageengine2024' },
];

async function attemptLogin(
  username: string,
  password: string,
): Promise<boolean> {
  // Simulate a network round-trip so the UX feels async.
  await new Promise((r) => setTimeout(r, 600));
  return ADMIN_CREDENTIALS.some(
    (c) => c.username === username && c.password === password,
  );
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be inside AdminAuthProvider');
  return ctx;
}

export function AdminAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AdminAuthState>({
    isAuthenticated: false,
    username: null,
  });

  // Restore session from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AdminAuthState;
        if (parsed.isAuthenticated && parsed.username) {
          setState(parsed);
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const ok = await attemptLogin(username, password);
      if (!ok) return { error: 'Invalid username or password.' };
      const next: AdminAuthState = { isAuthenticated: true, username };
      setState(next);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { error: null };
    },
    [],
  );

  const logout = useCallback(() => {
    setState({ isAuthenticated: false, username: null });
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
