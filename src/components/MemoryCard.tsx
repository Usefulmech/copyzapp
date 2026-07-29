import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Memory } from "../types";
import { ExpiryCountdown } from "./ExpiryCountdown";
import { copyToClipboard, copyImageToClipboard } from "../utils/clipboard";
import {
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Pin,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  Maximize2,
  Share2,
  Globe,
  Sparkles,
} from "lucide-react";

interface MemoryCardProps {
  memory: Memory;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onOpenImage: (imageUrl: string, title: string) => void;
  onToast: (msg: string) => void;
  onAskAi?: (id: string) => void;
}

export const MemoryCard: React.FC<MemoryCardProps> = ({
  memory,
  onDelete,
  onTogglePin,
  onOpenImage,
  onToast,
  onAskAi,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyText = async () => {
    try {
      if (memory.imageUrl) {
        const res = await copyImageToClipboard(memory.imageUrl);
        setCopied(true);
        if (res.type === "image") {
          onToast("Copied image to clipboard!");
        } else {
          onToast("Copied image URL!");
        }
      } else {
        const textToCopy = memory.body || memory.link || memory.title;
        await copyToClipboard(textToCopy);
        setCopied(true);
        onToast("Copied to clipboard!");
      }
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast("Copy failed — try long-pressing the text");
    }
  };

  const getDomain = (urlStr: string) => {
    try {
      return new URL(urlStr).hostname.replace("www.", "");
    } catch {
      return urlStr;
    }
  };

  const isLink = Boolean(memory.link);
  const isImage = Boolean(memory.imageUrl);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -12 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`group relative rounded-xl bg-[#161618] border transition-colors duration-200 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 overflow-hidden flex flex-col justify-between ${
        memory.isPinned
          ? "border-amber-500/40 shadow-lg shadow-amber-500/5"
          : "border-[#2A2A2C]"
      }`}
    >
      {/* Top Bar */}
      <div className="p-3.5 pb-3 flex items-start justify-between gap-3 border-b border-[#2A2A2C] bg-[#161618]">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Icon Badge */}
          {isImage ? (
            <span className="p-2 rounded-lg bg-[#212124] text-indigo-400 border border-[#2A2A2C] shrink-0">
              <ImageIcon className="w-4 h-4" />
            </span>
          ) : isLink ? (
            <span className="p-2 rounded-lg bg-[#212124] text-emerald-400 border border-[#2A2A2C] shrink-0">
              <LinkIcon className="w-4 h-4" />
            </span>
          ) : (
            <span className="p-2 rounded-lg bg-[#212124] text-emerald-400 border border-[#2A2A2C] shrink-0">
              <FileText className="w-4 h-4" />
            </span>
          )}

          <h3 className="text-xs font-bold text-[#E0E0E1] truncate leading-tight">
            {memory.title || (isLink ? "Shared Link" : "Shared Snippet")}
          </h3>
        </div>

        {/* 24h Expiry Timer */}
        <div className="shrink-0">
          <ExpiryCountdown createdAt={memory.createdAt} isPinned={memory.isPinned} />
        </div>
      </div>

      {/* Main Body */}
      <div className="p-4 space-y-3 flex-1">
        {/* Link Render */}
        {memory.link && (
          <div className="p-3 rounded-lg bg-[#0E0E10] border border-[#2A2A2C] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] font-medium truncate max-w-[200px]">
                <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{getDomain(memory.link)}</span>
              </span>
              <a
                href={memory.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span>Open Link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="text-xs text-gray-300 font-mono break-all line-clamp-2 select-all">
              {memory.link}
            </div>
          </div>
        )}

        {/* Image Attachment Render */}
        {memory.imageUrl && (
          <div
            onClick={() => onOpenImage(memory.imageUrl!, memory.title)}
            className="group/img relative rounded-lg overflow-hidden border border-[#2A2A2C] bg-[#0E0E10] cursor-pointer max-h-64 flex items-center justify-center"
          >
            <img
              src={memory.imageUrl}
              alt={memory.title}
              className="w-full h-auto max-h-64 object-cover group-hover/img:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161618] text-xs font-medium text-gray-200 border border-[#2A2A2C] shadow-xl">
                <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Expand Image</span>
              </span>
            </div>
          </div>
        )}

        {/* Text Body */}
        {memory.body && (
          <div
            onClick={handleCopyText}
            title="Click snippet to copy"
            className="group/text relative p-3 rounded-lg bg-[#0E0E10] border border-[#2A2A2C] hover:border-emerald-500/50 cursor-pointer text-xs text-emerald-200 font-mono whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto custom-scrollbar transition-colors select-all"
          >
            {memory.body}
            <AnimatePresence>
              {copied && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-2 right-2 px-2 py-1 bg-emerald-500 text-black text-[10px] font-extrabold font-mono rounded shadow-lg flex items-center gap-1 pointer-events-none z-10"
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>Copied!</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Card Action Footer */}
      <div className="p-2.5 px-3.5 bg-[#111113] border-t border-[#1A1A1C] flex items-center justify-between min-h-[48px]">
        <div className="flex items-center gap-2">
          {/* Prominent Copy Button */}
          <button
            onClick={handleCopyText}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all min-h-[40px] ${
              copied
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied!" : "1-Click Copy"}</span>
          </button>

          {/* Pin Button */}
          <button
            onClick={() => onTogglePin(memory.id)}
            title={memory.isPinned ? "Unpin memory" : "Pin memory (Immune to 24h expiration)"}
            className={`p-2.5 rounded-md text-xs transition-colors border min-h-[40px] min-w-[40px] flex items-center justify-center ${
              memory.isPinned
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#212124] border-transparent"
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>

          {/* Ask AI Button */}
          {onAskAi && (
            <button
              onClick={() => onAskAi(memory.id)}
              title="Ask Gemini about this snippet"
              className="p-2.5 rounded-md text-xs transition-colors border border-transparent text-indigo-400 hover:text-indigo-300 hover:bg-[#212124] min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Sparkles className="w-3.5 h-3.5 fill-indigo-400/10 animate-pulse" />
            </button>
          )}
        </div>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(memory.id)}
          title="Delete now"
          className="p-2.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};
