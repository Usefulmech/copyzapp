import React, { useState } from "react";
import { UserTokenInfo } from "../types";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL, prepareUploadFile, fileToBase64 } from "../utils/fileTransfer";
import {
  X,
  Upload,
  Plus,
  Link as LinkIcon,
  FileText,
  Send,
} from "lucide-react";

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenInfo: UserTokenInfo | null;
  onAdded: () => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  tokenInfo,
  onAdded,
}) => {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Revoke object URL when previewUrl changes or on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen || !tokenInfo) return null;

  const selectFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`File size exceeds the ${MAX_FILE_SIZE_LABEL} limit.`);
      return;
    }
    const preparedFile = await prepareUploadFile(file);
    setSelectedFile(preparedFile);
    setPreviewUrl(preparedFile.type.startsWith("image/") ? URL.createObjectURL(preparedFile) : null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await selectFile(e.target.files[0]);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await selectFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text && !url && !selectedFile) {
      alert("Please enter text, a URL, or attach a file.");
      return;
    }

    setIsSubmitting(true);
    try {
      let base64Image: string | null = null;
      if (selectedFile) {
        base64Image = await fileToBase64(selectedFile);
      }

      const payload = {
        token: tokenInfo.shareToken,
        title: title || undefined,
        text: text || undefined,
        url: url || undefined,
        base64Image: base64Image || undefined,
      };

      const res = await fetch("/api/memories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenInfo.shareToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onAdded();
        setTitle("");
        setText("");
        setUrl("");
        setSelectedFile(null);
        setPreviewUrl(null);
        onClose();
      } else {
        alert("Failed to create memory snippet");
      }
    } catch (err) {
      console.error("Error creating snippet:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bottom-sheet modal-panel relative sm:max-w-lg flex flex-col h-[90vh] sm:h-auto max-h-[92vh] sm:max-h-[88vh]">
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#3A3A3C]" />
        </div>
        <div className="flex items-center justify-between p-5 border-b border-[#2A2A2C] bg-[#161618]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#212124] border border-[#2A2A2C] flex items-center justify-center text-emerald-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E0E0E1]">Direct Dashboard Quick Add</h2>
              <p className="text-xs text-gray-400 font-mono">Add text, URLs, or images from your PC</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-[#212124] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1 modal-scroll custom-scrollbar">
          <div>
            <label className="text-xs font-mono font-medium text-gray-300 block mb-1">
              Title <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Quick Note or Article Title"
              className="w-full px-3.5 py-2.5 bg-[#0E0E10] border border-[#2A2A2C] rounded-lg text-xs text-[#E0E0E1] focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-mono font-medium text-gray-300 block mb-1">Text Snippet / Content</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Type or paste code, snippet, or text..."
              className="w-full px-3.5 py-2.5 bg-[#0E0E10] border border-[#2A2A2C] rounded-lg text-xs text-emerald-200 focus:outline-none focus:border-emerald-500 transition-colors font-mono custom-scrollbar"
            />
          </div>

          <div>
            <label className="text-xs font-mono font-medium text-gray-300 block mb-1 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Link / URL</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2.5 bg-[#0E0E10] border border-[#2A2A2C] rounded-lg text-xs text-emerald-300 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            />
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="p-4 rounded-lg border-2 border-dashed border-[#2A2A2C] hover:border-emerald-500/50 bg-[#0E0E10] flex flex-col items-center justify-center text-center transition-colors cursor-pointer"
          >
            <input
              type="file"
              onChange={handleFileChange}
              className="hidden"
              id="quickadd-file-input"
            />
            <label htmlFor="quickadd-file-input" className="cursor-pointer space-y-1">
              <Upload className="w-6 h-6 text-gray-400 mx-auto" />
              <span className="text-xs text-gray-300 font-medium block">
                {selectedFile ? selectedFile.name : "Drag any file here or click to browse"}
              </span>
              <span className="text-[11px] text-gray-500 font-mono block">Any file format up to {MAX_FILE_SIZE_LABEL}</span>
            </label>
            {previewUrl ? (
              <div className="mt-3 relative w-20 h-20 rounded-lg overflow-hidden border border-[#2A2A2C]">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : selectedFile && (
              <div className="mt-3 p-2 bg-[#161618] border border-[#2A2A2C] rounded-lg text-[11px] text-gray-300 font-mono flex items-center gap-2 max-w-full">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="truncate max-w-[150px]">{selectedFile.name}</span>
              </div>
            )}
          </div>

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
              disabled={isSubmitting}
              className="action-button px-4 py-2 text-xs bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Creating..." : "Add to Dashboard"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
