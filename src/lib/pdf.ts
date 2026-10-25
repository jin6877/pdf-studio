import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument, degrees } from "pdf-lib";
import JSZip from "jszip";
import type { PageItem, SourceDoc } from "../types";

// --- pdf.js worker wiring (the classic Vite gotcha: must point workerSrc at a
// bundled URL, otherwise thumbnails silently never render) ---
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export class PasswordProtectedError extends Error {
  constructor() {
    super("PASSWORD_PROTECTED");
    this.name = "PasswordProtectedError";
  }
}

export class CorruptPdfError extends Error {
  constructor() {
    super("CORRUPT_PDF");
    this.name = "CorruptPdfError";
  }
}

const SOURCE_COLORS = [
  "#f24b38", // brand coral
  "#2563eb", // blue
  "#0d9488", // teal
  "#9333ea", // violet
  "#d97706", // amber
  "#db2777", // pink
  "#15803d", // green
  "#475569", // slate
];

let colorCursor = 0;
let idCursor = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(idCursor++).toString(36)}`;

function normalizeAngle(a: number): number {
  return ((Math.round(a / 90) * 90) % 360 + 360) % 360;
}

/**
 * Load a File into both a pdf.js proxy (rendering) and a pdf-lib doc (export).
 * The ArrayBuffer is sliced per-consumer because pdf.js may transfer/detach it.
 */
export async function loadSource(file: File): Promise<{ source: SourceDoc; pages: PageItem[] }> {
  const buf = await file.arrayBuffer();

  // 1) pdf.js first so we can surface a friendly password/corrupt message.
  let pdfjs: pdfjsLib.PDFDocumentProxy;
  try {
    const task = pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) });
    pdfjs = await task.promise;
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "PasswordException") throw new PasswordProtectedError();
    throw new CorruptPdfError();
  }

  // 2) pdf-lib for authoritative rotation + export copying.
  let pdflib: PDFDocument;
  try {
    pdflib = await PDFDocument.load(new Uint8Array(buf.slice(0)), {
      ignoreEncryption: false,
    });
  } catch {
    void pdfjs.loadingTask.destroy();
    throw new CorruptPdfError();
  }

  const source: SourceDoc = {
    id: uid("src"),
    name: file.name.replace(/\.pdf$/i, "") || "document",
    numPages: pdfjs.numPages,
    pdfjs,
    pdflib,
    color: SOURCE_COLORS[colorCursor++ % SOURCE_COLORS.length],
  };

  const libPages = pdflib.getPages();
  const pages: PageItem[] = [];
  for (let i = 0; i < pdfjs.numPages; i++) {
    const libPage = libPages[i];
    const base = normalizeAngle(libPage?.getRotation().angle ?? 0);
    const size = libPage?.getSize() ?? { width: 595, height: 842 };
    pages.push({
      id: uid("pg"),
      sourceId: source.id,
      srcIndex: i,
      baseRotation: base,
      rotation: base,
      width: size.width,
      height: size.height,
      thumb: null,
      selected: false,
    });
  }

  return { source, pages };
}

/** Render a single page thumbnail (at its natural /Rotate orientation) to a data URL. */
export async function renderThumb(
  source: SourceDoc,
  srcIndex: number,
  targetPx = 320,
): Promise<string> {
  const page = await source.pdfjs.getPage(srcIndex + 1);
  const base = page.getViewport({ scale: 1 });
  const longest = Math.max(base.width, base.height);
  const scale = Math.min(targetPx / longest, 2.5);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  const url = canvas.toDataURL("image/png");
  page.cleanup();
  return url;
}

/** rotate by a multiple of 90, accumulating onto the current absolute rotation. */
export function rotatePage(current: number, deltaDeg: number): number {
  return normalizeAngle(current + deltaDeg);
}

/** Build one merged PDF from the ordered page list, applying rotations. */
export async function buildPdf(pages: PageItem[], sources: Map<string, SourceDoc>): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error("no pages");
  const out = await PDFDocument.create();
  out.setProducer("PDF Studio");
  out.setCreator("PDF Studio (pdf-studio.vercel.app)");

  for (const p of pages) {
    const src = sources.get(p.sourceId);
    if (!src) continue;
    const [copied] = await out.copyPages(src.pdflib, [p.srcIndex]);
    copied.setRotation(degrees(normalizeAngle(p.rotation)));
    out.addPage(copied);
  }
  return out.save();
}

/** Build a ZIP where every page becomes its own single-page PDF. */
export async function buildSplitZip(
  pages: PageItem[],
  sources: Map<string, SourceDoc>,
  baseName: string,
): Promise<Blob> {
  const zip = new JSZip();
  const pad = String(pages.length).length;
  let n = 0;
  for (const p of pages) {
    n++;
    const src = sources.get(p.sourceId);
    if (!src) continue;
    const out = await PDFDocument.create();
    const [copied] = await out.copyPages(src.pdflib, [p.srcIndex]);
    copied.setRotation(degrees(normalizeAngle(p.rotation)));
    out.addPage(copied);
    const bytes = await out.save();
    zip.file(`${baseName}_p${String(n).padStart(pad, "0")}.pdf`, bytes);
  }
  return zip.generateAsync({ type: "blob" });
}

/** Trigger a browser download for bytes/blob (never automatic — called on click). */
export function downloadBlob(data: Uint8Array | Blob, filename: string) {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data.slice().buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
