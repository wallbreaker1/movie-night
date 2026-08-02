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
  name: string;
  movies: Movie[];
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

export default function RoomClient({ name, movies }: RoomClientProps) {
  const [state, setState] = useState<RoomState | null>(null);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [ready, setReady] = useState(false);

  const playerRef = useRef<VideoPlayerHandle>(null);
  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<Channel | null>(null);

  const currentMovie = movies.find((m) => m.id === state?.movieId) ?? movies[0] ?? null;

  const sendAction = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const socketId = pusherRef.current?.connection.socket_id;
      try {
        await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, socketId, ...extra }),
        });
      } catch (err) {
        console.error("Nu am putut trimite acțiunea:", err);
      }
    },
    []
  );

  const applyState = useCallback((data: RoomState) => {
    setState(data);
    playerRef.current?.syncTo({
      position: computeLivePosition(data),
      isPlaying: data.isPlaying,
    });
  }, []);

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
      console.error("NEXT_PUBLIC_PUSHER_KEY / NEXT_PUBLIC_PUSHER_CLUSTER lipsesc.");
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
        members.each((m) => list.push({ id: m.id, name: m.info?.name ?? "Spectator" }));
        setViewers(list);
      }
    );
    channel.bind("pusher:member_added", (member: PresenceMember) => {
      setViewers((prev) => [...prev, { id: member.id, name: member.info?.name ?? "Spectator" }]);
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

  // Odată ce avem și starea inițială și player-ul montat, aliniem poziția video-ului.
  useEffect(() => {
    if (state && ready) {
      playerRef.current?.syncTo({
        position: computeLivePosition(state),
        isPlaying: state.isPlaying,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, currentMovie?.id]);

  // Heartbeat periodic pentru corectarea drift-ului la sesiuni lungi.
  useEffect(() => {
    if (!state?.isPlaying) return;
    const interval = setInterval(() => {
      const t = playerRef.current?.getCurrentTime();
      if (typeof t === "number") sendAction("heartbeat", { position: t });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [state?.isPlaying, sendAction]);

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
          <p className="text-xs text-white/50">Salut, {name}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/80">
            <UsersIcon className="h-4 w-4" />
            {viewers.length} conectați
          </div>
          <button
            onClick={handleManualResync}
            className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
            title="Sincronizează-mă cu ceilalți"
          >
            <SyncIcon className="h-4 w-4" />
            Sincronizează
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
          >
            <LogOutIcon className="h-4 w-4" />
            Ieși
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
          <p className="text-base font-medium">Niciun film configurat</p>
          <p className="max-w-md text-sm">
            Setează variabila de mediu <code className="rounded bg-white/10 px-1">MOVIES_JSON</code> cu
            lista de filme (id, titlu, URL public din Cloudflare R2).
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <MovieSelect
              movies={movies}
              currentId={currentMovie.id}
              onSelect={(id) => sendAction("load", { movieId: id })}
            />
            {state?.updatedBy && state.updatedBy !== "system" && (
              <span className="text-xs text-white/40">ultima acțiune: {state.updatedBy}</span>
            )}
          </div>

          <VideoPlayer
            ref={playerRef}
            src={currentMovie.url}
            poster={currentMovie.poster}
            title={currentMovie.title}
            subtitleUrl={currentMovie.subtitleUrl}
            onUserPlay={(position) => sendAction("play", { position })}
            onUserPause={(position) => sendAction("pause", { position })}
            onUserSeek={(position) => sendAction("seek", { position })}
          />
        </>
      )}

      <p className="mt-auto pt-2 text-center text-[11px] text-white/30">
        Spațiu • K = play/pause · ← → = -10s/+10s · M = mut · F = ecran complet
      </p>
    </div>
  );
}
