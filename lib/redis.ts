import { Redis } from "@upstash/redis";

/**
 * Redis client (Upstash) used as the single source of truth for the room state
 * (which movie is playing, current position, whether it's playing/paused).
 *
 * Requires the UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.
 */
export const redis = Redis.fromEnv();
