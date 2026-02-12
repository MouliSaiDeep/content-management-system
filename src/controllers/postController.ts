import { Request, Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import prisma from "../lib/prisma";
import { z } from "zod";
import { publishingQueue } from "../lib/queue";

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

export const getAllPosts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    const posts = await prisma.post.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { id: true, username: true },
        },
      },
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

export const getPostById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
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

    if (post.authorId !== userId && req.user?.role !== "ADMIN") {
      // Assuming ADMIN role exists or will exist, keeping simple for now
      // For now, only author can update.
      if (post.authorId !== userId) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
    }

    // Create a revision before updating
    await prisma.postRevision.create({
      data: {
        postId: Number(id),
        titleSnapshot: post.title,
        contentSnapshot: post.content,
        revisionAuthorId: userId,
      },
    });

    const updatedPost = await prisma.post.update({
      where: { id: Number(id) },
      data: {
        title,
        content,
        status,
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

    res.status(204).send();
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

    // Check permissions
    if (post.authorId !== userId && req.user?.role !== "ADMIN") {
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

    // Create a new revision of the CURRENT state before restoring the old one
    await prisma.postRevision.create({
      data: {
        postId: Number(id),
        titleSnapshot: post.title,
        contentSnapshot: post.content,
        revisionAuthorId: userId,
      },
    });

    // Restore content
    const restoredPost = await prisma.post.update({
      where: { id: Number(id) },
      data: {
        title: revision.titleSnapshot,
        content: revision.contentSnapshot,
        status: "DRAFT", // Reset to draft on restore? Or keep current? Let's reset to DRAFT for safety.
      },
    });

    res.json(restoredPost);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
