import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfPreviewProps {
  url: string;
  title?: string;
  /** Approx height per page; container scrolls if multiple pages */
  maxHeight?: number;
}

/**
 * Renders a PDF inline via pdf.js (canvas). Avoids browser/extension blocks
 * that prevent <iframe>/<object> PDF embeds from displaying.
 */
const PdfPreview = ({ url, title, maxHeight = 700 }: PdfPreviewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    setError(null);
    setLoading(true);

    (async () => {
      try {
        const pdf = await pdfjs.getDocument(url).promise;
        const containerWidth = container.clientWidth || 800;
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = containerWidth / base.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d")!;
          const ratio = window.devicePixelRatio || 1;
          canvas.width = viewport.width * ratio;
          canvas.height = viewport.height * ratio;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.style.display = "block";
          canvas.style.margin = i === 1 ? "0 auto" : "12px auto 0";
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          await page.render({ canvasContext: ctx, viewport } as any).promise;
          if (cancelled) return;
          container.appendChild(canvas);
        }
        setLoading(false);
      } catch (e: any) {
        console.error("PdfPreview failed", e);
        if (!cancelled) {
          setError(e?.message || "Failed to load PDF");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  return (
    <div
      className="rounded-lg border border-border bg-white overflow-auto"
      style={{ maxHeight }}
      aria-label={title}
    >
      {loading && (
        <div className="p-6 text-sm text-muted-foreground text-center">Loading document…</div>
      )}
      {error && (
        <div className="p-4 text-sm">
          Could not display the PDF inline.{" "}
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
            Open in a new tab
          </a>
          .
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
};

export default PdfPreview;
