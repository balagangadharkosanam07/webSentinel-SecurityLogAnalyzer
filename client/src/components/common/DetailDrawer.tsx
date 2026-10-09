import React from 'react';
import { X, Copy, Check, FileJson } from 'lucide-react';

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  data: Record<string, unknown> | null;
  children?: React.ReactNode;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  data,
  children,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (data) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-[#0b1220] border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d1629]">
            <div>
              <h2 className="text-base font-semibold text-slate-100">{title}</h2>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
              {data && (
                <button
                  onClick={handleCopy}
                  title="Copy Raw JSON"
                  className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors flex items-center gap-1 text-xs"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'JSON'}</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {children}

            {data && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileJson className="w-3.5 h-3.5 text-cyan-400" />
                    Structured Payload
                  </span>
                </div>
                <div className="rounded-md border border-slate-800 bg-[#070b14] p-3 overflow-x-auto">
                  <pre className="text-xs font-mono text-cyan-300/90 whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-[#0d1629] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              Close Panel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
