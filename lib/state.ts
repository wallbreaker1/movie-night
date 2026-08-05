import { redis } from "./redis";
import { getMovies } from "./movies";

export interface RoomState {
  movieId: string | null;
  isPlaying: boolean;
  /** Position in seconds at the updatedAt timestamp. */
  position: number;
  /** Timestamp (ms) when this state was computed. */
  updatedAt: number;
  /** Display name of the last person who performed an action. */
  updatedBy: string;
}

const STATE_KEY = "movie-room:state:v1";

async function initialState(): Promise<RoomState> {
  const movies = await getMovies();
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
  const fresh = await initialState();
  await redis.set(STATE_KEY, fresh);
  return fresh;
}

export async function setRoomState(state: RoomState): Promise<void> {
  await redis.set(STATE_KEY, state);
}

/** Computes the estimated current position, accounting for elapsed time if playing. */
export function computeLivePosition(state: RoomState): number {
  if (!state.isPlaying) return state.position;
  const elapsed = (Date.now() - state.updatedAt) / 1000;
  return state.position + Math.max(elapsed, 0);
}
