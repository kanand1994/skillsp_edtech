/**
 * Reusable drag-and-drop file uploader. Uses /api/uploads.
 * Props:
 *   - category: image | video | document | resume | thumbnail | avatar | project
 *   - accept: mime hint object for react-dropzone (e.g., {"image/*": []})
 *   - onUploaded: (uploadResult) => void where uploadResult = {id, url, size, content_type, original_filename}
 *   - currentUrl: optional preview URL (for displaying existing upload)
 *   - hint: small helper text
 *   - testId
 */
import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Loader2, FileText, X, CheckCircle2 } from "lucide-react";
import { api, API } from "@/lib/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

export const fileUrl = (id) => (id ? `${API}/uploads/${id}` : "");

export default function FileUpload({
  category = "other",
  accept,
  onUploaded,
  currentUrl,
  hint,
  testId = "file-upload",
  maxMB = 25,
  multiple = false,
  small = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(currentUrl || "");

  const handleFiles = useCallback(async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        if (f.size > maxMB * 1024 * 1024) {
          toast.error(`${f.name} exceeds ${maxMB}MB`);
          continue;
        }
        const fd = new FormData();
        fd.append("file", f);
        const { data } = await api.post(`/uploads?category=${category}`, fd, {
          onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / (e.total || 1))),
        });
        const fullUrl = `${API}/uploads/${data.id}`;
        setPreview(fullUrl);
        onUploaded?.({ ...data, full_url: fullUrl });
      }
      toast.success("Upload complete");
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [category, maxMB, onUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFiles,
    accept,
    multiple,
    disabled: uploading,
  });

  if (small) {
    return (
      <button
        {...getRootProps()}
        data-testid={testId}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors border ${
          uploading ? "border-indigo-500/40 bg-indigo-500/10" : isDragActive ? "border-indigo-500 bg-indigo-500/10" : "border-white/10 bg-zinc-900 hover:border-white/20"
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3 w-3" />}
        {uploading ? `${progress}%` : "Upload"}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        data-testid={testId}
        className={`relative cursor-pointer border-2 border-dashed rounded-lg p-6 transition-colors ${
          isDragActive ? "border-indigo-500 bg-indigo-500/5" : "border-white/10 bg-zinc-950 hover:border-white/20"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        {preview && !uploading && (
          <div className="absolute top-2 right-2 z-10">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPreview(""); onUploaded?.(null); }}
              className="p-1 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400"
              data-testid={`${testId}-clear`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {preview && (preview.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i) || category === "image" || category === "thumbnail" || category === "avatar" || category === "project") ? (
          <img src={preview} alt="" className="w-full max-h-48 object-cover rounded-md mb-3" />
        ) : preview ? (
          <div className="flex items-center gap-2 text-sm text-zinc-300 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="truncate">File uploaded</span>
          </div>
        ) : null}
        <div className="text-center">
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 mx-auto text-indigo-400 animate-spin mb-2" />
              <div className="text-sm text-zinc-300">Uploading… {progress}%</div>
              <div className="mt-2 h-1 bg-zinc-800 rounded">
                <div className="h-full bg-indigo-500 rounded transition-all" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : (
            <>
              <UploadCloud className="h-6 w-6 mx-auto text-zinc-500 mb-2" />
              <div className="text-sm text-zinc-300">
                {isDragActive ? "Drop it!" : "Drag and drop, or click to select"}
              </div>
              {hint && <div className="text-xs text-zinc-500 mt-1">{hint}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
