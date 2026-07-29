import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface ExpiryCountdownProps {
  createdAt: string;
  isPinned?: boolean;
}

export const ExpiryCountdown: React.FC<ExpiryCountdownProps> = ({ createdAt, isPinned }) => {
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(0);

  useEffect(() => {
    const calculateRemaining = () => {
      const createdTime = new Date(createdAt).getTime();
      const expiresTime = createdTime + 24 * 60 * 60 * 1000; // 24 hours
      const now = Date.now();
      const diff = Math.max(0, expiresTime - now);
      setTimeRemainingMs(diff);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  if (isPinned) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Clock className="w-3 h-3" />
        <span>Pinned</span>
      </div>
    );
  }

  const hours = Math.floor(timeRemainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemainingMs % (1000 * 60)) / 1000);

  const percentageLeft = Math.min(100, Math.max(0, (timeRemainingMs / (24 * 60 * 60 * 1000)) * 100));

  let textColor = "text-emerald-400";
  let barColor = "bg-emerald-500";

  if (hours < 2) {
    textColor = "text-rose-400";
    barColor = "bg-rose-500";
  } else if (hours < 6) {
    textColor = "text-amber-400";
    barColor = "bg-amber-500";
  }

  const formatTime = () => {
    if (timeRemainingMs <= 0) return "Expires soon";
    if (hours > 0) return `Expires in ${hours}h ${minutes}m`;
    if (minutes > 0) return `Expires in ${minutes}m ${seconds}s`;
    return `Expires in ${seconds}s`;
  };

  return (
    <div className={`inline-flex flex-col gap-1 items-end`}>
      <span className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${textColor}`}>
        {formatTime()}
      </span>
      <div className="w-20 bg-[#212124] rounded-full h-1 overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-1000 ease-linear`}
          style={{ width: `${percentageLeft}%` }}
        />
      </div>
    </div>
  );
};
