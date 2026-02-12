import express from "express";
import dotenv from "dotenv";

dotenv.config();

import authRoutes from "./routes/authRoutes";
import postRoutes from "./routes/postRoutes";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);

app.get("/", (req, res) => {
  res.send("CMS Backend is running!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
