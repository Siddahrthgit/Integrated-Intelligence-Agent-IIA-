import { Router } from "express";
import { listAttempts, getAttemptById } from "../controllers/result.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Results contain private scores and must never be exposed to anonymous visitors.
router.get("/", requireAuth, listAttempts);
router.get("/:attemptId", requireAuth, getAttemptById);

export default router;
