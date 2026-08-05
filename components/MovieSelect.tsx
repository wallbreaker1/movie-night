"use client";

import { useState } from "react";
import type { Movie } from "@/lib/movies";

interface MovieSelectProps {
  movies: Movie[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
  refreshing?: boolean;
}

export default function MovieSelect({
  movies,
  currentId,
  onSelect,
  onRefresh,
  onDelete,
  disabled,
  refreshing,
}: MovieSelectProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMovie = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

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
              <div key={movie.id} className="rounded-lg">
                <div
                  className={`flex items-center rounded-lg transition ${
                    active
                      ? "bg-red-500/15 text-red-200"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <button
                    type="button"
                    disabled={disabled || active}
                    onClick={() => onSelect(movie.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default"
                  >
                    <span className="w-6 shrink-0 text-center text-xs text-white/30">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {movie.title}
                    </span>
                    {active && (
                      <span className="shrink-0 text-[10px] font-medium uppercase">
                        Acum
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${movie.title}`}
                    title="Delete from R2"
                    onClick={() => {
                      setDeleteError(null);
                      setConfirmDeleteId(movie.id);
                    }}
                    disabled={Boolean(deletingId)}
                    className="mr-2 rounded-md px-2 py-1 text-sm text-white/35 transition hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>

                {confirmDeleteId === movie.id && (
                  <div className="mx-2 mb-2 flex items-center justify-between gap-3 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs">
                    <span className="text-white/80">Are you sure?</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deletingId === movie.id}
                        className="rounded px-2 py-1 text-white/60 hover:bg-white/10"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMovie(movie.id)}
                        disabled={deletingId === movie.id}
                        className="rounded bg-red-500 px-2 py-1 font-medium text-white hover:bg-red-400 disabled:opacity-50"
                      >
                        {deletingId === movie.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {deleteError && (
        <p className="border-t border-red-400/20 bg-red-500/10 px-4 py-2 text-xs text-red-200">
          {deleteError}
        </p>
      )}
    </section>
  );
}
