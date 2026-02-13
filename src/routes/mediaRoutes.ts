import { Router } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { authenticate } from "../middleware/authMiddleware";
import { uploadMedia } from "../controllers/mediaController";

const router = Router();

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Generate a unique filename using UUID and original extension
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Configure upload limits and file filter
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// Define the upload route
// Expects a form-data field named 'image'
router.post(
  "/upload",
  authenticate,
  upload.single("image"),
  (req, res, next) => {
    // Check for multer errors
    // Since we are using upload.single as middleware, errors might propagate
    // or be handled here if we wrap it. Standard express error handler will catch
    // multer errors if they bubble up.
    next();
  },
  uploadMedia,
);

export default router;
