import { redis } from "./redis";
import { getMovies } from "./movies";

export interface RoomState {
  movieId: string | null;
  isPlaying: boolean;
  /** Poziția în secunde la momentul updatedAt. */
  position: number;
  /** Timestamp (ms) la care a fost calculată această stare. */
  updatedAt: number;
  /** Numele afișat al ultimei persoane care a făcut o acțiune. */
  updatedBy: string;
}

const STATE_KEY = "movie-room:state:v1";

function initialState(): RoomState {
  const movies = getMovies();
  return {
    movieId: movies[0]?.id ?? null,
    isPlaying: false,
    position: 0,
    updatedAt: Date.now(),
    updatedBy: "system",
  };
}

export async function getRoomState(): Promise<RoomState> {
  const state = await redis.get<RoomState>(STATE_KEY);
  if (state) return state;
  const fresh = initialState();
  await redis.set(STATE_KEY, fresh);
  return fresh;
}

export async function setRoomState(state: RoomState): Promise<void> {
  await redis.set(STATE_KEY, state);
}

/** Calculează poziția curentă estimată, ținând cont de timpul scurs dacă e pe play. */
export function computeLivePosition(state: RoomState): number {
  if (!state.isPlaying) return state.position;
  const elapsed = (Date.now() - state.updatedAt) / 1000;
  return state.position + Math.max(elapsed, 0);
}
