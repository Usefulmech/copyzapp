import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  QrCode,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
} from "lucide-react";

interface OnboardingWalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingWalkthrough: React.FC<OnboardingWalkthroughProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      icon: <Zap className="w-10 h-10 text-emerald-400 animate-pulse" />,
      title: "Welcome to CopyZap!",
      desc: "CopyZap is a premium, local-first clipboard bridge that connects your phone and PC. Send texts, links, or images instantly across devices without creating accounts or syncing passwords.",
      details: [
        "Instant 4-second short-polling synchronization.",
        "Ephemeral stream: snippets auto-expire after 24 hours.",
        "Pin snippets to save them permanently from deletion.",
      ],
    },
    {
      icon: <QrCode className="w-10 h-10 text-emerald-400" />,
      title: "Step 1: Instantly Pair Your Phone",
      desc: "Connect your devices securely using multi-network auto-detection. You can pair over your home/office Wi-Fi or directly connect to your PC's Mobile Hotspot when you're on the go.",
      details: [
        "Click 'Pair Phone' in the header to show the QR code.",
        "Select your network mode (WiFi, Hotspot, or Cloud).",
        "Scan the code with your phone camera to pair in seconds.",
      ],
    },
    {
      icon: <Smartphone className="w-10 h-10 text-indigo-400 animate-bounce" />,
      title: "Step 2: Add to Home Screen (PWA)",
      desc: "Once paired, install CopyZap as a Progressive Web App (PWA) in Chrome or Safari. On Android, it registers as a system Share Target so you can share directly to your PC!",
      details: [
        "Android: Chrome Menu (⋮) → 'Add to Home Screen' to register.",
        "Tap Share in any app (YouTube, Photos, Twitter) → Select CopyZap.",
        "iOS: Safari Share → 'Add to Home Screen' for instant dashboard access.",
      ],
    },
    {
      icon: <Sparkles className="w-10 h-10 text-indigo-400" />,
      title: "Step 3: Meet Your AI Assistant",
      desc: "CopyZap comes with a built-in Gemini AI Assistant. Analyze, summarize, or translate any shared snippets and talk to your files directly from the dashboard.",
      details: [
        "✨ Tap the Sparkles icon on any snippet to add it as context.",
        "Ask questions directly via the 'AI Assistant' in the header.",
        "Analyze images, summarize articles, or extract text contextually.",
      ],
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("copyzap_onboarding_completed", "true");
    onClose();
  };

  const current = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-[#161618] border border-[#2A2A2C] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header indicator */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#2A2A2C]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
              Walkthrough
            </span>
            <span className="text-[10px] bg-[#212124] px-2 py-0.5 rounded text-gray-400 font-mono">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <button
            onClick={handleComplete}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title="Skip Walkthrough"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content with Animation */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-6 custom-scrollbar min-h-[300px]">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-[#0E0E10] border border-[#2A2A2C] flex items-center justify-center shadow-inner">
              {current.icon}
            </div>
            <h3 className="text-lg font-black text-[#E0E0E1] tracking-tight">
              {current.title}
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 font-mono leading-relaxed">
              {current.desc}
            </p>
          </div>

          {/* Details list */}
          <div className="p-4.5 rounded-xl bg-[#0E0E10] border border-[#2A2A2C] space-y-3">
            {current.details.map((detail, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-300 font-mono leading-relaxed">
                <span className="shrink-0 mt-0.5">▪</span>
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Indicator dots */}
        <div className="flex justify-center gap-1.5 py-2">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentStep === idx ? "w-6 bg-emerald-500" : "w-1.5 bg-[#2A2A2C]"
              }`}
            />
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-[#2A2A2C] flex items-center justify-between bg-[#0E0E10]">
          <button
            onClick={handleComplete}
            className="text-xs font-mono text-gray-500 hover:text-gray-300 font-semibold px-2 py-1"
          >
            Skip Guide
          </button>

          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold bg-[#161618] hover:bg-[#2A2A2C] text-gray-300 border border-[#2A2A2C] transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-lg text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/10 transition-colors"
            >
              <span>{currentStep === steps.length - 1 ? "Get Started!" : "Next"}</span>
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
