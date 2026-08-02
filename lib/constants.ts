/** Numele canalului de prezență Pusher folosit pentru camera de vizionare. */
export const ROOM_CHANNEL = "presence-movie-room";

/** Evenimentul prin care serverul trimite starea curentă a playerului tuturor clienților. */
export const STATE_EVENT = "state-updated";

/** Interval (ms) la care un client redă poziția curentă către server pentru corectarea drift-ului. */
export const HEARTBEAT_INTERVAL_MS = 20_000;

/** Diferența maximă (secunde) tolerată înainte de a re-sincroniza forțat poziția video-ului. */
export const DRIFT_TOLERANCE_SECONDS = 1.2;
