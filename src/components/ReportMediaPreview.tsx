import React, { useState } from 'react';
import { ImageIcon, Video, X, ExternalLink, AlertCircle } from 'lucide-react';

interface ReportMediaPreviewProps {
  evidenceUrl?: string;
  videoLink?: string;
}

export const ReportMediaPreview: React.FC<ReportMediaPreviewProps> = ({ evidenceUrl, videoLink }) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);

  if (!evidenceUrl && !videoLink) {
    return (
      <div className="p-4 bg-canvas/40 rounded-2xl border border-secondary/20 text-xs text-slate-400 italic text-center">
        No media evidence attached to this report.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
        <ImageIcon className="w-4 h-4" />
        <span>Attached Media Evidence</span>
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Photo Evidence */}
        {evidenceUrl && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Photo Evidence</span>
            <div 
              onClick={() => !imageError && setLightboxUrl(evidenceUrl)}
              className="relative aspect-video rounded-2xl border border-cyan-500/30 overflow-hidden bg-slate-950 flex items-center justify-center cursor-pointer group shadow-lg"
            >
              {imageError ? (
                <div className="p-4 text-center space-y-1 text-red-300 text-xs">
                  <AlertCircle className="w-6 h-6 mx-auto text-red-400" />
                  <span>Failed to load image preview</span>
                </div>
              ) : (
                <>
                  <img
                    src={evidenceUrl}
                    alt="Report Evidence"
                    onError={() => setImageError(true)}
                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-black uppercase tracking-wider gap-1.5">
                    <ExternalLink className="w-4 h-4" /> Click to Zoom
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Video Evidence */}
        {videoLink && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Video Evidence</span>
            <div className="relative rounded-2xl border border-indigo-500/30 overflow-hidden bg-slate-950 shadow-lg">
              {videoError ? (
                <div className="p-6 text-center space-y-2 text-red-300 text-xs">
                  <AlertCircle className="w-6 h-6 mx-auto text-red-400" />
                  <span>Failed to load video player. <a href={videoLink} target="_blank" rel="noreferrer" className="underline text-indigo-400">Direct Link</a></span>
                </div>
              ) : (
                <video
                  controls
                  preload="metadata"
                  onError={() => setVideoError(true)}
                  className="w-full max-h-[320px] object-contain bg-black rounded-2xl"
                >
                  <source src={videoLink} />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal for Photo Zoom */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-12 right-0 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-lg transition-all"
              title="Close Preview"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxUrl}
              alt="Enlarged Evidence Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-secondary/40 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
