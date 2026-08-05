"use client";

import type { Movie } from "@/lib/movies";

interface MovieSelectProps {
  movies: Movie[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  disabled?: boolean;
  refreshing?: boolean;
}

export default function MovieSelect({
  movies,
  currentId,
  onSelect,
  onRefresh,
  disabled,
  refreshing,
}: MovieSelectProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Playlist R2</h2>
          <p className="text-xs text-white/40">{movies.length} titluri disponibile</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 disabled:opacity-50"
        >
          {refreshing ? "Se actualizează…" : "Actualizează"}
        </button>
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto p-2">
        {movies.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-white/40">Niciun video găsit în R2.</p>
        ) : (
          movies.map((movie, index) => {
            const active = movie.id === currentId;
            return (
              <button
                type="button"
                key={movie.id}
                disabled={disabled || active}
                onClick={() => onSelect(movie.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  active
                    ? "bg-red-500/15 text-red-200"
                    : "text-white/70 hover:bg-white/5 hover:text-white disabled:cursor-default"
                }`}
              >
                <span className="w-6 shrink-0 text-center text-xs text-white/30">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{movie.title}</span>
                {active && <span className="shrink-0 text-[10px] font-medium uppercase">Acum</span>}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
