import React, { useState, useEffect, useRef } from "react";
import { Memory, UserTokenInfo } from "../types";
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Trash2,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  AlertTriangle,
} from "lucide-react";

interface AiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tokenInfo: UserTokenInfo | null;
  memories: Memory[];
  selectedMemoryIds: string[];
  onRemoveContext: (id: string) => void;
  onClearContext: () => void;
}

interface Message {
  role: "user" | "ai";
  text: string;
  timestamp: Date;
  error?: boolean;
}

export const AiChatDrawer: React.FC<AiChatDrawerProps> = ({
  isOpen,
  onClose,
  tokenInfo,
  memories,
  selectedMemoryIds,
  onRemoveContext,
  onClearContext,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isOpen) return null;

  // Resolve current active snippets in context
  const contextSnippets = memories.filter((m) => selectedMemoryIds.includes(m.id));

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userPrompt = input.trim();
    setInput("");

    // Append user message
    const userMsg: Message = {
      role: "user",
      text: userPrompt,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenInfo?.shareToken ?? ""}`,
        },
        body: JSON.stringify({
          prompt: userPrompt,
          memoryIds: selectedMemoryIds,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: data.text, timestamp: new Date() },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: data.error || "Failed to get AI response. Please make sure GEMINI_API_KEY is configured correctly.",
            timestamp: new Date(),
            error: true,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Network error. Unable to reach AI assistant. Check your connection or server log.",
          timestamp: new Date(),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Backdrop close capture */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="w-full sm:max-w-md md:max-w-lg bg-[#161618] border-l border-[#2A2A2C] h-full flex flex-col shadow-2xl relative animate-slide-left">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4.5 border-b border-[#2A2A2C] bg-[#161618] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4.5 h-4.5 fill-indigo-400/20" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#E0E0E1]">CopyZapp AI Assistant</h2>
              <p className="text-[10px] text-gray-400 font-mono">Talk to your snippets & files</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#212124] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Context Area */}
        <div className="px-4.5 py-3 bg-[#0E0E10] border-b border-[#2A2A2C] shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              Context: {contextSnippets.length} selected
            </span>
            {contextSnippets.length > 0 && (
              <button
                onClick={onClearContext}
                className="text-[10px] font-mono text-rose-400 hover:text-rose-300 font-semibold"
              >
                Clear Context
              </button>
            )}
          </div>

          {contextSnippets.length === 0 ? (
            <p className="text-[11px] text-gray-500 font-mono italic">
              No snippets selected. Tap the Sparkles icon (✨) on any snippet card to load it into AI context.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar pr-1 py-0.5">
              {contextSnippets.map((m) => (
                <div
                  key={m.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#212124] border border-[#2A2A2C] text-[11px] text-gray-200 font-mono max-w-full"
                >
                  {m.imageUrl ? (
                    <ImageIcon className="w-3 h-3 text-indigo-400 shrink-0" />
                  ) : m.link ? (
                    <LinkIcon className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                  )}
                  <span className="truncate max-w-[120px]">{m.title}</span>
                  <button
                    onClick={() => onRemoveContext(m.id)}
                    className="p-0.5 text-gray-500 hover:text-rose-400 rounded transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversation Box */}
        <div className="flex-1 overflow-y-auto p-4.5 space-y-4 bg-[#0B0B0C] custom-scrollbar">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-xs mx-auto space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 animate-pulse">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-200">Start a Chat Now</h3>
                <p className="text-[11px] text-gray-500 font-mono leading-relaxed">
                  Select snippets to load them into AI context. You can ask Gemini to summarize links, explain images, translate snippets, or search through your shared data.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col space-y-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed font-mono ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10"
                    : msg.error
                    ? "bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-tl-none flex items-start gap-2"
                    : "bg-[#161618] border border-[#2A2A2C] text-gray-200 rounded-tl-none shadow-sm"
                }`}
              >
                {msg.error && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                <div className="markdown-body whitespace-pre-wrap">{msg.text}</div>
              </div>
              <span className="text-[9px] text-gray-500 font-mono px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono py-1 px-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Gemini is generating response...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSend}
          className="p-4 border-t border-[#2A2A2C] bg-[#161618] flex items-center gap-2.5 shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              contextSnippets.length > 0
                ? "Ask about selected context..."
                : "Ask AI a question..."
            }
            className="flex-1 px-3.5 py-2.5 bg-[#0B0B0C] border border-[#2A2A2C] rounded-lg text-xs text-[#E0E0E1] placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              !input.trim() || loading
                ? "bg-[#212124] text-gray-600 border border-[#2A2A2C] cursor-not-allowed"
                : "bg-indigo-500 text-white hover:bg-indigo-400 shadow-md shadow-indigo-500/10 active:scale-95 cursor-pointer"
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
