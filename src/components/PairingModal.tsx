import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { UserTokenInfo, NetworkInfo, ConnectionMode } from "../types";
import { copyToClipboard } from "../utils/clipboard";
import {
  X,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  QrCode,
  Laptop,
  ShieldCheck,
  Share2,
  ExternalLink,
  Info,
  Wifi,
  Zap,
  Cloud,
  Server,
  Globe,
  ChevronDown,
} from "lucide-react";

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenInfo: UserTokenInfo | null;
  networkInfo: NetworkInfo | null;
  onRotateToken: () => void;
}

const CONNECTION_MODES: {
  mode: ConnectionMode;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}[] = [
  {
    mode: "wifi",
    label: "Same WiFi",
    icon: <Wifi className="w-3.5 h-3.5" />,
    description: "Phone & PC on same router",
    color: "text-emerald-400",
  },
  {
    mode: "hotspot",
    label: "Hotspot",
    icon: <Zap className="w-3.5 h-3.5" />,
    description: "Phone connected to PC's hotspot",
    color: "text-amber-400",
  },
  {
    mode: "cloud",
    label: "Cloud / Internet",
    icon: <Cloud className="w-3.5 h-3.5" />,
    description: "Works from anywhere via APP_URL",
    color: "text-indigo-400",
  },
  {
    mode: "localhost",
    label: "Localhost",
    icon: <Server className="w-3.5 h-3.5" />,
    description: "Same machine / emulator",
    color: "text-gray-400",
  },
];

export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  onClose,
  tokenInfo,
  networkInfo,
  onRotateToken,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"qr" | "android" | "windows" | "ios">("qr");
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("wifi");
  const [isQrLoading, setIsQrLoading] = useState(false);

  // Resolve active share URL based on connection mode + networkInfo
  const activeShareUrl = (() => {
    if (!tokenInfo) return "";
    if (connectionMode === "cloud") {
      if (networkInfo?.cloudUrl) {
        const token = tokenInfo.shareToken;
        return `${networkInfo.cloudUrl}/api/share-receiver/${token}`;
      }
      return tokenInfo.shareUrl; // fallback
    }
    if (connectionMode === "localhost") {
      return networkInfo?.localhostUrl || tokenInfo.shareUrl;
    }
    if (connectionMode === "wifi") {
      const wifiAddr = networkInfo?.addresses.find((a) => a.type === "wifi");
      return wifiAddr?.shareUrl || tokenInfo.shareUrl;
    }
    if (connectionMode === "hotspot") {
      const hotspotAddr = networkInfo?.addresses.find((a) => a.type === "hotspot");
      return hotspotAddr?.shareUrl || tokenInfo.shareUrl;
    }
    return tokenInfo.shareUrl;
  })();

  // Check if a connection mode is available
  const isModeAvailable = (mode: ConnectionMode): boolean => {
    if (!networkInfo) return mode === "localhost";
    if (mode === "cloud") return Boolean(networkInfo.cloudUrl);
    if (mode === "wifi") return networkInfo.addresses.some((a) => a.type === "wifi");
    if (mode === "hotspot") return networkInfo.addresses.some((a) => a.type === "hotspot");
    if (mode === "localhost") return true;
    return false;
  };

  // Auto-select best available mode on open
  useEffect(() => {
    if (!isOpen || !networkInfo) return;
    if (networkInfo.cloudUrl) {
      setConnectionMode("cloud");
    } else if (networkInfo.addresses.some((a) => a.type === "wifi")) {
      setConnectionMode("wifi");
    } else if (networkInfo.addresses.some((a) => a.type === "hotspot")) {
      setConnectionMode("hotspot");
    } else {
      setConnectionMode("localhost");
    }
  }, [isOpen, networkInfo]);

  // Generate QR whenever URL changes
  useEffect(() => {
    if (!activeShareUrl) return;
    setIsQrLoading(true);
    QRCode.toDataURL(activeShareUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        setQrCodeDataUrl(url);
        setIsQrLoading(false);
      })
      .catch((err) => {
        console.error("QR Code Error:", err);
        setIsQrLoading(false);
      });
  }, [activeShareUrl]);

  if (!isOpen || !tokenInfo) return null;

  const handleCopyUrl = async () => {
    try {
      await copyToClipboard(activeShareUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {}
  };

  const handleCopyToken = async () => {
    try {
      await copyToClipboard(tokenInfo.shareToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {}
  };

  // Helper label for current mode
  const activeModeInfo = CONNECTION_MODES.find((m) => m.mode === connectionMode);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Bottom-sheet on mobile, centered modal on desktop */}
      <div className="bottom-sheet sm:rounded-xl relative w-full sm:max-w-2xl bg-[#161618] border border-[#2A2A2C] sm:border shadow-2xl flex flex-col h-[90vh] sm:h-auto max-h-[92vh] sm:max-h-[88vh] overflow-hidden">

        {/* Drag Handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#3A3A3C]" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A2C]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#212124] border border-[#2A2A2C] flex items-center justify-center text-emerald-400">
              <QrCode className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E0E0E1]">Phone Pairing & Setup</h2>
              <p className="text-[11px] text-gray-400 font-mono">Connect your device to this CopyZapp bridge</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-[#212124] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#2A2A2C] bg-[#0E0E10] px-5 gap-2 overflow-x-auto custom-scrollbar">
          {(["qr", "android", "windows", "ios"] as const).map((tab) => {
            const icons = {
              qr: <QrCode className="w-4 h-4" />,
              android: <Smartphone className="w-4 h-4" />,
              windows: <Laptop className="w-4 h-4" />,
              ios: <Share2 className="w-4 h-4" />,
            };
            const labels = { qr: "Scan QR", android: "Android", windows: "Windows PWA", ios: "iOS" };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4.5 px-4.5 text-[13px] font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 min-h-[52px] ${
                  activeTab === tab
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                {icons[tab]}
                <span>{labels[tab]}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6 sm:space-y-7 custom-scrollbar">

          {/* ── QR TAB ─────────────────────────────────────────────────────── */}
          {activeTab === "qr" && (
            <div className="space-y-6 sm:space-y-8">
              {/* Connection Mode Selector */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-[#E0E0E1] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  Connection Mode — choose how phone reaches this PC
                </p>
                <div className="flex flex-wrap gap-3">
                  {CONNECTION_MODES.map(({ mode, label, icon, description, color }) => {
                    const available = isModeAvailable(mode);
                    const active = connectionMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => available && setConnectionMode(mode)}
                        disabled={!available}
                        title={available ? description : `${label} not available`}
                        className={`conn-pill py-3 px-5 text-sm font-bold transition-all ${
                          !available
                            ? "conn-pill-disabled"
                            : active
                            ? "conn-pill-active"
                            : "conn-pill-inactive"
                        }`}
                      >
                        <span className={active ? color : ""}>{icon}</span>
                        <span>{label}</span>
                        {!available && <span className="text-[10px] opacity-60 ml-1">(N/A)</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Mode context hint */}
                {activeModeInfo && (
                  <p className="text-xs text-gray-400 font-mono leading-relaxed flex items-center gap-2 pt-1">
                    <Info className="w-4 h-4 text-gray-400 shrink-0" />
                    {connectionMode === "wifi" && "Ensure phone & PC are on the same WiFi network (same router)."}
                    {connectionMode === "hotspot" && "Enable Windows Mobile Hotspot first, then connect your phone to it before scanning."}
                    {connectionMode === "cloud" && "Works over internet — phone can be anywhere. Requires APP_URL env to be configured."}
                    {connectionMode === "localhost" && "For same device / emulator testing only."}
                  </p>
                )}
              </div>

              {/* QR + Info side by side on desktop */}
              <div className="flex flex-col sm:flex-row gap-7 items-center sm:items-start">
                {/* QR Code */}
                <div className="flex flex-col items-center justify-center p-6 sm:p-7 bg-white rounded-2xl shadow-lg border border-gray-200 shrink-0">
                  {isQrLoading ? (
                    <div className="w-52 h-52 flex items-center justify-center">
                      <RefreshCw className="w-7 h-7 text-gray-400 animate-spin" />
                    </div>
                  ) : qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="CopyZapp Phone Pairing QR Code"
                      className="w-52 h-52 object-contain"
                    />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center text-gray-400 font-mono text-sm">
                      Generating…
                    </div>
                  )}
                  <span className="text-xs font-bold text-gray-600 mt-4 text-center">
                    Scan with Android Camera / Chrome
                  </span>
                  {/* Mode badge on QR */}
                  <span className={`mt-2.5 text-xs font-black uppercase tracking-wider ${activeModeInfo?.color || "text-gray-400"}`}>
                    {activeModeInfo?.label} Mode
                  </span>
                </div>

                {/* URL Info + Token */}
                <div className="flex-1 w-full space-y-5">
                  <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#2A2A2C] space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#E0E0E1]">Share Target URL</span>
                      <button
                        onClick={handleCopyUrl}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors"
                      >
                        {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedUrl ? "Copied!" : "Copy URL"}</span>
                      </button>
                    </div>
                    <div className="p-3.5 bg-[#161618] rounded-lg border border-[#2A2A2C] font-mono text-xs text-emerald-300 break-all select-all leading-relaxed">
                      {activeShareUrl}
                    </div>
                    <p className="text-xs text-gray-400 flex items-center gap-2 leading-relaxed">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      Capability token protected. 128-bit isolated endpoint.
                    </p>
                  </div>

                  {/* Token key */}
                  <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#2A2A2C] space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#E0E0E1]">Share Token</span>
                      <button
                        onClick={handleCopyToken}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#212124] text-gray-300 hover:bg-[#2A2A2C] rounded-lg transition-colors border border-[#2A2A2C]"
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedToken ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="font-mono text-xs text-gray-300 bg-[#161618] p-3.5 rounded-lg border border-[#2A2A2C] break-all select-all">
                      {tokenInfo.shareToken}
                    </div>
                  </div>

                  {/* Rotate token */}
                  <div className="pt-2">
                    <button
                      onClick={onRotateToken}
                      className="inline-flex items-center gap-2 text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5 animate-pulse" />
                      <span>Rotate Share Token (Invalidates old link)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Network Addresses Info Panel */}
              {networkInfo && networkInfo.addresses.length > 0 && (
                <div className="p-4.5 rounded-xl bg-[#0E0E10] border border-[#2A2A2C]">
                  <p className="text-sm font-bold text-gray-200 mb-3.5 flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" /> Detected Network Interfaces
                  </p>
                  <div className="space-y-2.5">
                    {networkInfo.addresses.map((addr, i) => (
                      <div key={i} className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              addr.type === "wifi"
                                ? "bg-emerald-400"
                                : addr.type === "hotspot"
                                ? "bg-amber-400"
                                : "bg-gray-500"
                            }`}
                          />
                          <span className="text-gray-300 font-semibold">{addr.name}</span>
                          <span className="text-gray-500 text-[10px]">({addr.interfaceName})</span>
                        </div>
                        <span className={`font-bold ${
                          addr.type === "wifi"
                            ? "text-emerald-400"
                            : addr.type === "hotspot"
                            ? "text-amber-400"
                            : "text-gray-400"
                        }`}>
                          {addr.ip}
                        </span>
                      </div>
                    ))}
                    {networkInfo.cloudUrl && (
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-400" />
                          <span className="text-gray-300 font-semibold">Cloud / APP_URL</span>
                        </div>
                        <span className="text-indigo-400 font-bold truncate max-w-[200px]">{networkInfo.cloudUrl}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ANDROID TAB ────────────────────────────────────────────────── */}
          {activeTab === "android" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs flex items-start gap-3">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block text-emerald-300 mb-1">Native Android Share Sheet</strong>
                  CopyZapp registers as an official OS Share Target via Web App Manifest. Once added to your phone home screen, it appears in the Android share sheet from Chrome, Twitter, Photos, YouTube, and more!
                </div>
              </div>

              <ol className="space-y-4">
                {[
                  {
                    step: 1,
                    title: "Open in Android Chrome",
                    desc: `Navigate to the server's IP in Chrome on your phone. Use the QR code above (${connectionMode} mode: ${activeShareUrl.replace(/\/api\/.*/, "")}).`,
                  },
                  {
                    step: 2,
                    title: 'Tap Chrome Menu (⋮) → "Add to Home Screen"',
                    desc: "This installs CopyZapp as a PWA with the Web Share Target manifest registered.",
                  },
                  {
                    step: 3,
                    title: "Share anything to CopyZapp",
                    desc: 'Tap share in any Android app → Select CopyZapp. The content appears on your PC dashboard in < 2 seconds!',
                  },
                ].map(({ step, title, desc }) => (
                  <li key={step} className="flex items-start gap-4 p-4 rounded-lg bg-[#0E0E10] border border-[#2A2A2C] transition-all hover:border-[#3A3A3C]">
                    <span className="w-7 h-7 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                      {step}
                    </span>
                    <div>
                      <span className="text-sm font-semibold text-[#E0E0E1]">{title}</span>
                      <p className="text-xs text-gray-400 font-mono mt-1 leading-relaxed">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* ── WINDOWS TAB ────────────────────────────────────────────────── */}
          {activeTab === "windows" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#0E0E10] border border-[#2A2A2C] space-y-3">
                <h3 className="text-sm font-semibold text-[#E0E0E1] flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-emerald-400" />
                  Install Windows PWA Dashboard
                </h3>
                <p className="text-xs text-gray-400 font-mono">
                  Enjoy an app-like chromeless window on Windows 11/10 with native clipboard access and live polling.
                </p>
                <div className="space-y-2 text-xs font-mono text-gray-300">
                  {[
                    'In Edge or Chrome, click the App Install icon in the address bar, or go to Menu → Apps → "Install CopyZapp".',
                    "Pin CopyZapp to your Windows Taskbar or Start Menu.",
                    "Keep it running in the background — new snippets appear within 4 seconds of sharing from your phone!",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="text-emerald-400 font-bold shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cloud deployment instructions */}
              <div className="p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/20 space-y-2.5">
                <h4 className="text-xs font-semibold text-indigo-300 flex items-center gap-2">
                  <Cloud className="w-3.5 h-3.5" /> Full Cloud Deployment (Access from Anywhere)
                </h4>
                <div className="space-y-1.5 text-[11px] font-mono text-gray-400">
                  <p>To make CopyZapp accessible over the internet (not just local network):</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1">
                    <li>Deploy to a cloud host (e.g. <span className="text-indigo-300">Railway, Fly.io, Render, or Google Cloud Run</span>).</li>
                    <li>Set the <code className="text-indigo-300">APP_URL</code> environment variable to your deployment URL (e.g. <code className="text-indigo-300">https://copyzapp.yourapp.com</code>).</li>
                    <li>The Cloud mode QR in the Pair tab will automatically use this URL.</li>
                    <li>Phone can now share from anywhere — WiFi, mobile data, etc.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* ── IOS TAB ────────────────────────────────────────────────────── */}
          {activeTab === "ios" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-xs flex items-start gap-3">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block text-indigo-300 mb-1">iOS Shortcuts Bridge</strong>
                  Apple Safari restricts Web Share Target in PWAs. On iPhone/iPad, use Apple Shortcuts to POST directly to your CopyZapp share target URL.
                </div>
              </div>

              <div className="p-4.5 rounded-lg bg-[#0E0E10] border border-[#2A2A2C] space-y-4">
                <p className="text-xs font-semibold text-gray-200 font-mono">Creating an iOS Share Shortcut:</p>
                <ol className="space-y-3 text-xs text-gray-400 font-mono">
                  {[
                    "Open Apple Shortcuts app → Create New Shortcut.",
                    'Set input to "Receive Shares (Text, URLs, Images)" in Share Sheet.',
                    `Add action: "Get Contents of URL" with POST method to:\n${activeShareUrl}`,
                    "Add form fields: title, text, url.",
                    'Name shortcut "CopyZapp" and save to Share Sheet!',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-indigo-400 font-bold shrink-0 text-sm">{i + 1}.</span>
                      <span className="whitespace-pre-wrap leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#2A2A2C] flex justify-end pb-safe">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-mono font-semibold bg-[#212124] text-gray-200 hover:bg-[#2A2A2C] rounded-lg transition-colors border border-[#2A2A2C]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
