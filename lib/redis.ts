import { Redis } from "@upstash/redis";

/**
 * Client Redis (Upstash) folosit ca sursă unică de adevăr pentru starea camerei
 * (ce film rulează, poziția curentă, dacă e pe play/pause).
 *
 * Necesită variabilele de mediu UPSTASH_REDIS_REST_URL și UPSTASH_REDIS_REST_TOKEN.
 */
export const redis = Redis.fromEnv();
