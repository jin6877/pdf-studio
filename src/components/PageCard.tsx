import { memo } from "react";
import type { PageItem } from "../types";
import { ArrowDown, ArrowUp, Check, Drag, RotateLeft, RotateRight, Trash } from "./Icons";

interface Props {
  page: PageItem;
  index: number;
  total: number;
  sourceName: string;
  sourceColor: string;
  multiSource: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onToggleSelect: (id: string) => void;
  onRotate: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number) => void;
  onDragEnd: () => void;
}

function PageCardInner({
  page,
  index,
  total,
  sourceName,
  sourceColor,
  multiSource,
  dragging,
  dropTarget,
  onToggleSelect,
  onRotate,
  onDelete,
  onMove,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: Props) {
  const delta = ((page.rotation - page.baseRotation) % 360 + 360) % 360;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragEnter={() => onDragEnter(index)}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onDrop={(e) => e.preventDefault()}
      className={[
        "group relative flex flex-col rounded-2xl border bg-white dark:bg-slate-800/70 transition-all duration-200",
        "shadow-sm hover:shadow-xl hover:-translate-y-0.5",
        page.selected
          ? "border-brand-500 ring-2 ring-brand-500/40"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
        dragging ? "opacity-40 scale-95" : "",
        dropTarget ? "ring-2 ring-brand-400 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900" : "",
      ].join(" ")}
    >
      {/* drag handle + index */}
      <div className="flex items-center justify-between px-2.5 pt-2.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          <Drag className="w-4 h-4 cursor-grab active:cursor-grabbing" />
          {index + 1}
        </span>
        <button
          type="button"
          aria-label={page.selected ? "선택 해제" : "선택"}
          onClick={() => onToggleSelect(page.id)}
          className={[
            "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
            page.selected
              ? "border-brand-500 bg-brand-500 text-white"
              : "border-slate-300 dark:border-slate-600 text-transparent hover:border-brand-400",
          ].join(" ")}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* thumbnail (square box, rotate via CSS; 90° increments always fit) */}
      <div className="mx-2.5 mt-2 mb-1 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900/60">
        {page.thumb ? (
          <img
            src={page.thumb}
            alt={`${index + 1} 페이지`}
            draggable={false}
            style={{ transform: `rotate(${delta}deg)` }}
            className="max-h-full max-w-full object-contain shadow-[0_1px_6px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-out"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-300 dark:text-slate-600">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="text-[10px] font-medium">렌더링…</span>
          </div>
        )}
      </div>

      {/* source badge */}
      {multiSource && (
        <div className="px-2.5">
          <span
            className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: sourceColor }}
            title={sourceName}
          >
            <span className="truncate">{sourceName}</span>
          </span>
        </div>
      )}

      {/* controls */}
      <div className="mt-auto flex items-center justify-between gap-1 px-2 py-2">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="왼쪽으로 회전"
            onClick={() => onRotate(page.id, -90)}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-brand-300"
          >
            <RotateLeft className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            aria-label="오른쪽으로 회전"
            onClick={() => onRotate(page.id, 90)}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-brand-300"
          >
            <RotateRight className="w-[18px] h-[18px]" />
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="앞으로 이동"
            disabled={index === 0}
            onClick={() => onMove(page.id, -1)}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            <ArrowUp className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            aria-label="뒤로 이동"
            disabled={index === total - 1}
            onClick={() => onMove(page.id, 1)}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            <ArrowDown className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            aria-label="페이지 삭제"
            onClick={() => onDelete(page.id)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
          >
            <Trash className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {delta !== 0 && (
        <span className="pointer-events-none absolute right-2 top-11 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-bold text-white">
          {delta}°
        </span>
      )}
    </div>
  );
}

export const PageCard = memo(PageCardInner);
