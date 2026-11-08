import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { addReport, getReports, deleteReport, fetchUserReports } from '../lib/storage';
import { UserReport } from '../types';
import {
  ShieldCheck,
  ImageIcon,
  Video,
  Send,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  MessageSquare,
  Trash2,
  Calendar,
  FileText,
} from 'lucide-react';
import { uploadFile } from '../lib/upload';

interface ReportPageProps {
  onOpenAuth: () => void;
}

export const ReportPage: React.FC<ReportPageProps> = ({ onOpenAuth }) => {
  const { currentUser, userProfile } = useAuth();

  // Form states
  const [subject, setSubject] = useState('Evidence / Incident Report');
  const [description, setDescription] = useState('Submitted via mobile gallery evidence upload.');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [myReports, setMyReports] = useState<UserReport[]>([]);
  const [reportToDelete, setReportToDelete] = useState<UserReport | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  React.useEffect(() => {
    if (currentUser) {
      fetchUserReports(currentUser.uid)
        .then((reps) => {
          setMyReports(reps);
        })
        .catch((e) => {
          console.warn('Error loading reports:', e);
          const reps = getReports();
          const userReps = reps.filter((r) => r.authorUid === currentUser.uid);
          setMyReports(userReps);
        });
    }
  }, [currentUser, success]);

  const handleConfirmDelete = async () => {
    if (!reportToDelete || !reportToDelete.id || !currentUser || deletingReportId) return;
    const targetId = reportToDelete.id;
    setDeletingReportId(targetId);
    setDeleteError(null);
    try {
      await deleteReport(targetId, {
        uid: currentUser.uid,
        name: userProfile?.name || currentUser.displayName || 'User',
        email: currentUser.email || '',
        role: userProfile?.role || 'USER',
      });
      setMyReports((prev) => prev.filter((r) => r.id !== targetId));
      setReportToDelete(null);
    } catch (err: any) {
      console.error('Delete report error:', err);
      setDeleteError(err?.message || 'Failed to delete your report. Please try again.');
    } finally {
      setDeletingReportId(null);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Photo size must be less than 15MB.');
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file (MP4, WEBM).');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('Video size must be less than 50MB.');
      return;
    }
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setError(null);
  };

  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const removeVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!currentUser) {
      onOpenAuth();
      return;
    }

    if (!photoFile && !videoFile) {
      setError('Please add at least a photo or video evidence before submitting.');
      return;
    }

    setSubmitting(true);
    setUploadProgress('Preparing upload...');

    try {
      const now = new Date().toISOString();
      let photoUrl = '';
      let videoUrl = '';

      if (photoFile) {
        setUploadProgress('Uploading photo...');
        photoUrl = await uploadFile(photoFile, `reports/${currentUser.uid}/${Date.now()}-photo.webp`);
      }

      if (videoFile) {
        setUploadProgress('Uploading video...');
        videoUrl = await uploadFile(videoFile, `reports/${currentUser.uid}/${Date.now()}-video.mp4`);
      }

      setUploadProgress('Saving report...');
      await addReport({
        authorUid: currentUser.uid,
        authorName: userProfile?.name || currentUser.displayName || 'User',
        authorEmail: currentUser.email || '',
        reportType: 'Media Evidence Report',
        subject: subject.trim() || 'Mobile Gallery Submission',
        description: description.trim() || 'Evidence uploaded via mobile gallery.',
        evidenceUrl: photoUrl,
        videoLink: videoUrl,
        status: 'Open',
        createdAt: now,
        updatedAt: now,
      });

      setSuccess(true);
      removePhoto();
      removeVideo();
      setUploadProgress(null);
    } catch (err: any) {
      console.error('Report submission error:', err);
      setError(err?.message || 'Failed to submit report. Please try again.');
      setUploadProgress(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-6 text-white">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-xl">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight">Sign In Required</h2>
        <p className="text-xs text-slate-300">
          Please sign in to submit evidence reports to our moderation team.
        </p>
        <button
          onClick={onOpenAuth}
          className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8 text-white">
      {/* Header */}
      <div className="text-center space-y-2">
        <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          Flick Staff Apply V2.1 — Incident & Evidence Portal
        </span>
        <h1 className="text-3xl font-black uppercase tracking-tight text-white">
          Submit Evidence Report
        </h1>
        <p className="text-xs text-slate-300">
          Upload photo or video evidence directly from your device gallery.
        </p>
      </div>

      {success && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-700/80 rounded-2xl text-emerald-200 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-bold">Report submitted successfully! Our moderation team will review your evidence.</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/80 border border-red-700/80 rounded-2xl text-red-200 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* SINGLE LARGE REPORT BOX */}
      <div className="bg-panel border border-secondary/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Optional hidden or minimal inputs for subject/description to ensure full report validity */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-white uppercase tracking-wider block">
                Subject / Title
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Incident subject"
                className="w-full bg-canvas border border-secondary/40 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-white uppercase tracking-wider block">
                Description / Details
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened..."
                rows={3}
                className="w-full bg-canvas border border-secondary/40 rounded-xl p-4 text-xs text-white outline-none focus:border-cyan-400 font-medium resize-none"
                required
              />
            </div>
          </div>

          {/* FIRST ROW: Add Photo & Add Video side by side with equal width */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="w-full py-4 px-4 bg-canvas hover:bg-slate-900 border border-secondary/40 hover:border-cyan-500/60 rounded-2xl flex flex-col items-center justify-center gap-2 text-xs font-black uppercase text-slate-200 hover:text-cyan-300 transition-all shadow-md group"
            >
              <ImageIcon className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>{photoFile ? 'Change Photo' : 'Add Photo'}</span>
            </button>

            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="w-full py-4 px-4 bg-canvas hover:bg-slate-900 border border-secondary/40 hover:border-indigo-500/60 rounded-2xl flex flex-col items-center justify-center gap-2 text-xs font-black uppercase text-slate-200 hover:text-indigo-300 transition-all shadow-md group"
            >
              <Video className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>{videoFile ? 'Change Video' : 'Add Video'}</span>
            </button>

            <input
              type="file"
              ref={photoInputRef}
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <input
              type="file"
              ref={videoInputRef}
              accept="video/*"
              onChange={handleVideoSelect}
              className="hidden"
            />
          </div>

          {/* PREVIEWS */}
          {(photoPreview || videoFile) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {photoPreview && (
                <div className="relative aspect-video rounded-2xl border border-cyan-500/40 overflow-hidden bg-slate-950 flex items-center justify-center group">
                  <img src={photoPreview} alt="Photo Preview" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full shadow hover:scale-110 transition-all"
                    title="Remove Photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/80 rounded text-[10px] font-bold text-cyan-300">
                    Photo Selected
                  </span>
                </div>
              )}

              {videoFile && (
                <div className="relative aspect-video rounded-2xl border border-indigo-500/40 overflow-hidden bg-slate-950 flex flex-col items-center justify-center p-4 text-center group">
                  <Video className="w-8 h-8 text-indigo-400 mb-2 animate-pulse" />
                  <span className="text-xs font-bold text-slate-200 truncate max-w-full">{videoFile.name}</span>
                  <span className="text-[10px] text-slate-400">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  <button
                    type="button"
                    onClick={removeVideo}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full shadow hover:scale-110 transition-all"
                    title="Remove Video"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/80 rounded text-[10px] font-bold text-indigo-300">
                    Video Selected
                  </span>
                </div>
              )}
            </div>
          )}

          {uploadProgress && (
            <div className="flex items-center justify-center gap-2 text-cyan-400 text-xs font-black uppercase tracking-wider py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{uploadProgress}</span>
            </div>
          )}

          {/* SECOND ROW: Submit button, centered below the two buttons */}
          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-64 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* USER SUBMITTED REPORTS SECTION */}
      {myReports.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-secondary/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Your Submitted Reports</span>
            </h3>
            <span className="px-2.5 py-0.5 bg-canvas border border-secondary/30 rounded-full text-[10px] font-black text-cyan-400">
              {myReports.length} {myReports.length === 1 ? 'Report' : 'Reports'}
            </span>
          </div>

          <div className="space-y-3">
            {myReports.map((r) => (
              <div
                key={r.id}
                className="bg-panel border border-secondary/30 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-cyan-500/30 transition-all shadow-md"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${
                        r.status === 'Resolved'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          : 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {r.status}
                    </span>
                    <h4 className="text-sm font-black text-white">{r.subject}</h4>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                    {r.evidenceUrl && (
                      <span className="flex items-center gap-1 text-cyan-400">
                        <ImageIcon className="w-3 h-3" /> Photo Attached
                      </span>
                    )}
                    {r.videoLink && (
                      <span className="flex items-center gap-1 text-indigo-400">
                        <Video className="w-3 h-3" /> Video Attached
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 italic line-clamp-2">"{r.description}"</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReportToDelete(r);
                    setDeleteError(null);
                  }}
                  className="px-3.5 py-2 bg-canvas hover:bg-red-950/60 border border-secondary/30 hover:border-red-500/40 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Report Delete Confirmation Modal */}
      {reportToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-panel border border-red-500/40 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-950/80 rounded-2xl border border-red-500/30">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Delete Report</h3>
                <span className="text-[10px] text-red-400/90 font-bold uppercase tracking-wider">Permanent Action</span>
              </div>
            </div>

            <div className="space-y-3 bg-canvas/60 p-4 rounded-2xl border border-secondary/20">
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                Are you sure you want to delete this report? This will permanently remove it from active review and delete any uploaded evidence media from Firebase Storage.
              </p>
              <div className="text-[11px] font-mono text-slate-400 border-t border-secondary/20 pt-2 space-y-1">
                <div>
                  <span className="text-slate-500 uppercase">Subject:</span>{' '}
                  <span className="text-white font-bold">{reportToDelete.subject}</span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase">Submitted:</span>{' '}
                  <span className="text-slate-300">{new Date(reportToDelete.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-950/90 border border-red-600 rounded-xl text-xs text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReportToDelete(null);
                  setDeleteError(null);
                }}
                disabled={deletingReportId !== null}
                className="flex-1 py-3 bg-canvas hover:bg-slate-800 border border-secondary/30 rounded-xl text-xs font-black uppercase text-slate-300 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingReportId !== null}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deletingReportId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
