import { Queue } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
};

let publishingQueue: Queue;

// Mock queue for testing
if (process.env.NODE_ENV === "test") {
  // @ts-ignore
  publishingQueue = {
    add: async () => Promise.resolve(),
  } as any;
} else {
  publishingQueue = new Queue("publishing-queue", { connection });
}

export { publishingQueue };
