import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

import authRoutes from "./routes/auth.routes";
import quizRoutes from "./routes/quiz.routes";
import resultRoutes from "./routes/result.routes";
import uploadRoutes from "./routes/upload.routes";
import chatRoutes from "./routes/chat.routes";
import studyToolsRoutes from "./routes/study-tools.routes";
import developerRoutes from "./routes/developer.routes";
import v1Routes from "./routes/v1.routes";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET;
if (isProduction && (!jwtSecret || Buffer.byteLength(jwtSecret, "utf8") < 32 || jwtSecret.includes("replace_with"))) {
  throw new Error("Production startup blocked: set JWT_SECRET to a unique random value of at least 32 bytes.");
}
if (!isProduction && !jwtSecret) process.env.JWT_SECRET = "dev-only-insecure-secret";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));
fs.mkdirSync(uploadsDir, { recursive: true });

if (!isProduction && process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()) }));
}
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", authRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/study-tools", studyToolsRoutes);
app.use("/api/developer", developerRoutes);
app.use("/api/v1", v1Routes);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "Smart Quiz API is running" });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const error = err instanceof Error ? err : new Error("Unexpected server error");
  if (error.message === "Only PDF files are allowed" || error.name === "MulterError") {
    return res.status(400).json({ message: error.message });
  }
  console.error(error);
  return res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
