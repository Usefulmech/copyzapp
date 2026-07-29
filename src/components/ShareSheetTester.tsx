import React, { useState } from "react";
import { UserTokenInfo } from "../types";
import {
  Smartphone,
  Send,
  X,
  Link as LinkIcon,
  FileText,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Sparkles,
  Chrome,
  Twitter,
  Youtube,
  Share2
} from "lucide-react";

interface ShareSheetTesterProps {
  isOpen: boolean;
  onClose: () => void;
  tokenInfo: UserTokenInfo | null;
  onShareSuccess: () => void;
}

const PRESET_SHARES = [
  {
    name: "Chrome Browser Article",
    app: "Chrome Android",
    icon: Chrome,
    title: "Building Local-First Web Apps in 2026",
    text: "Great read on CRDTs and offline-first state synchronization:",
    url: "https://example.com/local-first-2026",
  },
  {
    name: "Twitter / X Post",
    app: "X Mobile",
    icon: Twitter,
    title: "Shared from X",
    text: "Check out this update on high performance serverless postgres:",
    url: "https://x.com/tech_insider/status/182736451",
  },
  {
    name: "YouTube Video Link",
    app: "YouTube Android",
    icon: Youtube,
    title: "How Ephemeral Storage Works - Tech Deep Dive",
    text: "Awesome video tutorial on 24h auto-expiry caches:",
    url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    name: "Code Snippet / Plain Text",
    app: "Notes App",
    icon: FileText,
    title: "Docker Compose snippet for Postgres",
    text: "version: '3.8'\nservices:\n  db:\n    image: postgres:16-alpine\n    ports:\n      - '5432:5432'\n    environment:\n      POSTGRES_PASSWORD: secret",
    url: "",
  },
];

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = "25 MB";

export const ShareSheetTester: React.FC<ShareSheetTesterProps> = ({
  isOpen,
  onClose,
  tokenInfo,
  onShareSuccess,
}) => {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [shareResponse, setShareResponse] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);

  if (!isOpen || !tokenInfo) return null;

  const handleSelectPreset = (preset: typeof PRESET_SHARES[0]) => {
    setTitle(preset.title);
    setText(preset.text);
    setUrl(preset.url);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`File size exceeds the ${MAX_FILE_SIZE_LABEL} limit.`);
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    }
  };

  const handleSimulateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title && !text && !url && !selectedFile) {
      alert("Please provide at least a title, text, URL, or image to share.");
      return;
    }

    setIsSending(true);
    setShareResponse(null);

    try {
      const formData = new FormData();
      if (title) formData.append("title", title);
      if (text) formData.append("text", text);
      if (url) formData.append("url", url);
      if (selectedFile) formData.append("image", selectedFile);

      const endpoint = `/api/share-receiver/${tokenInfo.shareToken}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: formData,
      });

      setResponseStatus(response.status);

      if (response.status === 204 || response.ok) {
        setShareResponse(`HTTP ${response.status} Success: Shared to CopyZap in <2s!`);
        onShareSuccess();
        setTimeout(() => {
          setIsSending(false);
          // Reset fields
          setTitle("");
          setText("");
          setUrl("");
          setSelectedFile(null);
          setPreviewUrl(null);
        }, 1200);
      } else {
        const errData = await response.json();
        setShareResponse(`Error ${response.status}: ${errData.error || "Failed to share"}`);
        setIsSending(false);
      }
    } catch (err) {
      console.error("Share simulation error:", err);
      setShareResponse("Network error: Could not reach share receiver endpoint");
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bottom-sheet sm:rounded-xl relative w-full sm:max-w-xl bg-[#161618] border border-[#2A2A2C] shadow-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto max-h-[92vh] sm:max-h-[88vh]">
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#3A3A3C]" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2A2A2C] bg-[#161618]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#212124] border border-[#2A2A2C] flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E0E0E1] flex items-center gap-2">
                Android Share Sheet Simulator
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Test sending shares to CopyZap as if from Android native share sheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-[#212124] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Quick Presets */}
          <div>
            <label className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider block mb-2">
              Quick Test Presets (Simulate Mobile Apps)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_SHARES.map((preset, idx) => {
                const IconComponent = preset.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0E0E10] hover:bg-[#212124] border border-[#2A2A2C] hover:border-emerald-500/40 text-left transition-all text-xs text-gray-200 group"
                  >
                    <IconComponent className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="truncate font-mono">
                      <span className="font-semibold block truncate">{preset.name}</span>
                      <span className="text-[10px] text-gray-400 truncate block">{preset.app}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSimulateShare} className="space-y-4">
            <div>
              <label className="text-xs font-mono font-medium text-gray-300 block mb-1">
                Share Title <span className="text-gray-500">(Source App Title)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Shared from Chrome / YouTube"
                className="w-full px-3.5 py-2.5 bg-[#0E0E10] border border-[#2A2A2C] rounded-lg text-xs text-[#E0E0E1] focus:outline-none focus:border-emerald-500 transition-colors font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-mono font-medium text-gray-300 block mb-1">
                Shared Text Snippet / Body
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Paste or write snippet text here..."
                className="w-full px-3.5 py-2.5 bg-[#0E0E10] border border-[#2A2A2C] rounded-lg text-xs text-emerald-200 focus:outline-none focus:border-emerald-500 transition-colors font-mono custom-scrollbar"
              />
            </div>

            <div>
              <label className="text-xs font-mono font-medium text-gray-300 block mb-1 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Shared URL / Link</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 bg-[#0E0E10] border border-[#2A2A2C] rounded-lg text-xs text-emerald-300 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-mono font-medium text-gray-300 block mb-1 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Attach File (Max {MAX_FILE_SIZE_LABEL})</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="simulator-file-input"
                />
                <label
                  htmlFor="simulator-file-input"
                  className="px-3.5 py-2 bg-[#212124] hover:bg-[#2A2A2C] text-xs font-mono font-medium text-gray-200 border border-[#2A2A2C] rounded-lg cursor-pointer transition-colors"
                >
                  {selectedFile ? "Change File" : "Choose File"}
                </label>
                {selectedFile && (
                  <span className="text-xs text-gray-300 font-mono truncate max-w-[200px]">
                    {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                )}
              </div>
              {previewUrl && (
                <div className="mt-2 relative w-24 h-24 rounded-lg overflow-hidden border border-[#2A2A2C] bg-[#0E0E10]">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* HTTP POST Target Info */}
            <div className="p-3 bg-[#0E0E10] rounded-lg border border-[#2A2A2C] font-mono text-[11px] text-gray-400 space-y-1">
              <div className="text-emerald-400 font-semibold">
                POST /api/share-receiver/{tokenInfo.shareToken.slice(0, 16)}...
              </div>
              <div>Content-Type: multipart/form-data</div>
            </div>

            {shareResponse && (
              <div
                className={`p-3 rounded-lg border text-xs font-mono flex items-center gap-2 ${
                  responseStatus === 204 || responseStatus === 200
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                {responseStatus === 204 || responseStatus === 200 ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{shareResponse}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-mono font-semibold bg-[#212124] text-gray-300 hover:bg-[#2A2A2C] rounded-lg transition-colors border border-[#2A2A2C]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg shadow-sm disabled:opacity-50 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? "Sending Share..." : "Fire Android Share POST"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
