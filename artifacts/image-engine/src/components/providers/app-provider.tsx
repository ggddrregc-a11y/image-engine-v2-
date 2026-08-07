
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ViewId } from '@/lib/types';
import type { Locale } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const CREDITS_KEY = 'ie_credits';
const AVATAR_KEY = 'ie_avatar';
const VIEW_KEY = 'ie_active_view';
const DEFAULT_INITIAL_CREDITS = 100;

interface AppContextValue {
  activeView: ViewId;
  setActiveView: (v: ViewId) => void;
  prompt: string;
  setPrompt: (p: string) => void;
  negativePrompt: string;
  setNegativePrompt: (p: string) => void;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  aspectRatio: string;
  setAspectRatio: (a: string) => void;
  steps: number;
  setSteps: (n: number) => void;
  cfgScale: number;
  setCfgScale: (n: number) => void;
  sampler: string;
  setSampler: (s: string) => void;
  batchCount: number;
  setBatchCount: (n: number) => void;
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  // Credits
  credits: number;
  deductCredits: (amount: number) => boolean;
  generateCost: number;
  editCost: number;
  // Avatar
  avatarId: string;
  setAvatarId: (id: string) => void;
  // Settings section navigation
  settingsSection: string;
  setSettingsSection: (s: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveViewState] = useState<ViewId>(() => {
    const stored = window.localStorage.getItem(VIEW_KEY) as ViewId | null;
    const valid: ViewId[] = ['generate','editor','gallery','history','collections','workflows','models','api','chat','settings','admin','videos'];
    return stored && valid.includes(stored) ? stored : 'editor';
  });

  const setActiveView = useCallback((v: ViewId) => {
    setActiveViewState(v);
    window.localStorage.setItem(VIEW_KEY, v);
  }, []);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('Lumen-XL v2.1');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [steps, setSteps] = useState(30);
  const [cfgScale, setCfgScale] = useState(7);
  const [sampler, setSampler] = useState('DPM++ 2M Karras');
  const [batchCount, setBatchCount] = useState(1);
  const [favorites, setFavorites] = useState<Set<string>>(
    new Set(['img-1', 'img-3', 'img-6', 'img-9']),
  );
  const [locale, setLocaleState] = useState<Locale>('en');
  const [credits, setCredits] = useState<number>(DEFAULT_INITIAL_CREDITS);
  const [generateCost, setGenerateCost] = useState(10);
  const [editCost, setEditCost] = useState(5);
  const [avatarId, setAvatarIdState] = useState<string>('a1');
  const [settingsSection, setSettingsSection] = useState<string>('profile');

  // Load credits from localStorage on mount
  useEffect(() => {
    const stored = window.localStorage.getItem(CREDITS_KEY);
    if (stored !== null) {
      setCredits(parseInt(stored, 10));
    }
    // else: first visit — default 100 will be replaced after fetching settings
  }, []);

  // Load avatar from localStorage on mount
  useEffect(() => {
    const stored = window.localStorage.getItem(AVATAR_KEY);
    if (stored) setAvatarIdState(stored);
  }, []);

  // Fetch credit settings from Supabase on mount
  useEffect(() => {
    supabase
      .from('credit_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.generate_cost != null) setGenerateCost(data.generate_cost);
        if (data.edit_cost != null) setEditCost(data.edit_cost);
        // Only set initial credits if this is the very first visit
        const stored = window.localStorage.getItem(CREDITS_KEY);
        if (stored === null && data.initial_credits != null) {
          setCredits(data.initial_credits);
          window.localStorage.setItem(CREDITS_KEY, String(data.initial_credits));
        }
      });
  }, []);

  // Persist credits to localStorage on every change
  useEffect(() => {
    window.localStorage.setItem(CREDITS_KEY, String(credits));
  }, [credits]);

  // Deduct credits — returns true if successful, false if not enough
  const deductCredits = useCallback((amount: number): boolean => {
    let success = false;
    setCredits((prev) => {
      if (prev < amount) return prev;
      success = true;
      return prev - amount;
    });
    return success;
  }, []);

  const setAvatarId = useCallback((id: string) => {
    setAvatarIdState(id);
    window.localStorage.setItem(AVATAR_KEY, id);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem('locale') as Locale | null;
    if (stored === 'ar' || stored === 'en') {
      setLocaleState(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('locale', locale);
  }, [locale]);

  const setLocale = useCallback((locale: Locale) => {
    setLocaleState(locale);
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        prompt,
        setPrompt,
        negativePrompt,
        setNegativePrompt,
        selectedModel,
        setSelectedModel,
        aspectRatio,
        setAspectRatio,
        steps,
        setSteps,
        cfgScale,
        setCfgScale,
        sampler,
        setSampler,
        batchCount,
        setBatchCount,
        favorites,
        toggleFavorite,
        locale,
        setLocale,
        credits,
        deductCredits,
        generateCost,
        editCost,
        avatarId,
        setAvatarId,
        settingsSection,
        setSettingsSection,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
