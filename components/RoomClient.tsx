"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Pusher from "pusher-js";
import type { Channel } from "pusher-js";
import VideoPlayer, { VideoPlayerHandle } from "./VideoPlayer";
import MovieSelect from "./MovieSelect";
import { UsersIcon, LogOutIcon, SyncIcon } from "./Icons";
import { ROOM_CHANNEL, STATE_EVENT, HEARTBEAT_INTERVAL_MS } from "@/lib/constants";
import type { Movie } from "@/lib/movies";
import type { RoomState } from "@/lib/state";

interface RoomClientProps {
  isHost: boolean;
  initialMovies: Movie[];
}

interface Viewer {
  id: string;
  name: string;
}

interface PresenceMember {
  id: string;
  info?: { name?: string };
}

function computeLivePosition(state: RoomState): number {
  if (!state.isPlaying) return state.position;
  const elapsed = (Date.now() - state.updatedAt) / 1000;
  return state.position + Math.max(elapsed, 0);
}

const MOVIE_REFRESH_INTERVAL_MS = 30_000;

export default function RoomClient({ isHost, initialMovies }: RoomClientProps) {
  const [state, setState] = useState<RoomState | null>(null);
  const [movies, setMovies] = useState(initialMovies);
  const [refreshingMovies, setRefreshingMovies] = useState(false);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [ready, setReady] = useState(false);

  const playerRef = useRef<VideoPlayerHandle>(null);
  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<Channel | null>(null);

  const currentMovie = movies.find((m) => m.id === state?.movieId) ?? movies[0] ?? null;

  const refreshMovies = useCallback(async (showProgress = true) => {
    if (showProgress) setRefreshingMovies(true);
    try {
      const response = await fetch("/api/movies/sync", { cache: "no-store" });
      if (!response.ok) throw new Error(`Movie sync failed (${response.status})`);
      const data: { movies: Movie[] } = await response.json();
      setMovies(data.movies);
    } catch (error) {
      console.error("Failed to refresh R2 playlist:", error);
    } finally {
      if (showProgress) setRefreshingMovies(false);
    }
  }, []);

  const sendAction = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      // Guests can't control playback; the server would reject this anyway,
      // but we skip the request client-side too.
      if (!isHost) return;
      const socketId = pusherRef.current?.connection.socket_id;
      try {
        await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, socketId, ...extra }),
        });
      } catch (err) {
        console.error("Failed to send action:", err);
      }
    },
    [isHost]
  );

  const applyState = useCallback((data: RoomState) => {
    setState(data);
    playerRef.current?.syncTo({
      position: computeLivePosition(data),
      isPlaying: data.isPlaying,
    });
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => refreshMovies(false), MOVIE_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshMovies]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/state")
      .then((r) => r.json())
      .then((data: RoomState) => {
        if (cancelled) return;
        setState(data);
        setReady(true);
      })
      .catch(() => setReady(true));

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) {
      console.error("NEXT_PUBLIC_PUSHER_KEY / NEXT_PUBLIC_PUSHER_CLUSTER are missing.");
      return () => {
        cancelled = true;
      };
    }

    const pusher = new Pusher(key, {
      cluster,
      authEndpoint: "/api/pusher/auth",
    });
    pusherRef.current = pusher;

    const channel = pusher.subscribe(ROOM_CHANNEL);
    channelRef.current = channel;

    channel.bind(
      "pusher:subscription_succeeded",
      (members: { each: (cb: (m: PresenceMember) => void) => void }) => {
        const list: Viewer[] = [];
        members.each((m) => list.push({ id: m.id, name: m.info?.name ?? "Viewer" }));
        setViewers(list);
      }
    );
    channel.bind("pusher:member_added", (member: PresenceMember) => {
      setViewers((prev) => [...prev, { id: member.id, name: member.info?.name ?? "Viewer" }]);
    });
    channel.bind("pusher:member_removed", (member: PresenceMember) => {
      setViewers((prev) => prev.filter((v) => v.id !== member.id));
    });
    channel.bind(STATE_EVENT, (data: RoomState) => {
      applyState(data);
    });

    return () => {
      cancelled = true;
      channel.unbind_all();
      pusher.unsubscribe(ROOM_CHANNEL);
      pusher.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once we have both the initial state and the mounted player, align the video position.
  useEffect(() => {
    if (state && ready) {
      playerRef.current?.syncTo({
        position: computeLivePosition(state),
        isPlaying: state.isPlaying,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, currentMovie?.id]);

  // Periodic heartbeat to correct drift during long sessions. Only the host
  // sends it, since only the host's session is the source of truth for
  // playback — guests never mutate state.
  useEffect(() => {
    if (!state?.isPlaying || !isHost) return;
    const interval = setInterval(() => {
      const t = playerRef.current?.getCurrentTime();
      if (typeof t === "number") sendAction("heartbeat", { position: t });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [state?.isPlaying, isHost, sendAction]);

  const handleManualResync = useCallback(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((data: RoomState) => applyState(data));
  }, [applyState]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 p-4 text-white sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold sm:text-xl">🎬 Movie Night</h1>
          <p className="text-xs text-white/50">
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                isHost ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/60"
              }`}
            >
              {isHost ? "Host" : "Guest"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/80">
            <UsersIcon className="h-4 w-4" />
            {viewers.length} online
          </div>
          <button
            onClick={handleManualResync}
            className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
            title="Sync me with others"
          >
            <SyncIcon className="h-4 w-4" />
            Sync
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
          >
            <LogOutIcon className="h-4 w-4" />
            Leave
          </button>
        </div>
      </header>

      {viewers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-xs text-white/50">
          {viewers.map((v) => (
            <span key={v.id} className="rounded-full bg-white/5 px-2 py-0.5">
              {v.name}
            </span>
          ))}
        </div>
      )}

      {!currentMovie ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-12 text-center text-white/60">
          <p className="text-base font-medium">No movie configured</p>
          <p className="max-w-md text-sm">
            Set the <code className="rounded bg-white/10 px-1">MOVIES_JSON</code> environment variable
            with the list of movies (id, title, public URL from Cloudflare R2).
          </p>
        </div>
      ) : (
        <>
          <VideoPlayer
            ref={playerRef}
            src={currentMovie.url}
            poster={currentMovie.poster}
            title={currentMovie.title}
            subtitleUrl={
              currentMovie.subtitleUrl ? `/api/subtitle?movieId=${currentMovie.id}` : undefined
            }
            canControl={isHost}
            onUserPlay={(position) => sendAction("play", { position })}
            onUserPause={(position) => sendAction("pause", { position })}
            onUserSeek={(position) => sendAction("seek", { position })}
          />

          {isHost && (
            <MovieSelect
              movies={movies}
              currentId={currentMovie.id}
              onSelect={(id) => sendAction("load", { movieId: id })}
              onRefresh={() => refreshMovies(true)}
              refreshing={refreshingMovies}
            />
          )}
        </>
      )}

      <p className="mt-auto pt-2 text-center text-[11px] text-white/30">
        {isHost
          ? "Space • K = play/pause · ← → = -10s/+10s · M = mute · F = fullscreen"
          : "Guest mode: you're watching in sync — only the host controls playback"}
      </p>
    </div>
  );
}
