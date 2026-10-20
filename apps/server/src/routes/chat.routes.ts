import { Router } from "express";
import rateLimit from "express-rate-limit";
import { chatWithIIA } from "../controllers/chat.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePaidAccess } from "../middleware/paid-access.middleware";

const router = Router();
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "IIA chat request limit reached. Please wait before trying again." },
});

const taskModeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "IIA multi-step task limit reached. Please wait before starting another task." },
});

const limitTaskMode = (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
  if (req.body?.taskMode === true) return taskModeLimiter(req, res, next);
  return next();
};

router.post("/", requireAuth, requirePaidAccess, chatLimiter, limitTaskMode, chatWithIIA);

export default router;
