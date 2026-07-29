import React from "react";
import { Check, Sparkles } from "lucide-react";

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-500 text-black rounded-lg shadow-2xl font-mono uppercase tracking-wider font-bold text-xs animate-bounce-short border border-emerald-300">
      <Check className="w-4 h-4 stroke-[3]" />
      <span>{message}</span>
    </div>
  );
};
