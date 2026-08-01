import React, { useState, useEffect, useRef } from "react";
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
  Camera,
} from "lucide-react";

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenInfo: UserTokenInfo | null;
  networkInfo: NetworkInfo | null;
  onRotateToken: () => void;
  onPair: (token: string) => void;
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
  onPair,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"qr" | "scan">("qr");
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("wifi");
  const [isQrLoading, setIsQrLoading] = useState(false);

  const isMobileUserAgent = typeof navigator !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const [showScanTab] = useState<boolean>(isMobileUserAgent);

  // QR Camera Scanner state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const openedAt = useRef<number>(Date.now());

  // Resolve active share URL based on connection mode + networkInfo (for POST target endpoints)
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

  // Resolve active pairing URL based on connection mode + networkInfo (for scanner scan target / browser landing pages)
  const activePairingUrl = (() => {
    if (!tokenInfo) return "";
    const token = tokenInfo.shareToken;
    if (connectionMode === "cloud") {
      const host = networkInfo?.cloudUrl || window.location.origin;
      return `${host}/?token=${token}`;
    }
    if (connectionMode === "localhost") {
      return `http://localhost:${networkInfo?.serverPort || 3000}/?token=${token}`;
    }
    if (connectionMode === "wifi") {
      const wifiAddr = networkInfo?.addresses.find((a) => a.type === "wifi");
      if (wifiAddr) {
        return `http://${wifiAddr.ip}:${networkInfo?.serverPort || 3000}/?token=${token}`;
      }
    }
    if (connectionMode === "hotspot") {
      const hotspotAddr = networkInfo?.addresses.find((a) => a.type === "hotspot");
      if (hotspotAddr) {
        return `http://${hotspotAddr.ip}:${networkInfo?.serverPort || 3000}/?token=${token}`;
      }
    }
    return `${window.location.origin}/?token=${token}`;
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

  async function startScanning() {
    setScanError(null);
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.play();
      }

      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });

        const detectFrame = async () => {
          if (!streamRef.current || !videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const qrValue = barcodes[0].rawValue;
              handleScannedValue(qrValue);
            } else {
              requestAnimationFrame(detectFrame);
            }
          } catch (err) {
            requestAnimationFrame(detectFrame);
          }
        };

        requestAnimationFrame(detectFrame);
      } else {
        setScanError(
          "In-browser QR scanning is not supported by your browser. Please use your phone's native camera app to scan the code."
        );
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setScanError("Camera access denied or unavailable. Make sure to grant camera permissions.");
    }
  }

  function stopScanning() {
    setIsScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function handleScannedValue(value: string) {
    let token = "";
    if (value.startsWith("cz-")) {
      token = value;
    } else {
      try {
        const url = new URL(value);
        token = url.searchParams.get("token") || "";
        if (!token) {
          const parts = url.pathname.split("/");
          const lastPart = parts[parts.length - 1];
          if (lastPart && lastPart.startsWith("cz-")) {
            token = lastPart;
          }
        }
      } catch {
        const match = value.match(/cz-[a-f0-9]+/);
        if (match) token = match[0];
      }
    }

    if (token) {
      onPair(token);
      stopScanning();
    } else {
      if ("BarcodeDetector" in window) {
        requestAnimationFrame(detectFrameFallback);
      }
    }
  }

  async function detectFrameFallback() {
    if (!streamRef.current || !videoRef.current) return;
    try {
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      const barcodes = await detector.detect(videoRef.current);
      if (barcodes.length > 0) {
        handleScannedValue(barcodes[0].rawValue);
      } else {
        requestAnimationFrame(detectFrameFallback);
      }
    } catch {
      requestAnimationFrame(detectFrameFallback);
    }
  }

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

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    stopScanning();
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

  // Generate QR whenever pairing URL changes
  useEffect(() => {
    if (!activePairingUrl) return;
    setIsQrLoading(true);
    QRCode.toDataURL(activePairingUrl, {
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
  }, [activePairingUrl]);

  // Cleanup scanner on unmount, modal close or tab switch
  useEffect(() => {
    if (!isOpen) {
      stopScanning();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  // Reset openedAt timestamp when the modal is opened
  useEffect(() => {
    if (isOpen) {
      openedAt.current = Date.now();
    }
  }, [isOpen]);

  // Poll for QR code scanned status while PairingModal is open
  useEffect(() => {
    if (!isOpen || !tokenInfo?.shareToken) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/tokens/qr-status?token=${tokenInfo.shareToken}`);
        if (res.ok) {
          const data = await res.json();
          if (data.scannedAt) {
            const scanTime = new Date(data.scannedAt).getTime();
            if (scanTime > openedAt.current) {
              console.log("QR scan detected, closing modal and pairing");
              // Successfully scanned! Call onPair to save, toast, and close modal
              onPair(tokenInfo.shareToken);
            }
          }
        } else {
          console.warn("QR status check failed with status:", res.status);
        }
      } catch (err) {
        console.error("Error polling QR scan status:", err);
      }
    }, 1500);

    return () => clearInterval(intervalId);
  }, [isOpen, tokenInfo?.shareToken, onPair]);

  if (!isOpen || !tokenInfo) return null;

  const activeModeInfo = CONNECTION_MODES.find((m) => m.mode === connectionMode);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bottom-sheet modal-panel relative sm:max-w-3xl flex flex-col h-[90vh] sm:h-auto max-h-[92vh] sm:max-h-[88vh]">
        {/* Drag Handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#3A3A3C]" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#2A2A2C]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#212124] border border-[#2A2A2C] flex items-center justify-center text-emerald-400">
              <QrCode className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#E0E0E1] tracking-tight">Phone Pairing & Setup</h2>
              <p className="text-xs text-gray-400 font-mono">Connect your device to this CopyZapp bridge</p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              stopScanning();
            }}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-[#212124] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        {showScanTab ? (
          <div className="flex border-b border-[#2A2A2C] bg-[#0E0E10] px-5 gap-5 overflow-x-auto no-scrollbar">
            {(["qr", "scan"] as const).map((tab) => {
              const icons = {
                qr: <QrCode className="w-4 h-4" />,
                scan: <Camera className="w-4 h-4" />,
              };
              const labels = {
                qr: "Scan QR",
                scan: "Camera Scanner",
              };
              return (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`py-4 px-1 text-sm font-extrabold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 min-h-[58px] leading-none ${
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
        ) : null}

        {/* Modal Content */}
        <div className="p-5 sm:p-6 modal-scroll flex-1 space-y-6 sm:space-y-7 custom-scrollbar">
          {/* ── QR TAB ─────────────────────────────────────────────────────── */}
          {activeTab === "qr" && (
            <div className="space-y-6 sm:space-y-8">
              {/* Connection Mode Selector */}
              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-200 flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Connection Mode - choose how phone reaches this PC</span>
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

                {activeModeInfo && (
                  <p className="text-xs text-gray-400 font-mono leading-relaxed flex items-center gap-2 pt-1">
                    <Info className="w-4 h-4 text-gray-400 shrink-0" />
                    {connectionMode === "wifi" && "Ensure phone & PC are on the same WiFi network (same router)."}
                    {connectionMode === "hotspot" && "Enable Windows Mobile Hotspot first, then connect your phone to it before scanning."}
                    {connectionMode === "cloud" && "Works over internet - phone can be anywhere."}
                    {connectionMode === "localhost" && "For same device / emulator testing only."}
                  </p>
                )}
              </div>

              {/* QR + Info side by side on desktop */}
              <div className="flex flex-col sm:flex-row gap-7 items-stretch">
                {/* QR Code Card */}
                <div className="flex flex-col items-center justify-center p-6 bg-[#0E0E10] border border-[#2A2A2C] rounded-xl w-full sm:w-auto sm:min-w-[240px] shrink-0 shadow-sm">
                  <div className="p-3.5 bg-white rounded-lg shadow-inner flex items-center justify-center">
                    {isQrLoading ? (
                      <div className="w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                      </div>
                    ) : qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt="CopyZapp Phone Pairing QR Code"
                        className="w-40 h-40 sm:w-44 sm:h-44 object-contain"
                      />
                    ) : (
                      <div className="w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center text-gray-400 font-mono text-xs">
                        Generating...
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-gray-400 mt-4 text-center font-mono">
                    Scan with Android Camera
                  </span>
                  <span className={`mt-2 text-xs font-black uppercase tracking-wider font-mono ${activeModeInfo?.color || "text-gray-400"}`}>
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

          {/* ── CAMERA SCANNER TAB ────────────────────────────────────────── */}
          {activeTab === "scan" && (
            <div className="space-y-6">
              {!isScanning ? (
                <div className="flex flex-col items-center justify-center min-h-[320px] sm:min-h-[360px] p-6 sm:p-8 bg-[#0E0E10] border border-[#2A2A2C] rounded-xl space-y-5 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#161618] border border-[#2A2A2C] flex items-center justify-center text-emerald-400 shadow-inner">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-100 tracking-tight">Scan PC Dashboard QR</h3>
                    <p className="text-sm text-gray-400 mt-2 max-w-sm leading-relaxed">
                      Use your phone's browser camera to scan the QR code displayed on your PC screen and instantly pair the devices.
                    </p>
                  </div>
                  <button
                    onClick={startScanning}
                    className="action-button px-6 py-3 text-sm bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/15"
                  >
                    <Camera className="w-4 h-4" />
                    Start Scanner
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center w-full space-y-4">
                  <div className="relative w-full max-w-xl h-[min(55vh,420px)] bg-black border border-[#2A2A2C] rounded-xl overflow-hidden shadow-inner">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                      muted
                    />
                    <div className="absolute inset-0 pointer-events-none border-[32px] border-black/50 flex items-center justify-center">
                      <div className="w-48 h-48 border-2 border-emerald-500 rounded-lg animate-pulse" />
                    </div>
                    {scanError && (
                      <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center space-y-3">
                        <p className="text-xs font-mono text-rose-400 leading-relaxed">{scanError}</p>
                        <button
                          onClick={startScanning}
                          className="px-3.5 py-1.5 text-xs font-mono font-semibold bg-[#212124] text-gray-300 hover:bg-[#2A2A2C] border border-[#2A2A2C] rounded-lg transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={stopScanning}
                    className="action-button px-5 py-2 text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30"
                  >
                    Stop Scanner
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#2A2A2C] flex justify-end pb-safe bg-[#161618] shrink-0">
          <button
            onClick={() => {
              onClose();
              stopScanning();
            }}
            className="px-5 py-2 text-xs font-mono font-semibold bg-[#212124] text-gray-200 hover:bg-[#2A2A2C] rounded-lg transition-colors border border-[#2A2A2C]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
