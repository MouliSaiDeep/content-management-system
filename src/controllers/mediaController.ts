import { Request, Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import path from "path";

export const uploadMedia = (req: AuthRequest, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ message: "No file uploaded" });
    return;
  }

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

  res.status(201).json({
    message: "File uploaded successfully",
    url: fileUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
};
