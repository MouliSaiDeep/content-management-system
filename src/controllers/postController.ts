import { Request, Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import prisma from "../lib/prisma";
import { z } from "zod";
import { publishingQueue } from "../lib/queue";
import { cacheService } from "../services/cacheService";

const createPostSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(10),
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]).optional(),
  scheduledFor: z.string().datetime().optional(),
});

const updatePostSchema = z.object({
  title: z.string().min(3).optional(),
  content: z.string().min(10).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]).optional(),
  scheduledFor: z.string().datetime().optional(),
});

export const createPost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { title, content, status, scheduledFor } = createPostSchema.parse(
      req.body,
    );
    const authorId = req.user?.userId;

    if (!authorId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Generate slug from title
    let slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    const existingSlug = await prisma.post.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const post = await prisma.post.create({
      data: {
        title,
        content,
        slug,
        status: status || "DRAFT",
        authorId,
        scheduledFor,
      },
    });

    if (status === "SCHEDULED" && scheduledFor) {
      const delay = new Date(scheduledFor).getTime() - Date.now();
      if (delay > 0) {
        await publishingQueue.add(
          "publish-post",
          { postId: post.id },
          { delay },
        );
      }
    }

    res.status(201).json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: error.errors });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyPosts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const where: any = { authorId: userId };

    const posts = await prisma.post.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.post.count({ where });

    res.json({
      data: posts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getPublishedPosts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = req.query.search as string | undefined;

    const where: any = { status: "PUBLISHED" };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    const cacheKey = `published_posts:${page}:${limit}`;
    if (!search && page === 1) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.json(JSON.parse(cached));
        return;
      }
    }

    const posts = await prisma.post.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { publishedAt: "desc" },
      include: {
        author: {
          select: { id: true, username: true },
        },
      },
    });

    const total = await prisma.post.count({ where });

    const result = {
      data: posts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    if (!search && page === 1) {
      await cacheService.set(cacheKey, JSON.stringify(result), 300);
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getPostById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const post = await prisma.post.findUnique({
      where: { id: Number(id) },
      include: {
        author: { select: { id: true, username: true } },
      },
    });

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (post.authorId !== userId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getPublishedPostById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const cacheKey = `post:${id}`;
    const cachedPost = await cacheService.get(cacheKey);

    if (cachedPost) {
      res.json(JSON.parse(cachedPost));
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: Number(id) },
      include: {
        author: { select: { id: true, username: true } },
      },
    });

    if (!post || post.status !== "PUBLISHED") {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    await cacheService.set(cacheKey, JSON.stringify(post), 3600);

    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updatePost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, content, status, scheduledFor } = updatePostSchema.parse(
      req.body,
    );
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const post = await prisma.post.findUnique({ where: { id: Number(id) } });

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (post.authorId !== userId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const updatedPost = await prisma.$transaction(async (prisma) => {
      await prisma.postRevision.create({
        data: {
          postId: Number(id),
          titleSnapshot: post.title,
          contentSnapshot: post.content,
          revisionAuthorId: userId,
        },
      });

      return prisma.post.update({
        where: { id: Number(id) },
        data: {
          title,
          content,
          status,
          scheduledFor,
        },
      });
    });

    if (status === "SCHEDULED" && scheduledFor) {
      const delay = new Date(scheduledFor).getTime() - Date.now();
      if (delay > 0) {
        await publishingQueue.add(
          "publish-post",
          { postId: post.id },
          { delay },
        );
      }
    }

    await cacheService.del(`post:${id}`);

    res.json(updatedPost);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ errors: error.errors });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deletePost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const post = await prisma.post.findUnique({ where: { id: Number(id) } });

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (post.authorId !== userId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    await prisma.post.delete({ where: { id: Number(id) } });

    await cacheService.del(`post:${id}`);

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const publishPost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const post = await prisma.post.findUnique({ where: { id: Number(id) } });

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (post.authorId !== userId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const updatedPost = await prisma.post.update({
      where: { id: Number(id) },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    await cacheService.del(`post:${id}`);

    res.json(updatedPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const schedulePost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { scheduledFor } = req.body;
    const userId = req.user?.userId;

    if (!scheduledFor) {
      res.status(400).json({ message: "scheduledFor is required" });
      return;
    }

    const post = await prisma.post.findUnique({ where: { id: Number(id) } });

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (post.authorId !== userId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const updatedPost = await prisma.post.update({
      where: { id: Number(id) },
      data: {
        status: "SCHEDULED",
        scheduledFor,
      },
    });

    const delay = new Date(scheduledFor).getTime() - Date.now();
    if (delay > 0) {
      await publishingQueue.add("publish-post", { postId: post.id }, { delay });
    }

    await cacheService.del(`post:${id}`);

    res.json(updatedPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getPostRevisions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const revisions = await prisma.postRevision.findMany({
      where: { postId: Number(id) },
      orderBy: { revisionTimestamp: "desc" },
      include: {
        revisionAuthor: { select: { id: true, username: true } },
      },
    });

    res.json(revisions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const restorePostRevision = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id, revisionId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const post = await prisma.post.findUnique({ where: { id: Number(id) } });
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (post.authorId !== userId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const revision = await prisma.postRevision.findUnique({
      where: { id: Number(revisionId) },
    });

    if (!revision || revision.postId !== Number(id)) {
      res.status(404).json({ message: "Revision not found for this post" });
      return;
    }

    // Save current state as revision
    await prisma.postRevision.create({
      data: {
        postId: Number(id),
        titleSnapshot: post.title,
        contentSnapshot: post.content,
        revisionAuthorId: userId,
      },
    });

    const restoredPost = await prisma.post.update({
      where: { id: Number(id) },
      data: {
        title: revision.titleSnapshot,
        content: revision.contentSnapshot,
        status: "DRAFT",
      },
    });

    res.json(restoredPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
