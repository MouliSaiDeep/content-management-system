import { Worker } from "bullmq";
import prisma from "../lib/prisma";
import { publishingQueue } from "../lib/queue";
import dotenv from "dotenv";

dotenv.config();

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
};

console.log("Starting worker...", connection);

const worker = new Worker(
  "publishing-queue",
  async (job) => {
    console.log(`Processing job ${job.name} (${job.id}):`, job.data);

    if (job.name === "check-scheduled") {
      try {
        const now = new Date();
        const posts = await prisma.post.findMany({
          where: {
            status: "SCHEDULED",
            scheduledFor: { lte: now },
          },
        });

        console.log(`Found ${posts.length} scheduled posts to publish.`);

        for (const post of posts) {
          await publishingQueue.add("publish-post", { postId: post.id });
        }
      } catch (error) {
        console.error("Error checking scheduled posts:", error);
        throw error;
      }
      return;
    }

    if (job.name === "publish-post") {
      const { postId } = job.data;

      try {
        const post = await prisma.post.findUnique({ where: { id: postId } });

        if (!post) {
          console.error(`Post ${postId} not found`);
          return;
        }

        if (post.status === "PUBLISHED") {
          console.log(`Post ${postId} is already published`);
          return;
        }

        await prisma.post.update({
          where: { id: postId },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
        });

        console.log(`Post ${postId} published successfully`);
      } catch (error) {
        console.error(`Error publishing post ${postId}:`, error);
        throw error;
      }
    }
  },
  { connection },
);

// Setup the scheduled check
const setupScheduler = async () => {
  await publishingQueue.add(
    "check-scheduled",
    {},
    {
      repeat: { every: 60000 },
      jobId: "check-scheduled-cron",
    },
  );
  console.log("Scheduler setup complete.");
};

setupScheduler().catch((err) =>
  console.error("Failed to setup scheduler:", err),
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed!`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed with ${err.message}`);
});
