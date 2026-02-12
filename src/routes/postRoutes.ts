import { Router } from "express";
import {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  getPostRevisions,
  restorePostRevision,
} from "../controllers/postController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.post("/", authenticate, createPost);
router.get("/", getAllPosts);
router.get("/:id", getPostById);
router.put("/:id", authenticate, updatePost);
router.delete("/:id", authenticate, deletePost);

// Revision routes
router.get("/:id/revisions", authenticate, getPostRevisions); // Authenticated? Maybe just public if posts are public? Let's keep auth for now as revisions might be internal.
router.post(
  "/:id/revisions/:revisionId/restore",
  authenticate,
  restorePostRevision,
);

export default router;
