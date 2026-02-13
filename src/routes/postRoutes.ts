import { Router } from "express";
import {
  createPost,
  getMyPosts,
  getPublishedPosts,
  getPostById,
  getPublishedPostById,
  updatePost,
  deletePost,
  getPostRevisions,
  restorePostRevision,
  publishPost,
  schedulePost,
} from "../controllers/postController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

// Public routes
router.get("/published", getPublishedPosts);
router.get("/published/:id", getPublishedPostById);

// Author routes
router.post("/", authenticate, createPost);
router.get("/", authenticate, getMyPosts);
router.get("/:id", authenticate, getPostById);
router.put("/:id", authenticate, updatePost);
router.delete("/:id", authenticate, deletePost);

router.post("/:id/publish", authenticate, publishPost);
router.post("/:id/schedule", authenticate, schedulePost);

// Revision routes
router.get("/:id/revisions", authenticate, getPostRevisions); // Authenticated? Maybe just public if posts are public? Let's keep auth for now as revisions might be internal.
router.post(
  "/:id/revisions/:revisionId/restore",
  authenticate,
  restorePostRevision,
);

export default router;
