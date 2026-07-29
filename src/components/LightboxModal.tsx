import React, { useState } from "react";
import { X, Download, ExternalLink, Copy, Check, Maximize2 } from "lucide-react";

interface LightboxModalProps {
  imageUrl: string | null;
  title: string;
  onClose: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({ imageUrl, title, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!imageUrl) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + imageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-fade-in">
      <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
        {/* Controls Bar */}
        <div className="w-full flex items-center justify-between pb-3 text-[#E0E0E1]">
          <span className="text-xs font-mono font-semibold truncate max-w-md">{title}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium bg-[#161618] hover:bg-[#212124] text-gray-200 rounded-lg border border-[#2A2A2C] transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied Link" : "Copy Image Link"}</span>
            </button>
            <a
              href={imageUrl}
              download={`copyzapp-${Date.now()}.png`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-100 bg-[#161618] hover:bg-[#212124] rounded-lg transition-colors ml-2 border border-[#2A2A2C]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="relative rounded-xl overflow-hidden border border-[#2A2A2C] bg-[#161618] shadow-2xl max-h-[80vh] flex items-center justify-center">
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[80vh] w-auto max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
};
