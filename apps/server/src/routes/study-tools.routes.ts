import { Router } from "express";
import rateLimit from "express-rate-limit";
import { analyzeStudyText } from "../controllers/study-tools.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePaidAccess } from "../middleware/paid-access.middleware";

const router = Router();
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Study analysis limit reached. Please wait before trying again." },
});

router.post("/analyze", requireAuth, requirePaidAccess, analyzeLimiter, analyzeStudyText);
export default router;
