import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { chatWithIIA } from "../controllers/chat.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePaidAccess } from "../middleware/paid-access.middleware";

const router = Router();
type UserRequest = import("express").Request & { user?: { id?: string } };

const userKey = (req: import("express").Request) => {
  const userId = (req as UserRequest).user?.id;
  return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip || "unknown")}`;
};

// Per-account limits keep one user's AI usage bounded without making every
// person behind a shared mobile/carrier IP consume the same small allowance.
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: userKey,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "IIA chat request limit reached for this account. Please wait before trying again." },
});

// Retain an IP-level safety net for many-account abuse, with a higher threshold
// that is more practical for offices, schools, and carrier-grade NAT.
const chatIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "IIA chat traffic limit reached for this network. Please wait before trying again." },
});

const taskModeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  keyGenerator: userKey,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "IIA multi-step task limit reached for this account. Please wait before starting another task." },
});

const taskModeIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "IIA multi-step task traffic limit reached for this network. Please wait before retrying." },
});

const limitTaskMode = (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
  if (req.body?.taskMode !== true) return next();
  return taskModeIpLimiter(req, res, (error?: unknown) => {
    if (error) return next(error);
    return taskModeLimiter(req, res, next);
  });
};

router.post("/", requireAuth, requirePaidAccess, chatIpLimiter, chatLimiter, limitTaskMode, chatWithIIA);

export default router;
