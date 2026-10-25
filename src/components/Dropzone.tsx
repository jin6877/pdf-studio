import { useRef, useState } from "react";
import { Shield, Upload } from "./Icons";

interface Props {
  onFiles: (files: File[]) => void;
  variant?: "hero" | "inline";
}

export function Dropzone({ onFiles, variant = "hero" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function pick(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list).filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
    if (files.length) onFiles(files);
  }

  const inline = variant === "inline";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      className={[
        "group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed text-center transition-all duration-200",
        inline ? "px-6 py-7" : "px-6 py-16 sm:py-24",
        over
          ? "border-brand-500 bg-brand-50/70 dark:bg-brand-500/10"
          : "border-slate-300 bg-white/60 hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-brand-500/60 dark:hover:bg-slate-800/70",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        className={[
          "flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30 transition-transform group-hover:scale-105",
          inline ? "h-12 w-12" : "h-16 w-16",
        ].join(" ")}
      >
        <Upload className={inline ? "w-6 h-6" : "w-8 h-8"} />
      </div>

      <p className={["font-bold text-slate-900 dark:text-white", inline ? "mt-3 text-base" : "mt-5 text-xl sm:text-2xl"].join(" ")}>
        PDF를 여기에 끌어다 놓으세요
      </p>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
        또는 <span className="font-semibold text-brand-600 dark:text-brand-400">클릭해서 파일 선택</span> · 여러 개 한 번에 올려도 돼요
      </p>

      {!inline && (
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Shield className="w-4 h-4" />
          파일은 서버로 전송되지 않고 브라우저 안에서만 처리돼요
        </div>
      )}
    </div>
  );
}
