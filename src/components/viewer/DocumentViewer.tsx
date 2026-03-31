"use client";

import { useState, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// PageCallback type defined inline to avoid subpath import issues.
type PageCallback = {
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
};
import type { ClauseResult } from "@/types";
import RiskOverlay from "@/components/risk/RiskOverlay";
import { LoadingSpinner } from "@/components/ui/primitives";

// Set up the PDF.js worker.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface DocumentViewerProps {
  /** URL or blob URL for the PDF file */
  fileUrl: string;
  clauseResults: ClauseResult[];
  onClauseClick?: (result: ClauseResult) => void;
  /** Ref map: clauseId → DOM element for scroll-to-clause */
  scrollTargetRef?: React.RefObject<Map<string, HTMLDivElement>>;
}

// Use a slightly narrower width so the viewer fits in its flex column
// without horizontal scroll on smaller desktop viewports.
const PAGE_WIDTH = 680;

export default function DocumentViewer({
  fileUrl,
  clauseResults,
  onClauseClick,
  scrollTargetRef,
}: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Map page number → rendered height
  const [pageHeights, setPageHeights] = useState<Record<number, number>>({});

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => setNumPages(n),
    []
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message);
  }, []);

  const onPageRenderSuccess = useCallback(
    (page: PageCallback, pageNumber: number) => {
      setPageHeights((prev) => ({ ...prev, [pageNumber]: page.height }));
    },
    []
  );

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-600">
        Failed to load document: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        {numPages &&
          Array.from({ length: numPages }, (_, i) => i + 1).map(
            (pageNumber) => {
              const pageHeight = pageHeights[pageNumber] ?? 0;

              return (
                <div
                  key={pageNumber}
                  className="relative mb-4 shadow-md"
                  style={{ width: PAGE_WIDTH }}
                  ref={(el) => {
                    if (el && scrollTargetRef?.current) {
                      // Store element by page number as a fallback target
                      scrollTargetRef.current.set(
                        `page-${pageNumber}`,
                        el as HTMLDivElement
                      );
                    }
                  }}
                >
                  <Page
                    pageNumber={pageNumber}
                    width={PAGE_WIDTH}
                    renderTextLayer
                    renderAnnotationLayer={false}
                    onRenderSuccess={(page: PageCallback) =>
                      onPageRenderSuccess(page, pageNumber)
                    }
                  />

                  {pageHeight > 0 && (
                    <RiskOverlay
                      clauseResults={clauseResults}
                      pageNumber={pageNumber}
                      pageWidth={PAGE_WIDTH}
                      pageHeight={pageHeight}
                      onClauseClick={onClauseClick}
                    />
                  )}
                </div>
              );
            }
          )}
      </Document>
    </div>
  );
}
