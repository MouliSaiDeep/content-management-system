import request from "supertest";
import express from "express";
import { PrismaClient } from "@prisma/client";
import authRoutes from "../src/routes/authRoutes";
import postRoutes from "../src/routes/postRoutes";
import mediaRoutes from "../src/routes/mediaRoutes";
import path from "path";
import dotenv from "dotenv";
import prisma from "../src/lib/prisma";

dotenv.config();

console.log("DATABASE_URL:", process.env.DATABASE_URL);

const app = express();
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/media", mediaRoutes);

let authToken: string;
let userId: number;
let postId: number;

beforeAll(async () => {
  try {
    console.log("Connecting/Verifying database connection...");
    await prisma.$connect();
    console.log("Connected. Cleaning up database...");
    await prisma.postRevision.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
    console.log("Database cleaned.");
  } catch (error) {
    console.error("Error in beforeAll:", error);
    throw error;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("CMS Backend API Tests", () => {
  // Authentication Tests
  describe("Authentication", () => {
    it("should register a new user", async () => {
      const res = await request(app).post("/api/auth/register").send({
        username: "testauthor",
        email: "author@example.com",
        password: "password123",
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("token");
      authToken = res.body.token;
      userId = res.body.user.id;
    });

    it("should login an existing user", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "author@example.com",
        password: "password123",
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
    });
  });

  // Post Management Tests
  describe("Post Management", () => {
    it("should create a new post", async () => {
      const res = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Test Post",
          content: "This is a test post content.",
          status: "DRAFT",
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.slug).toContain("test-post");
      postId = res.body.id;
    });

    it("should get all posts", async () => {
      const res = await request(app)
        .get("/api/posts")
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("should get a specific post", async () => {
      const res = await request(app)
        .get(`/api/posts/${postId}`)
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Test Post");
    });

    it("should update a post and create a revision", async () => {
      const res = await request(app)
        .put(`/api/posts/${postId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Updated Post Title",
          content: "Updated content.",
        });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Updated Post Title");

      // Verify revision creation
      const revisionsRes = await request(app)
        .get(`/api/posts/${postId}/revisions`)
        .set("Authorization", `Bearer ${authToken}`);
      expect(revisionsRes.status).toBe(200);
      expect(revisionsRes.body.length).toBe(1);
      expect(revisionsRes.body[0].titleSnapshot).toBe("Test Post");
    });
  });

  // Status Transition Tests
  describe("Status Transitions", () => {
    it("should publish a post", async () => {
      const res = await request(app)
        .post(`/api/posts/${postId}/publish`)
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("PUBLISHED");
      expect(res.body.publishedAt).not.toBeNull();
    });

    it("should schedule a post", async () => {
      const futureDate = new Date(Date.now() + 10000).toISOString();
      const res = await request(app)
        .post(`/api/posts/${postId}/schedule`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ scheduledFor: futureDate });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("SCHEDULED");
      expect(res.body.scheduledFor).toBe(futureDate);
    });
  });

  // Search Tests
  describe("Search", () => {
    it("should search for posts", async () => {
      // First ensure we have a published post with specific content
      await request(app)
        .put(`/api/posts/${postId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Searchable Title",
          status: "PUBLISHED",
        });

      const res = await request(app).get(
        "/api/posts/published?search=Searchable",
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].title).toBe("Searchable Title");
    });
  });
});
