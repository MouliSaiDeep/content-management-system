import { createClient } from "redis";

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`,
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

// Only connect if not in test environment or handle connection gracefully
if (process.env.NODE_ENV !== "test") {
  (async () => {
    if (!redisClient.isOpen) {
      try {
        await redisClient.connect();
      } catch (err) {
        console.error("Failed to connect to Redis:", err);
      }
    }
  })();
}

export const cacheService = {
  get: async (key: string): Promise<string | null> => {
    if (process.env.NODE_ENV === "test") return null;
    try {
      if (!redisClient.isOpen) return null;
      return await redisClient.get(key);
    } catch (error) {
      console.error("Redis Get Error:", error);
      return null;
    }
  },

  set: async (key: string, value: string, ttlSeconds = 3600): Promise<void> => {
    if (process.env.NODE_ENV === "test") return;
    try {
      if (!redisClient.isOpen) return;
      await redisClient.set(key, value, { EX: ttlSeconds });
    } catch (error) {
      console.error("Redis Set Error:", error);
    }
  },

  del: async (key: string): Promise<void> => {
    if (process.env.NODE_ENV === "test") return;
    try {
      if (!redisClient.isOpen) return;
      await redisClient.del(key);
    } catch (error) {
      console.error("Redis Del Error:", error);
    }
  },
};
