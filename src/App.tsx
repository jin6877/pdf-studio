import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PageItem, SourceDoc } from "./types";
import {
  CorruptPdfError,
  PasswordProtectedError,
  buildPdf,
  buildSplitZip,
  downloadBlob,
  loadSource,
  renderThumb,
  rotatePage,
} from "./lib/pdf";
import { PageCard } from "./components/PageCard";
import { Dropzone } from "./components/Dropzone";
import { ToastStack, type ToastKind, type ToastMsg } from "./components/Toast";
import {
  Download,
  Logo,
  Moon,
  Plus,
  RotateLeft,
  RotateRight,
  Scissors,
  Shield,
  Sun,
  Trash,
} from "./components/Icons";

interface SourceMeta {
  id: string;
  name: string;
  color: string;
  numPages: number;
}

const LARGE_FILE = 40 * 1024 * 1024;

export default function App() {
  const sourcesRef = useRef(new Map<string, SourceDoc>());
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [exportName, setExportName] = useState("pdf-studio-export");
  const nameTouched = useRef(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastId = useRef(0);

  const [dark, setDark] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const renderingRef = useRef(false);
  const failedRef = useRef(new Set<string>());

  // ---- theme ----
  useEffect(() => {
    const saved = localStorage.getItem("pdfstudio-theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(saved ? saved === "dark" : prefers);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
    localStorage.setItem("pdfstudio-theme", dark ? "dark" : "light");
  }, [dark]);

  // ---- toasts ----
  const toast = useCallback((text: string, kind: ToastKind = "info") => {
    const id = toastId.current++;
    setToasts((prev) => [...prev, { id, kind, text }]);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);

  // ---- progressive thumbnail rendering ----
  const pumpThumbs = useCallback(async () => {
    if (renderingRef.current) return;
    renderingRef.current = true;
    try {
      for (;;) {
        const pending = pagesRef.current.find((p) => p.thumb === null && !failedRef.current.has(p.id));
        if (!pending) break;
        const src = sourcesRef.current.get(pending.sourceId);
        if (!src) {
          failedRef.current.add(pending.id);
          continue;
        }
        try {
          const url = await renderThumb(src, pending.srcIndex);
          setPages((prev) => prev.map((p) => (p.id === pending.id ? { ...p, thumb: url } : p)));
        } catch {
          failedRef.current.add(pending.id);
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      renderingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (pages.some((p) => p.thumb === null && !failedRef.current.has(p.id))) void pumpThumbs();
  }, [pages, pumpThumbs]);

  // ---- file loading ----
  const addFiles = useCallback(
    async (files: File[]) => {
      setLoading(files.length > 1 ? `${files.length}개 파일을 여는 중…` : "파일을 여는 중…");
      let opened = 0;
      for (const file of files) {
        if (file.size > LARGE_FILE) {
          toast(`"${file.name}"은(는) 용량이 커서 렌더링에 시간이 걸릴 수 있어요`, "info");
        }
        try {
          const { source, pages: newPages } = await loadSource(file);
          sourcesRef.current.set(source.id, source);
          setSources((prev) => [
            ...prev,
            { id: source.id, name: source.name, color: source.color, numPages: source.numPages },
          ]);
          setPages((prev) => [...prev, ...newPages]);
          if (!nameTouched.current) {
            setExportName(source.name ? `${source.name}-편집본` : "pdf-studio-export");
          }
          opened++;
        } catch (e) {
          if (e instanceof PasswordProtectedError) {
            toast(`"${file.name}"은(는) 암호로 보호된 PDF라 열 수 없어요`, "error");
          } else if (e instanceof CorruptPdfError) {
            toast(`"${file.name}"을(를) 열지 못했어요 (손상되었거나 올바른 PDF가 아니에요)`, "error");
          } else {
            toast(`"${file.name}"을(를) 처리하는 중 문제가 생겼어요`, "error");
          }
        }
        await new Promise((r) => setTimeout(r, 0));
      }
      setLoading(null);
      if (opened > 0) toast(`${opened}개 파일을 불러왔어요`, "success");
    },
    [toast],
  );

  // ---- page ops ----
  const rotateOne = useCallback((id: string, delta: number) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, rotation: rotatePage(p.rotation, delta) } : p)));
  }, []);
  const deleteOne = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }, []);
  const toggleSelect = useCallback((id: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  }, []);
  const moveOne = useCallback((id: string, dir: -1 | 1) => {
    setPages((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    setPages((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const onDragStart = useCallback((i: number) => setDragIndex(i), []);
  const onDragEnter = useCallback(
    (i: number) => setDropIndex((prev) => (prev === i ? prev : i)),
    [],
  );
  const onDragEnd = useCallback(() => {
    setDragIndex((di) => {
      setDropIndex((dpi) => {
        if (di !== null && dpi !== null) reorder(di, dpi);
        return null;
      });
      return null;
    });
  }, [reorder]);

  const removeSource = useCallback((sourceId: string) => {
    setPages((prev) => prev.filter((p) => p.sourceId !== sourceId));
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
    const src = sourcesRef.current.get(sourceId);
    if (src) {
      try {
        void src.pdfjs.loadingTask.destroy();
      } catch {
        /* ignore */
      }
      sourcesRef.current.delete(sourceId);
    }
  }, []);

  // ---- bulk ops ----
  const selected = useMemo(() => pages.filter((p) => p.selected), [pages]);
  const selectedCount = selected.length;
  const allSelected = pages.length > 0 && selectedCount === pages.length;

  const rotateSelected = (delta: number) => {
    const ids = new Set(selected.map((p) => p.id));
    setPages((prev) => prev.map((p) => (ids.has(p.id) ? { ...p, rotation: rotatePage(p.rotation, delta) } : p)));
  };
  const rotateAll = (delta: number) => {
    setPages((prev) => prev.map((p) => ({ ...p, rotation: rotatePage(p.rotation, delta) })));
  };
  const deleteSelected = () => {
    const ids = new Set(selected.map((p) => p.id));
    setPages((prev) => prev.filter((p) => !ids.has(p.id)));
  };
  const toggleSelectAll = () => {
    const target = !allSelected;
    setPages((prev) => prev.map((p) => ({ ...p, selected: target })));
  };
  const clearAll = () => {
    for (const s of sourcesRef.current.values()) {
      try {
        void s.pdfjs.loadingTask.destroy();
      } catch {
        /* ignore */
      }
    }
    sourcesRef.current.clear();
    failedRef.current.clear();
    setPages([]);
    setSources([]);
    nameTouched.current = false;
    setExportName("pdf-studio-export");
  };

  // ---- exports (never automatic — only on button click) ----
  const safeName = (exportName.trim() || "pdf-studio-export").replace(/[\\/:*?"<>|]+/g, "_");

  const exportMerged = async () => {
    if (pages.length === 0) return;
    setBusy("PDF를 만드는 중…");
    try {
      const bytes = await buildPdf(pages, sourcesRef.current);
      downloadBlob(bytes, `${safeName}.pdf`);
      toast(`${pages.length}페이지 PDF를 저장했어요`, "success");
    } catch {
      toast("PDF를 만드는 중 오류가 발생했어요", "error");
    } finally {
      setBusy(null);
    }
  };

  const exportSelected = async () => {
    if (selectedCount === 0) return;
    setBusy("선택 페이지를 추출하는 중…");
    try {
      const bytes = await buildPdf(selected, sourcesRef.current);
      downloadBlob(bytes, `${safeName}-추출-${selectedCount}p.pdf`);
      toast(`${selectedCount}페이지를 추출했어요`, "success");
    } catch {
      toast("추출 중 오류가 발생했어요", "error");
    } finally {
      setBusy(null);
    }
  };

  const exportSplitZip = async () => {
    if (pages.length === 0) return;
    setBusy("페이지별로 분리하는 중…");
    try {
      const blob = await buildSplitZip(pages, sourcesRef.current, safeName);
      downloadBlob(blob, `${safeName}-분리.zip`);
      toast(`${pages.length}개 파일로 분리해 ZIP으로 저장했어요`, "success");
    } catch {
      toast("분리 중 오류가 발생했어요", "error");
    } finally {
      setBusy(null);
    }
  };

  const hasPages = pages.length > 0;
  const renderedCount = pages.filter((p) => p.thumb !== null).length;
  const multiSource = sources.length > 1;
  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo className="h-9 w-9 shrink-0" />
            <div className="leading-tight">
              <h1 className="text-lg font-extrabold tracking-tight">
                PDF <span className="text-brand-500">Studio</span>
              </h1>
              <p className="hidden text-[11px] font-medium text-slate-400 sm:block dark:text-slate-500">
                합치고 · 자르고 · 돌리고 — 브라우저에서 바로
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 md:inline-flex dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Shield className="h-3.5 w-3.5" />
              서버 전송 없음
            </span>
            <button
              type="button"
              aria-label="테마 전환"
              onClick={() => setDark((d) => !d)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-32 pt-6 sm:px-6">
        {!hasPages ? (
          <section className="animate-fade-up">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                PDF를 브라우저에서 <span className="text-brand-500">바로</span> 편집하세요
              </h2>
              <p className="mt-3 text-base text-slate-500 dark:text-slate-400">
                합치기 · 분할 · 순서 변경 · 페이지 회전 · 삭제까지. 업로드 없이 내 컴퓨터 안에서 처리돼요.
              </p>
            </div>
            <div className="mx-auto mt-8 max-w-3xl">
              <Dropzone onFiles={addFiles} variant="hero" />
            </div>
            <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-3">
              {[
                { t: "합치기 & 분할", d: "여러 PDF를 하나로, 또는 페이지별로 쪼개기" },
                { t: "회전 & 순서변경", d: "90° 단위 회전과 드래그 재정렬" },
                { t: "100% 로컬 처리", d: "파일이 서버로 올라가지 않아요" },
              ].map((f) => (
                <div
                  key={f.t}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <p className="text-sm font-bold">{f.t}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{f.d}</p>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="animate-fade-up">
            {/* source legend */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {sources.map((s) => (
                <span
                  key={s.id}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-2.5 pr-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="max-w-[160px] truncate">{s.name}</span>
                  <span className="text-slate-400">· {s.numPages}p</span>
                  <button
                    type="button"
                    aria-label={`${s.name} 제거`}
                    onClick={() => removeSource(s.id)}
                    className="ml-0.5 rounded-full p-0.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-slate-600 dark:text-slate-400">
                <Plus className="h-4 w-4" />
                PDF 추가
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {/* toolbar */}
            <div className="sticky top-[61px] z-20 mb-5 rounded-2xl border border-slate-200 bg-white/90 p-2.5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-800/90">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {allSelected ? "선택 해제" : "전체 선택"}
                </button>

                <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => (selectedCount ? rotateSelected(-90) : rotateAll(-90))}
                    className="flex items-center gap-1 rounded-l-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <RotateLeft className="h-4 w-4" /> 좌
                  </button>
                  <span className="px-0.5 text-[10px] font-bold text-slate-400">
                    {selectedCount ? "선택" : "전체"}
                  </span>
                  <button
                    type="button"
                    onClick={() => (selectedCount ? rotateSelected(90) : rotateAll(90))}
                    className="flex items-center gap-1 rounded-r-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    우 <RotateRight className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={deleteSelected}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
                >
                  <Trash className="h-4 w-4" /> 선택 삭제
                </button>

                <button
                  type="button"
                  disabled={selectedCount === 0 || !!busy}
                  onClick={exportSelected}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Scissors className="h-4 w-4" /> 선택 추출
                </button>

                <div className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-400">
                  <span>
                    {pages.length}p {selectedCount > 0 && <span className="text-brand-500">· {selectedCount} 선택</span>}
                  </span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="rounded-lg px-2 py-1.5 font-semibold text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700"
                  >
                    초기화
                  </button>
                </div>
              </div>

              {renderedCount < pages.length && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-300"
                      style={{ width: `${(renderedCount / Math.max(pages.length, 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">
                    썸네일 {renderedCount}/{pages.length}
                  </span>
                </div>
              )}
            </div>

            {/* page grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {pages.map((p, i) => {
                const meta = sourceMap.get(p.sourceId);
                return (
                  <PageCard
                    key={p.id}
                    page={p}
                    index={i}
                    total={pages.length}
                    sourceName={meta?.name ?? ""}
                    sourceColor={meta?.color ?? "#64748b"}
                    multiSource={multiSource}
                    dragging={dragIndex === i}
                    dropTarget={dropIndex === i && dragIndex !== null && dragIndex !== i}
                    onToggleSelect={toggleSelect}
                    onRotate={rotateOne}
                    onDelete={deleteOne}
                    onMove={moveOne}
                    onDragStart={onDragStart}
                    onDragEnter={onDragEnter}
                    onDragEnd={onDragEnd}
                  />
                );
              })}
            </div>

            <p className="mt-4 text-center text-xs text-slate-400">
              페이지를 드래그해 순서를 바꾸거나, 카드의 ↑ ↓ 버튼으로 이동하세요
            </p>
          </div>
        )}
      </main>

      {/* sticky export bar */}
      {hasPages && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <span className="hidden shrink-0 font-semibold text-slate-500 sm:inline dark:text-slate-400">파일명</span>
              <input
                value={exportName}
                onChange={(e) => {
                  nameTouched.current = true;
                  setExportName(e.target.value);
                }}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800"
                placeholder="파일명"
              />
              <span className="shrink-0 text-sm text-slate-400">.pdf</span>
            </label>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={exportSplitZip}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Scissors className="h-4 w-4" />
                <span className="hidden sm:inline">페이지별 분리</span>
                <span className="sm:hidden">분리</span>
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={exportMerged}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/30 transition-all hover:shadow-brand-500/50 hover:brightness-105 active:scale-95 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {busy ? busy : "PDF 내보내기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* full-screen loading overlay while opening files */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-2xl dark:bg-slate-800">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-500 border-t-transparent" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{loading}</p>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
