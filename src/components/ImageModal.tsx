import React from "react";
import { X, Download } from "lucide-react";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  prompt: string;
  groupId: string;
  onExport: (groupId: string) => Promise<void>;
  onEditPrompt?: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  prompt,
  groupId,
  onExport,
  onEditPrompt,
}) => {
  const [isExporting, setIsExporting] = React.useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(groupId);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
      onClick={onClose}
    >
      <div
        className="relative max-w-6xl max-h-[90vh] w-full mx-4 bg-white rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Image Preview</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Image Container */}
        <div className="flex items-center justify-center p-6 bg-gray-900">
          <img
            src={imageUrl}
            alt="Full size preview"
            className="max-w-full max-h-[60vh] object-contain"
          />
        </div>

        {/* Prompt Display */}
        <div className="p-4 border-t bg-gray-50">
          <p className="text-sm font-medium text-gray-700 mb-2">Prompt:</p>
          <p className="text-sm text-gray-600 italic">{prompt}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-white">
          {onEditPrompt && (
            <button
              onClick={onEditPrompt}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Edit Prompt
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={16} />
            {isExporting ? "Exporting..." : "Export Image"}
          </button>
        </div>
      </div>
    </div>
  );
};
