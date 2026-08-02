/** Name of the Pusher presence channel used for the viewing room. */
export const ROOM_CHANNEL = "presence-movie-room";

/** Event through which the server sends the current player state to all clients. */
export const STATE_EVENT = "state-updated";

/** Interval (ms) at which a client reports its current position to the server to correct drift. */
export const HEARTBEAT_INTERVAL_MS = 20_000;

/** Maximum difference (seconds) tolerated before force re-syncing the video position. */
export const DRIFT_TOLERANCE_SECONDS = 1.2;
