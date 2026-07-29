import React from "react";
import { UserTokenInfo } from "../types";
import {
  Zap,
  Smartphone,
  QrCode,
  Plus,
  RefreshCw,
  CheckCircle2,
  Wifi,
  Signal,
  Sparkles,
  WifiOff,
  Download
} from "lucide-react";

interface HeaderProps {
  tokenInfo: UserTokenInfo | null;
  isPolling: boolean;
  lastSyncTime: Date | null;
  connectionStatus: "live" | "syncing" | "offline";
  onRefresh: () => void;
  onOpenPairing: () => void;
  onOpenQuickAdd: () => void;
  onInstallPwa?: () => void;
  canInstallPwa?: boolean;
  onOpenAiChat?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tokenInfo,
  isPolling,
  lastSyncTime,
  connectionStatus,
  onRefresh,
  onOpenPairing,
  onOpenQuickAdd,
  onInstallPwa,
  canInstallPwa,
  onOpenAiChat,
}) => {
  const statusConfig = {
    live: {
      dot: "bg-emerald-500 animate-pulse",
      label: "Live",
      text: "text-emerald-400",
      icon: <Signal className="w-3 h-3 text-emerald-400" />,
    },
    syncing: {
      dot: "bg-amber-500 animate-pulse",
      label: "Syncing",
      text: "text-amber-400",
      icon: <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />,
    },
    offline: {
      dot: "bg-rose-500",
      label: "Offline",
      text: "text-rose-400",
      icon: <WifiOff className="w-3 h-3 text-rose-400" />,
    },
  }[connectionStatus];

  return (
    <header className="sticky top-0 z-40 bg-[#0B0B0C]/95 backdrop-blur-xl border-b border-[#1A1A1C]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">

        {/* Brand & Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-emerald-500 rounded-md flex items-center justify-center text-black font-extrabold tracking-tight shrink-0 shadow-sm text-xs sm:text-sm">
            CZ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base lg:text-lg font-bold text-[#E0E0E1] tracking-tight">
                CopyZap
              </h1>
              {/* Mobile-only: compact status dot inline with brand */}
              <span
                className={`lg:hidden w-1.5 h-1.5 rounded-full ${statusConfig.dot} shrink-0`}
                title={statusConfig.label}
              />
            </div>
            <p className="text-[10px] sm:text-[11px] text-gray-500 font-mono hidden sm:block">
              Share it. Zap it. • 24h Auto-Expiry
            </p>
          </div>
        </div>

        {/* Desktop: Live Sync Status Indicator */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-[#161618] border border-[#2A2A2C] text-xs font-mono text-gray-300">
          <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
          <span className={`uppercase text-[11px] tracking-wider font-semibold ${statusConfig.text}`}>
            {statusConfig.label}
          </span>
          {lastSyncTime && connectionStatus !== "offline" && (
            <span className="text-gray-500 text-[10px]">
              • {lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            onClick={onRefresh}
            title="Force refresh stream"
            className="p-1 hover:text-emerald-400 text-gray-400 rounded transition-colors ml-1"
            disabled={connectionStatus === "offline"}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Action Controls — desktop */}
        <div className="hidden sm:flex items-center gap-1.5 sm:gap-2">
          {/* AI Assistant Button (Desktop) */}
          {onOpenAiChat && (
            <button
              onClick={onOpenAiChat}
              title="Open AI Assistant"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 fill-indigo-400/20 animate-pulse" />
              <span>AI Assistant</span>
            </button>
          )}

          {/* QR / Pair Button */}
          <button
            onClick={onOpenPairing}
            title="Pair Phone"
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs font-semibold bg-[#161618] hover:bg-[#2A2A2C] text-[#E0E0E1] border border-[#2A2A2C] transition-all"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden md:inline">Pair Phone</span>
          </button>

          {/* PWA Install */}
          {canInstallPwa && onInstallPwa && (
            <button
              onClick={onInstallPwa}
              title="Install PWA"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs font-semibold bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="hidden md:inline">Install</span>
            </button>
          )}

          {/* Quick Add */}
          <button
            onClick={onOpenQuickAdd}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
            <span>Quick Add</span>
          </button>
        </div>

        {/* Mobile: minimal right side — refresh + sparkles AI buttons */}
        <div className="sm:hidden flex items-center gap-2">
          {onOpenAiChat && (
            <button
              onClick={onOpenAiChat}
              title="AI Assistant"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 text-xs font-bold transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 fill-indigo-400/20 animate-pulse" />
              <span>AI</span>
            </button>
          )}

          {connectionStatus === "offline" ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-mono font-semibold">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          ) : (
            <button
              onClick={onRefresh}
              title="Refresh"
              className="p-2 rounded-lg bg-[#161618] border border-[#2A2A2C] text-gray-400 hover:text-emerald-400 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isPolling ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
