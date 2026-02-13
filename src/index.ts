import express from "express";
import dotenv from "dotenv";

dotenv.config();

import authRoutes from "./routes/authRoutes";
import postRoutes from "./routes/postRoutes";

import mediaRoutes from "./routes/mediaRoutes";
import path from "path";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/media", mediaRoutes);

app.get("/", (req, res) => {
  res.send("CMS Backend is running!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
