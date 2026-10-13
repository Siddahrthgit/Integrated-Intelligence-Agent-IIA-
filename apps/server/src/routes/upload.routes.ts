import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { uploadDocument } from "../controllers/upload.controller";
import { requireAuth } from "../middleware/auth.middleware";

const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));
fs.mkdirSync(uploadsDir, { recursive: true });

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Upload request limit reached. Please wait before uploading again." },
});

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDir);
  },
  filename: (_req, file, callback) => {
    callback(null, `${randomUUID()}.pdf`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    // Some mobile browsers and file providers send an empty or generic MIME type.
    // The PDF signature is checked after saving, so permit those types only when
    // the filename has a .pdf extension; reject clearly non-PDF uploads here.
    const hasPdfExtension = file.originalname.toLowerCase().endsWith(".pdf");
    const allowedMime = !file.mimetype || file.mimetype === "application/pdf" || file.mimetype === "application/octet-stream";
    if (hasPdfExtension && allowedMime) {
      callback(null, true);
      return;
    }
    callback(new Error("Choose a PDF file with a .pdf extension."));
  },
});

const router = Router();
router.post("/", requireAuth, uploadLimiter, upload.single("file"), uploadDocument);

export default router;
