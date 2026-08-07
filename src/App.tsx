import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Memory, UserTokenInfo, NetworkInfo } from "./types";
import { Header } from "./components/Header";
import { MemoryCard } from "./components/MemoryCard";
import { PairingModal } from "./components/PairingModal";
import { QuickAddModal } from "./components/QuickAddModal";
import { LightboxModal } from "./components/LightboxModal";
import { AiChatDrawer } from "./components/AiChatDrawer";
import { OnboardingWalkthrough } from "./components/OnboardingWalkthrough";
import { Toast } from "./components/Toast";
import { playNotificationSound } from "./utils/audio";
import { MAX_FILE_SIZE_BYTES, prepareUploadFile, fileToBase64 } from "./utils/fileTransfer";
import {
  Search,
  Zap,
  RefreshCw,
  Plus,
  QrCode,
  ShieldCheck,
  Clock,
  Smartphone,
  Link as LinkIcon,
  FileText,
  Image as ImageIcon,
  Pin,
  X,
  Wifi,
  WifiOff,
  Bell,
  Download,
} from "lucide-react";

export default function App() {
  const [tokenInfo, setTokenInfo] = useState<UserTokenInfo | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Network Info
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Connection Health
  const [connectionStatus, setConnectionStatus] = useState<"live" | "syncing" | "offline">("live");
  const failCountRef = useRef(0);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"all" | "links" | "text" | "images" | "pinned">("all");

  // Modals state
  const [isPairingOpen, setIsPairingOpen] = useState<boolean>(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Notification state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  // AI Assistant state
  const [isAiChatOpen, setIsAiChatOpen] = useState<boolean>(false);
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // PWA Install Prompt
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  // FAB open state
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [fabPosition, setFabPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Global mouse drag handlers
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 6) {
        setHasDragged(true);
      }
      setFabPosition({
        x: dragOffsetRef.current.x + dx,
        y: dragOffsetRef.current.y + dy,
      });
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setHasDragged(false);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragOffsetRef.current = { ...fabPosition };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setHasDragged(false);
    dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    dragOffsetRef.current = { ...fabPosition };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.x;
    const dy = touch.clientY - dragStartRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 6) {
      setHasDragged(true);
    }
    setFabPosition({
      x: dragOffsetRef.current.x + dx,
      y: dragOffsetRef.current.y + dy,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Guide / Onboarding state
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof Notification !== "undefined") {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      showToast(permission === "granted" ? "Notifications enabled!" : "Notifications disabled.");
    }
  };

  // Listen for PWA Install Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleInstallPwa = () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === "accepted") {
          console.log("User accepted PWA installation");
        }
        setDeferredInstallPrompt(null);
      });
    }
  };

  // Fetch network info (for multi-mode QR pairing)
  const fetchNetworkInfo = async () => {
    try {
      const res = await fetch("/api/network-info");
      if (res.ok) {
        const data: NetworkInfo = await res.json();
        setNetworkInfo(data);
      }
    } catch (err) {
      console.warn("Network info fetch failed:", err);
    }
  };

  // Fetch or initialize user active share token
  const fetchActiveToken = async () => {
    try {
      const localToken = localStorage.getItem("copyzapp_share_token");
      const url = localToken ? `/api/tokens/active?token=${encodeURIComponent(localToken)}` : "/api/tokens/active";
      const res = await fetch(url);
      if (res.ok) {
        const data: UserTokenInfo = await res.json();
        setTokenInfo(data);
        localStorage.setItem("copyzapp_share_token", data.shareToken);
        const manifestEl = document.getElementById("pwa-manifest-link") as HTMLLinkElement;
        if (manifestEl && data.manifestUrl) {
          manifestEl.href = data.manifestUrl;
        }
        return data;
      }
    } catch (err) {
      console.warn("Active token fetch warning:", err);
    }
    return null;
  };

  // Fetch memories from backend
  const fetchMemories = useCallback(async (token?: string, silent = false) => {
    if (!silent) setIsPolling(true);
    if (silent) setConnectionStatus("syncing");

    const activeToken = token || tokenInfo?.shareToken;
    if (!activeToken) {
      setLoading(false);
      setIsPolling(false);
      return;
    }

    try {
      const res = await fetch(`/api/memories?token=${activeToken}`);
      if (res.ok) {
        const data = await res.json();
        setMemories((prevMemories) => {
          const incoming = data.snippets || [];
          const hasNew = incoming.some((item) => !prevMemories.some((m) => m.id === item.id));
          if (hasNew) {
            playNotificationSound();
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              const newestSnippet = incoming.find((item) => !prevMemories.some((m) => m.id === item.id));
              if (newestSnippet) {
                new Notification("New Clip Received", {
                  body: newestSnippet.body || newestSnippet.title || "Image snippet received",
                  icon: "/pwa-192x192.png",
                  tag: "copyzapp-new-clip",
                });
              }
            }
          }
          return incoming;
        });
        setLastSyncTime(new Date());
        failCountRef.current = 0;
        setConnectionStatus("live");
      } else {
        failCountRef.current += 1;
      }
    } catch (err) {
      failCountRef.current += 1;
      if (failCountRef.current >= 3) {
        setConnectionStatus("offline");
      }
      if (!silent) {
        console.warn("Unable to connect to server:", err);
      }
    } finally {
      setLoading(false);
      setIsPolling(false);
    }
  }, [tokenInfo?.shareToken]);

  // Initial Load
  useEffect(() => {
    const init = async () => {
      // Parse token from query parameter if present
      const params = new URLSearchParams(window.location.search);
      const queryToken = params.get("token");
      if (queryToken) {
        localStorage.setItem("copyzapp_share_token", queryToken);
        // Notify server that this token has been scanned by a new device
        fetch("/api/tokens/mark-scanned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: queryToken }),
        })
        .then((res) => {
          if (res.ok) {
            showToast("Connected to PC! CopyZapp sync active.");
          }
        })
        .catch((err) => console.error("Failed to mark token as scanned:", err));
        
        // Strip token from browser address bar for cleaner URLs
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const tokenData = await fetchActiveToken();
      await fetchNetworkInfo();
      if (tokenData) {
        fetchMemories(tokenData.shareToken);
      }
      // Show onboarding guide for first-time users
      if (!localStorage.getItem("copyzapp_onboarding_completed")) {
        setIsGuideOpen(true);
      }
    };
    init();
  }, []);

  // Poll more lightly so the app feels responsive without hammering the server.
  useEffect(() => {
    if (!tokenInfo?.shareToken) return;
    const interval = setInterval(() => {
      fetchMemories(tokenInfo.shareToken, true);
    }, 6000);
    return () => clearInterval(interval);
  }, [tokenInfo?.shareToken, fetchMemories]);

  // Paste handler for PC Dashboard (Ctrl+V)
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea") return;
      if (!tokenInfo?.shareToken) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const pastedText = clipboardData.getData("text");
      const files = Array.from(clipboardData.files);

      if (pastedText || files.length > 0) {
        e.preventDefault();
        
        try {
          if (files.length > 0) {
            if (files[0].size > MAX_FILE_SIZE_BYTES) {
              showToast("File exceeds the 25 MB limit.");
              return;
            }
            const preparedFile = await prepareUploadFile(files[0]);
            const formData = new FormData();
            formData.append("token", tokenInfo.shareToken);
            formData.append(
              "title",
              preparedFile.type.startsWith("image/") ? "Pasted Image" : preparedFile.name || "Pasted File"
            );
            if (pastedText) formData.append("text", pastedText);
            formData.append("image", preparedFile);

            const res = await fetch("/api/memories", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${tokenInfo.shareToken}`,
              },
              body: formData,
            });

            if (res.ok) {
              showToast("Pasted file directly from clipboard!");
              fetchMemories(tokenInfo.shareToken);
            }
          } else if (pastedText) {
            const pastedTitle = pastedText.length > 30 ? pastedText.slice(0, 30) + "..." : "Pasted Snippet";
            const res = await fetch("/api/memories", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokenInfo.shareToken}` 
              },
              body: JSON.stringify({
                token: tokenInfo.shareToken,
                title: pastedTitle,
                text: pastedText,
              }),
            });
            if (res.ok) {
              showToast("Pasted text directly from clipboard!");
              fetchMemories(tokenInfo.shareToken);
            }
          }
        } catch (err) {
          console.error("Paste upload error:", err);
          showToast("Failed to paste content.");
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [tokenInfo?.shareToken, fetchMemories]);

  // Close FAB when clicking outside
  useEffect(() => {
    if (!isFabOpen) return;
    const handler = () => setIsFabOpen(false);
    const t = setTimeout(() => window.addEventListener("click", handler), 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener("click", handler);
    };
  }, [isFabOpen]);

  // Memory Action Handlers
  const handleDeleteMemory = async (id: string) => {
    try {
      const token = tokenInfo?.shareToken;
      const res = await fetch(`/api/memories/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        showToast("Deleted memory snippet");
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleTogglePin = async (id: string) => {
    try {
      const token = tokenInfo?.shareToken;
      const res = await fetch(`/api/memories/${id}/pin`, {
        method: "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const updated = await res.json();
        setMemories((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isPinned: updated.isPinned } : m))
        );
        showToast(updated.isPinned ? "Snippet Pinned (Immune to 24h cleanup)" : "Snippet Unpinned");
      }
    } catch (err) {
      console.error("Pin toggle error:", err);
    }
  };

  const handleOpenAiWithContext = (id: string) => {
    setSelectedMemoryIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
    setIsAiChatOpen(true);
  };

  const handleRotateToken = async () => {
    if (confirm("Are you sure you want to rotate your share token? Your old phone share link will stop working.")) {
      try {
        const res = await fetch("/api/tokens/rotate", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenInfo?.shareToken || ""}`
          }
        });
        if (res.ok) {
          const newToken = await res.json();
          setTokenInfo(newToken);
          localStorage.setItem("copyzapp_share_token", newToken.shareToken);
          // Re-fetch network info so new token is embedded in shareUrls
          await fetchNetworkInfo();
          showToast("Share token rotated!");
          fetchMemories(newToken.shareToken);
        }
      } catch (err) {
        console.error("Rotate token error:", err);
      }
    }
  };

  // Filter & Search Logic
  const filteredMemories = memories.filter((memory) => {
    if (activeFilter === "links" && !memory.link) return false;
    if (activeFilter === "text" && (memory.link || memory.imageUrl)) return false;
    if (activeFilter === "images" && !memory.imageUrl) return false;
    if (activeFilter === "pinned" && !memory.isPinned) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = memory.title?.toLowerCase().includes(q);
      const matchBody = memory.body?.toLowerCase().includes(q);
      const matchLink = memory.link?.toLowerCase().includes(q);
      return matchTitle || matchBody || matchLink;
    }
    return true;
  });

  const filterOptions: { key: typeof activeFilter; label: string; icon?: React.ReactNode; count?: number }[] = [
    { key: "all", label: `All (${memories.length})` },
    { key: "links", label: "Links", icon: <LinkIcon className="w-3.5 h-3.5" /> },
    { key: "text", label: "Text", icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "images", label: "Images", icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { key: "pinned", label: "Pinned", icon: <Pin className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-[#E0E0E1] flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">

      {/* Header */}
      <Header
        tokenInfo={tokenInfo}
        isPolling={isPolling}
        lastSyncTime={lastSyncTime}
        connectionStatus={connectionStatus}
        onRefresh={() => tokenInfo?.shareToken && fetchMemories(tokenInfo.shareToken)}
        onOpenPairing={() => setIsPairingOpen(true)}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        canInstallPwa={Boolean(deferredInstallPrompt)}
        onInstallPwa={handleInstallPwa}
        onOpenAiChat={() => setIsAiChatOpen(true)}
        onShowGuide={() => setIsGuideOpen(true)}
      />

      {/* Database Warning Banner */}
      {networkInfo && networkInfo.kvConfigured === false && networkInfo.dbConfigured === false && (
        <div className="bg-[#4a1c10] border-b border-[#7e341b] py-2 px-3 sm:px-6">
          <div className="max-w-none mx-auto flex items-start sm:items-center gap-2 text-[11px] text-orange-200 font-mono">
            <span className="px-1.5 py-0.5 rounded bg-orange-700 text-white font-bold shrink-0 text-[9px] uppercase tracking-wider">Warning</span>
            <div>
              <span className="font-bold text-white">Database not configured</span>:{" "}
              No persistent storage detected. Snippets, pairing, and files will reset on each deploy.
              Add <code className="bg-orange-900/60 px-1 rounded text-orange-100">DATABASE_URL</code> to your Vercel Dashboard → Project Settings → Environment Variables (use your Neon DB connection string).
            </div>
          </div>
        </div>
      )}

      {/* Hero Banner / Instructions */}
      <div className="bg-[#161618] border-b border-[#1A1A1C] py-2.5 px-3 sm:px-6">
        <div className="max-w-none mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-gray-300">
            <span className="p-1.5 rounded-md bg-[#212124] text-emerald-400 border border-[#2A2A2C] shrink-0">
              <Zap className="w-3.5 h-3.5 fill-emerald-400/20" />
            </span>
            <div className="font-mono text-[11px]">
              <span className="font-semibold text-[#E0E0E1]">Phone to PC Stream:</span>{" "}
              Share from Android Chrome, Twitter, Photos or YouTube. It appears here instantly.{" "}
              <span className="text-emerald-400 font-medium hidden sm:inline">
                Auto-vanishes in 24h. No cleanup needed.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsPairingOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#212124] hover:bg-[#2A2A2C] text-gray-200 text-[11px] font-mono font-medium border border-[#2A2A2C] transition-colors"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Pair Phone QR</span>
            </button>
            {/* Setup Guide button removed */}
          </div>
        </div>
      </div>

      {/* Main Dashboard - pad bottom for mobile bottom nav */}
      <main className="flex-1 max-w-none w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 mb-bottom-nav lg:mb-0">

        {/* PWA & Notification Setup Banner */}
        {(deferredInstallPrompt || (typeof Notification !== "undefined" && notificationPermission === "default")) && (
          <div className="bg-[#161618] border border-[#2A2A2C] rounded-xl p-4.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <h4 className="text-xs font-bold text-gray-200 font-mono">Unlock Full CopyZapp Integration</h4>
              <p className="text-[11px] text-gray-400 font-mono leading-relaxed">
                Install the CopyZapp app on your home screen and allow push notifications to receive instant audio and system alerts when new snippets arrive.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {deferredInstallPrompt && (
                <button
                  onClick={handleInstallPwa}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/10 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install PWA</span>
                </button>
              )}
              {typeof Notification !== "undefined" && notificationPermission === "default" && (
                <button
                  onClick={handleRequestNotificationPermission}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-bold bg-indigo-500 hover:bg-indigo-400 text-white shadow-md shadow-indigo-500/10 border border-indigo-400/30 transition-colors"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Allow Notifications</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#161618] p-3 sm:p-4 rounded-xl border border-[#2A2A2C]">
          {/* Filter Pills */}
          <div className="relative pill-scroll-fade">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 font-mono no-scrollbar pr-8">
              {filterOptions.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4.5 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                    activeFilter === key
                      ? key === "pinned"
                        ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10"
                        : "bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/10"
                      : "bg-[#212124] text-gray-400 hover:text-gray-200 border border-[#2A2A2C]"
                  }`}
                >
                  {icon && <span className="sm:scale-110">{icon}</span>}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative min-w-0 sm:min-w-[240px] sm:w-80 font-mono">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search snippets..."
              className="w-full pl-8 sm:pl-10 pr-10 py-1.5 sm:py-2.5 bg-[#0E0E10] border border-[#2A2A2C] rounded-lg text-xs sm:text-sm text-[#E0E0E1] focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-300 rounded"
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Offline Banner */}
        {connectionStatus === "offline" && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
            <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Can't reach the server. Check that the CopyZapp server process is running.</span>
            <button
              onClick={() => tokenInfo?.shareToken && fetchMemories(tokenInfo.shareToken)}
              className="ml-auto px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
            <span className="text-xs text-gray-400 font-mono">Syncing stream with CopyZapp bridge…</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredMemories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4 rounded-xl bg-[#161618] border border-[#2A2A2C] text-center max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-xl bg-[#212124] border border-[#2A2A2C] flex items-center justify-center text-emerald-400">
              <Zap className="w-7 h-7 stroke-[2]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#E0E0E1]">
                {searchQuery || activeFilter !== "all" ? "No matching snippets" : "Nothing here yet"}
              </h3>
              <p className="text-xs text-gray-400 font-mono">
                {searchQuery || activeFilter !== "all"
                  ? "Try clearing your search or switching filters."
                  : "Share text, links, photos, or files from your phone, or use the buttons below."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1 font-mono">
              <button
                onClick={() => setIsQuickAddOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Quick Add
              </button>
            </div>
          </div>
        )}

        {/* Memory Snippets Grid */}
        {!loading && filteredMemories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredMemories.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  onDelete={handleDeleteMemory}
                  onTogglePin={handleTogglePin}
                  onOpenImage={(url, title) => setActiveLightboxImage({ url, title })}
                  onToast={showToast}
                  onAskAi={handleOpenAiWithContext}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="hidden lg:block bg-[#161618] border-t border-[#1A1A1C] py-5 mt-8">
        <div className="max-w-none mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-400 font-mono">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-[#E0E0E1]">CopyZapp Bridge</span>
            <span>- Share it. Zapp it.</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-[11px]">
            <span className="flex items-center gap-1.5 text-gray-300">
              <Clock className="w-3 h-3 text-emerald-400" />
              Ephemeral 24h Auto-Expiry
            </span>
            <span className="flex items-center gap-1.5 text-gray-300">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Capability Token Isolation
            </span>
            <span className="flex items-center gap-1.5 text-gray-300">
              <Smartphone className="w-3 h-3 text-emerald-400" />
              Android Share Sheet Target
            </span>
          </div>
        </div>
      </footer>

      {/* ── Mobile Bottom Nav (hidden on lg+) ─────────────────────────────── */}
      <nav className="bottom-nav lg:hidden">
        <div className="flex items-center justify-around px-2 h-16">
          {/* Pair Phone */}
          <button
            onClick={() => { setIsFabOpen(false); setIsPairingOpen(true); }}
            className="flex flex-col items-center gap-1 py-2 px-4 text-gray-400 hover:text-emerald-400 transition-colors min-w-[60px]"
          >
            <QrCode className="w-5 h-5" />
            <span className="text-[10px] font-mono font-medium">Pair</span>
          </button>

          {/* Sync Status / Refresh */}
          <button
            onClick={() => tokenInfo?.shareToken && fetchMemories(tokenInfo.shareToken)}
            className="flex flex-col items-center gap-1 py-2 px-4 transition-colors min-w-[60px]"
          >
            <div className="relative">
              {connectionStatus === "offline" ? (
                <WifiOff className="w-5 h-5 text-rose-400" />
              ) : connectionStatus === "syncing" || isPolling ? (
                <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
              ) : (
                <Wifi className="w-5 h-5 text-emerald-400" />
              )}
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0B0B0C] ${
                  connectionStatus === "offline"
                    ? "bg-rose-500"
                    : connectionStatus === "syncing"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-emerald-500 animate-pulse"
                }`}
              />
            </div>
            <span className={`text-[10px] font-mono font-medium ${
              connectionStatus === "offline" ? "text-rose-400" :
              connectionStatus === "syncing" ? "text-amber-400" : "text-emerald-400"
            }`}>
              {connectionStatus === "offline" ? "Offline" : connectionStatus === "syncing" ? "Syncing" : "Live"}
            </span>
          </button>

          {/* Onboarding Guide button removed */}
        </div>
      </nav>

      {/* ── FAB Speed Dial (mobile only, hidden on lg+) ───────────────────── */}
      <div className="lg:hidden">
        {/* Speed Dial Options */}
        <div
          className={`fab-menu ${isFabOpen ? "visible-menu" : "hidden-menu"}`}
          style={{
            right: "1.25rem",
            bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 5.5rem)",
            transform: `translate(${fabPosition.x}px, ${fabPosition.y}px)`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            {
              label: "Quick Add",
              icon: <Plus className="w-4 h-4" />,
              color: "bg-emerald-500 text-black",
              action: () => { setIsQuickAddOpen(true); setIsFabOpen(false); },
            },
            {
              label: "Pair Phone",
              icon: <QrCode className="w-4 h-4" />,
              color: "bg-[#212124] text-emerald-400 border border-[#2A2A2C]",
              action: () => { setIsPairingOpen(true); setIsFabOpen(false); },
            },
          ].map(({ label, icon, color, action }) => (
            <button
              key={label}
              onClick={action}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full text-xs font-semibold font-mono shadow-xl ${color} transition-all active:scale-95`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* FAB Button */}
        <button
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => {
            e.stopPropagation();
            if (!hasDragged) {
              setIsFabOpen((o) => !o);
            }
          }}
          style={{
            right: "1.25rem",
            bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 1rem)",
            transform: `translate(${fabPosition.x}px, ${fabPosition.y}px)`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
            touchAction: "none",
          }}
          className={`fab w-14 h-14 bg-emerald-500 text-black ${isFabOpen ? "fab-open" : ""} select-none cursor-move`}
          aria-label="Actions"
        >
          <Plus className="w-6 h-6 stroke-[2.5] pointer-events-none" />
        </button>
      </div>

      {/* Modals */}
      {isPairingOpen && (
        <PairingModal
          isOpen={isPairingOpen}
          onClose={() => setIsPairingOpen(false)}
          tokenInfo={tokenInfo}
          networkInfo={networkInfo}
          onRotateToken={handleRotateToken}
          onPair={async (token) => {
            console.log("Pairing with token:", token);
            localStorage.setItem("copyzapp_share_token", token);
            const data = await fetchActiveToken();
            if (data) {
              console.log("Active token fetched:", data.shareToken);
              fetchMemories(data.shareToken);
            } else {
              console.error("Failed to fetch active token after pairing");
            }
            showToast("Successfully paired!");
            setIsPairingOpen(false);
          }}
        />
      )}

      {isQuickAddOpen && (
        <QuickAddModal
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          tokenInfo={tokenInfo}
          onAdded={() => {
            if (tokenInfo?.shareToken) fetchMemories(tokenInfo.shareToken);
            showToast("Added memory snippet!");
          }}
        />
      )}

      {activeLightboxImage && (
        <LightboxModal
          imageUrl={activeLightboxImage.url}
          title={activeLightboxImage.title}
          onClose={() => setActiveLightboxImage(null)}
        />
      )}

      {isAiChatOpen && (
        <AiChatDrawer
          isOpen={isAiChatOpen}
          onClose={() => setIsAiChatOpen(false)}
          tokenInfo={tokenInfo}
          memories={memories}
          selectedMemoryIds={selectedMemoryIds}
          onRemoveContext={(id) => setSelectedMemoryIds((prev) => prev.filter((x) => x !== id))}
          onClearContext={() => setSelectedMemoryIds([])}
        />
      )}

      {isGuideOpen && (
        <OnboardingWalkthrough
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
        />
      )}

      {/* Toast */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
