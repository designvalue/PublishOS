"use client";

import { useUI } from "@/stores/ui-store";
import { Upload } from "@/lib/icons";

export default function DropZone({ canCreate = true }: { canCreate?: boolean }) {
  const { openUpload } = useUI();

  if (!canCreate) {
    return (
      <div className="drop">
        <div className="drop-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="drop-title">You have read-only access</div>
        <div className="drop-sub">
          As a Viewer you can open and download any folder that&apos;s been shared with you. Ask a Super Admin or Admin to grant
          you Editor access if you need to create or upload content.
        </div>
      </div>
    );
  }

  return (
    <div className="drop">
      <div className="drop-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="drop-title">
        Drop a file, folder, or zip <span className="it">to begin</span>
      </div>
      <div className="drop-sub">
        I&apos;ll ask where it should live — a new folder or an existing one. Publish any file with its own URL once it&apos;s in.
      </div>
      <div className="drop-actions">
        <button className="btn btn-primary" onClick={() => openUpload()}>
          {Upload}
          Browse from computer
        </button>
      </div>
    </div>
  );
}
