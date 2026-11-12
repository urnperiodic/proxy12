import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Lock,
  Search,
  Settings,
  Maximize2,
  Minimize2,
  X,
  Check,
  Radio,
  RotateCcw,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

declare global {
  interface Window {
    $scramjetLoadController?: () => {
      ScramjetController: new (config: {
        prefix: string;
        files: {
          wasm: string;
          all: string;
          sync: string;
        };
      }) => ScramjetControllerInstance;
    };
  }
}

interface ScramjetControllerInstance {
  init: () => Promise<void>;
  encodeUrl: (url: string) => string;
  decodeUrl?: (url: string) => string;
}

interface BareMuxConnectionInstance {
  setTransport: (path: string, options: Array<{ wisp: string }>) => Promise<void>;
}

const DEFAULT_WISP_URL = 'wss://wisp.mercurywork.shop/';
const WISP_STORAGE_KEY = 'urnproxies_wisp_url';

const WISP_PRESETS = [
  {
    label: 'Mercury Workshop (Default)',
    url: 'wss://wisp.mercurywork.shop/',
    region: 'Global Anycast',
  },
  {
    label: 'Anura Public Wisp',
    url: 'wss://anura.pro/',
    region: 'US / North America',
  },
  {
    label: 'RHW Wisp Relay',
    url: 'wss://wisp.rhw.one/',
    region: 'US East',
  },
];

const QUICK_DESTINATIONS = [
  {
    name: 'Google',
    domain: 'google.com',
    url: 'https://www.google.com',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
        />
      </svg>
    ),
  },
  {
    name: 'Youtube',
    domain: 'youtube.com',
    url: 'https://www.youtube.com',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#FF0000"
          d="M21.58 7.19a2.75 2.75 0 0 0-1.94-1.94C17.92 4.8 12 4.8 12 4.8s-5.92 0-7.64.45a2.75 2.75 0 0 0-1.94 1.94C2 8.91 2 12 2 12s0 3.09.42 4.81a2.75 2.75 0 0 0 1.94 1.94c1.72.45 7.64.45 7.64.45s5.92 0 7.64-.45a2.75 2.75 0 0 0 1.94-1.94C22 15.09 22 12 22 12s0-3.09-.42-4.81Z"
        />
        <polygon fill="#0c0c0c" points="10,15.2 15.5,12 10,8.8" />
      </svg>
    ),
  },
  {
    name: 'Spotify',
    domain: 'open.spotify.com',
    url: 'https://open.spotify.com',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#1ED760" />
        <path
          d="M16.5 15.4c-.2.3-.6.4-.9.2-2.5-1.5-5.6-1.9-9.3-1-.4.1-.7-.2-.8-.5-.1-.4.2-.7.5-.8 4-.9 7.5-.5 10.3 1.2.3.2.4.6.2.9zm1.2-2.8c-.3.4-.8.5-1.1.3-2.8-1.7-7.1-2.2-10.5-1.2-.4.1-.9-.1-1-.6-.1-.4.1-.9.6-1 3.8-1.2 8.6-.6 11.8 1.4.3.2.4.7.2 1.1zm.1-2.9C14.4 7.7 8.8 7.5 5.6 8.5c-.5.2-1.1-.1-1.3-.6-.2-.5.1-1.1.6-1.3 3.7-1.1 9.9-.9 13.8 1.4.5.3.6.9.3 1.4-.3.5-.9.6-1.2.3z"
          fill="#0c0c0c"
        />
      </svg>
    ),
  },
];

function resolveSearchOrUrl(rawInput: string): string {
  const input = rawInput.trim();
  if (!input) return '';

  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  const looksLikeDomain =
    !input.includes(' ') &&
    (/^localhost(:\d+)?(\/.*)?$/i.test(input) ||
      /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(input) ||
      /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(\/.*)?$/.test(input));

  if (looksLikeDomain) {
    return `https://${input}`;
  }

  return `https://duckduckgo.com/?q=${encodeURIComponent(input)}`;
}

function getStoredWispUrl(): string {
  try {
    const saved = localStorage.getItem(WISP_STORAGE_KEY);
    if (saved && /^wss?:\/\//i.test(saved.trim())) {
      return saved.trim();
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_WISP_URL;
}

function formatWispHost(wispUrl: string): string {
  try {
    const parsed = new URL(wispUrl);
    return parsed.host;
  } catch {
    return wispUrl;
  }
}

export default function App() {
  const [omniboxValue, setOmniboxValue] = useState('');
  const [homeSearchValue, setHomeSearchValue] = useState('');
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // History stack for Back / Forward buttons
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Wisp & Bare-Mux state
  const [wispUrl, setWispUrl] = useState<string>(getStoredWispUrl);
  const [draftWispUrl, setDraftWispUrl] = useState<string>(getStoredWispUrl);
  const [wispStatus, setWispStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [wispErrorMsg, setWispErrorMsg] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [reconnectSuccess, setReconnectSuccess] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const scramjetRef = useRef<ScramjetControllerInstance | null>(null);
  const bareMuxRef = useRef<BareMuxConnectionInstance | null>(null);
  const readyPromiseRef = useRef<Promise<void> | null>(null);
  const settingsPopoverRef = useRef<HTMLDivElement | null>(null);

  const configureWispTransport = useCallback(async (targetWispUrl: string) => {
    setWispStatus('connecting');
    setWispErrorMsg(null);

    try {
      if (!bareMuxRef.current) {
        const bareMuxModulePath = '/baremux/index.mjs';
        const { BareMuxConnection } = await import(/* @vite-ignore */ bareMuxModulePath);
        bareMuxRef.current = new BareMuxConnection('/baremux/worker.js');
      }

      await bareMuxRef.current!.setTransport('/epoxy/index.mjs', [{ wisp: targetWispUrl }]);
      setWispStatus('connected');
    } catch (err) {
      console.error('Failed to configure Wisp transport:', err);
      setWispStatus('error');
      setWispErrorMsg(err instanceof Error ? err.message : 'Failed to configure Epoxy transport');
      throw err;
    }
  }, []);

  useEffect(() => {
    const initProxyEngine = async () => {
      try {
        // Ensure Scramjet script is available
        if (typeof window.$scramjetLoadController !== 'function') {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/scramjet/scramjet.all.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load /scramjet/scramjet.all.js'));
            document.head.appendChild(script);
          });
        }

        if (typeof window.$scramjetLoadController === 'function' && !scramjetRef.current) {
          const { ScramjetController } = window.$scramjetLoadController();
          scramjetRef.current = new ScramjetController({
            prefix: '/scramjet/',
            files: {
              wasm: '/scramjet/scramjet.wasm.wasm',
              all: '/scramjet/scramjet.all.js',
              sync: '/scramjet/scramjet.sync.js',
            },
          });
        }

        if (!('serviceWorker' in navigator)) {
          throw new Error('Service Workers are not supported in this browser.');
        }

        await scramjetRef.current?.init();

        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        await registration.update().catch(() => {});
        await navigator.serviceWorker.ready;

        await configureWispTransport(getStoredWispUrl());
      } catch (err) {
        console.error('Proxy initialization error:', err);
        setWispStatus('error');
        setWispErrorMsg(err instanceof Error ? err.message : 'Initialization failed');
      }
    };

    readyPromiseRef.current = initProxyEngine();
  }, [configureWispTransport]);

  // Close settings popover on outside click or Escape
  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (
        settingsPopoverRef.current &&
        !settingsPopoverRef.current.contains(e.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isSettingsOpen]);

  // Fullscreen Escape shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen]);

  const navigateTo = useCallback(
    async (rawInput: string, pushHistory = true) => {
      const targetUrl = resolveSearchOrUrl(rawInput);
      if (!targetUrl) return;

      setOmniboxValue(targetUrl);
      setIsBrowsing(true);
      setIsLoading(true);

      if (readyPromiseRef.current) {
        await readyPromiseRef.current;
      }

      if (!scramjetRef.current) {
        setIsLoading(false);
        return;
      }

      const encodedUrl = scramjetRef.current.encodeUrl(targetUrl);
      if (iframeRef.current) {
        iframeRef.current.src = encodedUrl;
      }

      if (pushHistory) {
        setHistoryStack((prev) => {
          const next = prev.slice(0, historyIndex + 1);
          next.push(targetUrl);
          setHistoryIndex(next.length - 1);
          return next;
        });
      }
    },
    [historyIndex]
  );

  const handleIframeLoad = () => {
    setIsLoading(false);
    try {
      const win = iframeRef.current?.contentWindow;
      if (!win || !scramjetRef.current) return;
      const href = win.location.href;
      if (href && href !== 'about:blank' && href.includes('/scramjet/')) {
        const idx = href.indexOf('/scramjet/') + '/scramjet/'.length;
        const encodedPart = href.slice(idx);
        if (encodedPart && typeof scramjetRef.current.decodeUrl === 'function') {
          const decoded = scramjetRef.current.decodeUrl(encodedPart);
          if (decoded && /^https?:\/\//i.test(decoded)) {
            setOmniboxValue(decoded);
          }
        }
      }
    } catch {
      // Ignore cross-frame access issues
    }
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      navigateTo(historyStack[nextIndex], false);
    }
  };

  const handleForward = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      navigateTo(historyStack[nextIndex], false);
    }
  };

  const handleReload = () => {
    if (!isBrowsing) return;
    setIsLoading(true);
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.location.reload();
      } else if (historyIndex >= 0 && historyStack[historyIndex]) {
        navigateTo(historyStack[historyIndex], false);
      }
    } catch {
      if (historyIndex >= 0 && historyStack[historyIndex]) {
        navigateTo(historyStack[historyIndex], false);
      }
    }
  };

  const handleHome = () => {
    setIsBrowsing(false);
    setIsLoading(false);
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }
    setOmniboxValue('');
  };

  const toggleFullscreen = async () => {
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);
    try {
      if (nextState && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (!nextState && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback to CSS viewport fullscreen when running inside an iframe
    }
  };

  const handleSaveAndReconnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftWispUrl.trim();
    if (!/^wss?:\/\//i.test(cleaned)) {
      setWispStatus('error');
      setWispErrorMsg('Wisp URL must start with wss:// or ws://');
      return;
    }

    try {
      localStorage.setItem(WISP_STORAGE_KEY, cleaned);
    } catch {
      // Ignore localStorage write errors
    }

    setWispUrl(cleaned);
    setReconnectSuccess(false);

    try {
      await configureWispTransport(cleaned);
      setReconnectSuccess(true);
      setTimeout(() => setReconnectSuccess(false), 2500);

      // If currently browsing, reload the proxy iframe through the new Wisp server
      if (isBrowsing && historyIndex >= 0 && historyStack[historyIndex]) {
        navigateTo(historyStack[historyIndex], false);
      }
    } catch {
      // Error state is already handled in configureWispTransport
    }
  };

  const handleResetDefaultWisp = async () => {
    setDraftWispUrl(DEFAULT_WISP_URL);
    try {
      localStorage.setItem(WISP_STORAGE_KEY, DEFAULT_WISP_URL);
    } catch {
      // Ignore
    }
    setWispUrl(DEFAULT_WISP_URL);
    await configureWispTransport(DEFAULT_WISP_URL).catch(() => {});
  };

  return (
    <div className="relative flex flex-col w-screen h-screen overflow-hidden bg-black text-white select-none">
      {/* Top Browser Navigation Bar */}
      {!isFullscreen && (
        <header className="relative z-30 flex items-center gap-2.5 h-[54px] px-3.5 bg-[#0a0a0a] border-b border-white/12 shrink-0">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={handleHome}
            title="UrnProxies Home"
            className="flex items-center gap-2 pr-1 text-white hover:opacity-90 transition cursor-pointer shrink-0"
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white text-black font-bold text-xs border border-white">
              U
            </span>
            <span className="hidden sm:inline text-sm font-bold tracking-tight">
              UrnProxies
            </span>
          </button>

          {/* Back / Forward / Reload / Home Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleBack}
              disabled={historyIndex <= 0}
              title="Back"
              aria-label="Back"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleForward}
              disabled={historyIndex >= historyStack.length - 1}
              title="Forward"
              aria-label="Forward"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleReload}
              title="Reload"
              aria-label="Reload"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-white' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleHome}
              title="Home Launcher"
              aria-label="Home Launcher"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <Home className="w-4 h-4" />
            </button>
          </div>

          {/* Omnibox URL / DuckDuckGo Search Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigateTo(omniboxValue, true);
            }}
            className="flex-1 flex items-center gap-2 min-w-[160px] h-9 px-3 bg-[#050505] border border-white/12 rounded-lg focus-within:border-white focus-within:ring-2 focus-within:ring-white/15 transition"
          >
            <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <input
              type="text"
              value={omniboxValue}
              onChange={(e) => setOmniboxValue(e.target.value)}
              placeholder="Search DuckDuckGo or enter any URL..."
              spellCheck={false}
              aria-label="URL or search query"
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-xs text-white placeholder:text-neutral-500 font-mono-url"
            />
            {omniboxValue && (
              <button
                type="button"
                onClick={() => setOmniboxValue('')}
                title="Clear input"
                aria-label="Clear input"
                className="flex items-center justify-center w-5 h-5 rounded text-neutral-500 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="flex items-center justify-center h-6 px-3 rounded-md bg-white text-black text-xs font-bold hover:bg-neutral-200 transition cursor-pointer shrink-0"
            >
              Go
            </button>
          </form>

          {/* Right Action Controls: Wisp Settings Popover Trigger + Fullscreen */}
          <div className="relative flex items-center gap-1.5 shrink-0" ref={settingsPopoverRef}>
            <button
              type="button"
              onClick={() => {
                setDraftWispUrl(wispUrl);
                setReconnectSuccess(false);
                setIsSettingsOpen((prev) => !prev);
              }}
              title="Wisp Server Settings"
              aria-label="Wisp Server Settings"
              className={`flex items-center gap-2 h-8 px-2.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                isSettingsOpen
                  ? 'bg-white text-black border-white'
                  : 'bg-[#121212] text-neutral-200 border-white/15 hover:border-white/35 hover:text-white'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  wispStatus === 'connected'
                    ? isSettingsOpen
                      ? 'bg-black'
                      : 'bg-white'
                    : wispStatus === 'connecting'
                    ? 'bg-neutral-400 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span className="hidden md:inline font-mono-url text-[11px] max-w-[150px] truncate">
                {formatWispHost(wispUrl)}
              </span>
              <Settings className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              aria-label="Toggle Fullscreen"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Wisp Server Switcher Settings Popover */}
            {isSettingsOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[380px] max-w-[calc(100vw-24px)] bg-[#0c0c0c] border border-white/20 rounded-2xl p-4 shadow-2xl z-50 text-left">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-white" />
                    <div>
                      <h3 className="text-sm font-bold text-white leading-tight">
                        Wisp Transport Server
                      </h3>
                      <p className="text-[11px] text-neutral-400">
                        Epoxy TLS-in-Wisp relay (client-side only)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="flex items-center justify-center w-6 h-6 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    aria-label="Close settings"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <form onSubmit={handleSaveAndReconnect} className="space-y-3">
                  <div>
                    <label
                      htmlFor="wisp-url-input"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5"
                    >
                      Custom Wisp Server URL (wss://)
                    </label>
                    <input
                      id="wisp-url-input"
                      type="text"
                      value={draftWispUrl}
                      onChange={(e) => setDraftWispUrl(e.target.value)}
                      placeholder="wss://wisp.mercurywork.shop/"
                      spellCheck={false}
                      className="w-full h-9 px-3 rounded-lg bg-[#050505] border border-white/15 focus:border-white focus:outline-none text-xs text-white font-mono-url"
                    />
                  </div>

                  {/* Preset Wisp Servers */}
                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                      Quick Switch Presets
                    </span>
                    <div className="space-y-1.5">
                      {WISP_PRESETS.map((preset) => {
                        const isSelected = draftWispUrl.trim() === preset.url;
                        return (
                          <button
                            key={preset.url}
                            type="button"
                            onClick={() => setDraftWispUrl(preset.url)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition cursor-pointer ${
                              isSelected
                                ? 'bg-white/12 border-white text-white'
                                : 'bg-[#080808] border-white/10 text-neutral-300 hover:border-white/25 hover:bg-white/5'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">
                                {preset.label}
                              </div>
                              <div className="text-[11px] text-neutral-400 font-mono-url truncate">
                                {preset.url}
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-neutral-300 shrink-0 ml-2">
                              {preset.region}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {wispStatus === 'error' && wispErrorMsg && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-950/50 border border-red-500/40 text-red-200 text-xs">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{wispErrorMsg}</span>
                    </div>
                  )}

                  {reconnectSuccess && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/10 border border-white/25 text-white text-xs">
                      <Check className="w-4 h-4 text-white shrink-0" />
                      <span>Saved to localStorage and reconnected Epoxy transport.</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleResetDefaultWisp}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/15 bg-transparent text-xs font-medium text-neutral-300 hover:text-white hover:border-white/35 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Default
                    </button>

                    <button
                      type="submit"
                      disabled={wispStatus === 'connecting'}
                      className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-white text-black text-xs font-bold hover:bg-neutral-200 disabled:opacity-50 transition cursor-pointer"
                    >
                      {wispStatus === 'connecting' ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          Reconnecting...
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Save & Reconnect
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </header>
      )}

      {/* Top Loading Bar */}
      <div className="relative z-20 w-full h-[2px] bg-transparent overflow-hidden shrink-0">
        <div
          className={`h-full bg-white transition-all duration-300 ${
            isLoading ? 'w-3/4 opacity-100 animate-pulse' : 'w-0 opacity-0'
          }`}
        />
      </div>

      {/* Main Browser Viewport */}
      <main className="relative flex-1 w-full h-full bg-black overflow-hidden">
        {/* Full-height Scramjet Proxy Iframe */}
        <iframe
          ref={iframeRef}
          id="proxy-frame"
          title="Proxied Web Content"
          onLoad={handleIframeLoad}
          allow="fullscreen; autoplay; clipboard-read; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className={`w-full h-full border-none bg-black transition-opacity duration-150 ${
            isBrowsing ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Centered UrnProxies Home Overlay */}
        {!isBrowsing && (
          <section
            aria-label="UrnProxies Launcher"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 bg-[radial-gradient(ellipse_65%_45%_at_50%_35%,rgba(255,255,255,0.05),transparent_70%)] bg-black"
          >
            <div className="w-full max-w-[600px] flex flex-col items-center text-center gap-7">
              {/* Brand Header */}
              <div className="flex flex-col items-center gap-2">
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                  UrnProxies
                </h1>
                <p className="text-sm font-medium text-neutral-400">
                  Made by <span className="text-white font-semibold">Urnperiodic</span>
                </p>
              </div>

              {/* 3 Quick Destinations (Google, Youtube, Spotify) */}
              <div className="w-full max-w-[510px] grid grid-cols-3 gap-3.5">
                {QUICK_DESTINATIONS.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => navigateTo(item.url, true)}
                    className="group flex flex-col items-center justify-center px-3 py-5 rounded-2xl bg-[#0c0c0c] hover:bg-[#161616] border border-white/12 hover:border-white/30 transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center mb-3.5">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center">
                        {item.icon}
                      </div>
                    </div>
                    <span className="text-[15px] font-bold text-white tracking-tight mb-1 truncate max-w-full">
                      {item.name}
                    </span>
                    <span className="text-xs text-neutral-500 truncate max-w-full">
                      {item.domain}
                    </span>
                  </button>
                ))}
              </div>

              {/* Central Search / URL Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  navigateTo(homeSearchValue, true);
                }}
                className="w-full max-w-[580px] h-[52px] flex items-center gap-3 pl-4 pr-2.5 rounded-2xl bg-[#0c0c0c] border border-white/12 focus-within:border-white focus-within:ring-3 focus-within:ring-white/15 shadow-2xl transition"
              >
                <Search className="w-4 h-4 text-neutral-500 shrink-0" />
                <input
                  type="text"
                  value={homeSearchValue}
                  onChange={(e) => setHomeSearchValue(e.target.value)}
                  placeholder="Search DuckDuckGo or type any URL to launch..."
                  spellCheck={false}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-white placeholder:text-neutral-500"
                />
                <button
                  type="submit"
                  className="h-9 px-4 rounded-xl bg-white text-black text-xs font-bold hover:bg-neutral-200 transition cursor-pointer shrink-0"
                >
                  Launch
                </button>
              </form>

              {/* Active Wisp Status Pill Button */}
              <button
                type="button"
                onClick={() => {
                  setDraftWispUrl(wispUrl);
                  setIsSettingsOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0c0c0c] border border-white/10 hover:border-white/25 text-xs text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    wispStatus === 'connected'
                      ? 'bg-white'
                      : wispStatus === 'connecting'
                      ? 'bg-neutral-400 animate-pulse'
                      : 'bg-red-500'
                  }`}
                />
                <span>Wisp Relay:</span>
                <span className="text-white font-mono-url">{formatWispHost(wispUrl)}</span>
                <ExternalLink className="w-3 h-3 text-neutral-500" />
              </button>
            </div>
          </section>
        )}

        {/* Floating Exit Fullscreen Button */}
        {isFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            className="fixed top-3 right-3 z-50 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-black/90 border border-white/30 text-white text-xs font-semibold backdrop-blur-md shadow-lg hover:bg-neutral-900 transition cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Exit Fullscreen
          </button>
        )}
      </main>
    </div>
  );
}
