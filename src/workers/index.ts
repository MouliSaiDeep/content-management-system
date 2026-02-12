import { Worker } from "bullmq";
import prisma from "../lib/prisma";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
};

console.log("Starting worker...", connection);

const worker = new Worker(
  "publishing-queue",
  async (job) => {
    console.log(`Processing job ${job.id}:`, job.data);
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
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed!`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed with ${err.message}`);
});
