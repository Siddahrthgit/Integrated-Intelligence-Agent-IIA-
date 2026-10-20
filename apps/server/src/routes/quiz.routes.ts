import { Router } from "express";
import { listQuizzes, getQuizById, submitQuiz, generateQuiz } from "../controllers/quiz.controller";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware";
import { requirePaidAccess } from "../middleware/paid-access.middleware";

const router = Router();

router.get("/", optionalAuth, listQuizzes);
router.post("/generate", requireAuth, requirePaidAccess, generateQuiz);
router.get("/:id", optionalAuth, getQuizById);
router.post("/:id/submit", requireAuth, requirePaidAccess, submitQuiz);

export default router;
