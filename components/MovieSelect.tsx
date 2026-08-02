"use client";

import type { Movie } from "@/lib/movies";

interface MovieSelectProps {
  movies: Movie[];
  currentId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export default function MovieSelect({ movies, currentId, onSelect, disabled }: MovieSelectProps) {
  if (movies.length <= 1) return null;

  return (
    <select
      value={currentId ?? ""}
      disabled={disabled}
      onChange={(e) => onSelect(e.target.value)}
      className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none transition hover:bg-white/10 focus:border-red-500 disabled:opacity-50"
    >
      {movies.map((movie) => (
        <option key={movie.id} value={movie.id} className="bg-neutral-900 text-white">
          {movie.title}
        </option>
      ))}
    </select>
  );
}
