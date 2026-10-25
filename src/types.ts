import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PDFDocument } from "pdf-lib";

/** An uploaded source PDF kept in memory for rendering + export. */
export interface SourceDoc {
  id: string;
  name: string;
  numPages: number;
  /** pdf.js proxy used to render thumbnails. */
  pdfjs: PDFDocumentProxy;
  /** pdf-lib document used to copy pages on export. */
  pdflib: PDFDocument;
  /** short badge color for this source so merged pages stay distinguishable */
  color: string;
}

/** One page in the working editor timeline. */
export interface PageItem {
  /** stable unique id */
  id: string;
  /** source doc id */
  sourceId: string;
  /** 0-based page index inside the source */
  srcIndex: number;
  /** original /Rotate value of this page (degrees, 0/90/180/270) */
  baseRotation: number;
  /** absolute rotation to apply on export (includes baseRotation + user delta) */
  rotation: number;
  /** natural page size in points (before rotation) */
  width: number;
  height: number;
  /** rendered thumbnail data URL (null while pending) */
  thumb: string | null;
  /** selected for bulk actions */
  selected: boolean;
}
