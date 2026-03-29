"use client";

import { useCallback, useState } from "react";

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export default function DropZone({ onFile, disabled = false }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validateAndEmit(file: File) {
    setError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("PDF 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("File must be smaller than 50 MB.");
      return;
    }
    onFile(file);
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }, [disabled]);

  const onDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) validateAndEmit(file);
    },
    [disabled]  // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndEmit(file);
      // Reset input so same file can be re-selected.
      e.target.value = "";
    },
    []  // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="space-y-2">
      <label
        htmlFor="contract-file-input"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors",
          dragging
            ? "border-zinc-600 bg-zinc-100"
            : "border-zinc-300 bg-white hover:border-zinc-400",
          disabled ? "cursor-not-allowed opacity-50" : "",
        ].join(" ")}
      >
        <svg
          className="mb-3 h-10 w-10 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-sm font-medium text-zinc-700">
          Drag &amp; drop your contract here, or{" "}
          <span className="text-zinc-900 underline underline-offset-2">browse</span>
        </p>
        <p className="mt-1 text-xs text-zinc-400">PDF — max 50 MB</p>
        <input
          id="contract-file-input"
          type="file"
          accept=".pdf"
          className="sr-only"
          disabled={disabled}
          onChange={onInputChange}
        />
      </label>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
