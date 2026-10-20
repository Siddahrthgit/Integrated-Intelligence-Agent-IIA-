import { Router } from "express";
import rateLimit from "express-rate-limit";
import { chatWithIIA } from "../controllers/chat.controller";
import { generateQuiz, listQuizzes } from "../controllers/quiz.controller";
import { requireIIAApiKey } from "../middleware/api-key.middleware";
import { requirePaidAccess } from "../middleware/paid-access.middleware";

const router = Router();
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "rate_limit_exceeded", message: "IIA API rate limit reached. Retry after the rate limit window." } },
});

router.get("/docs", (_req, res) => res.json({
  name: "Integrated Intelligence Agent API",
  version: "1.0.0",
  authentication: { header: "X-IIA-API-Key", createKey: "POST /api/developer/keys", rotateKey: "POST /api/developer/keys/:id/rotate", keyLifetimeHours: 4 },
  endpoints: [
    { method: "GET", path: "/api/v1/health", authentication: "none", description: "API health check" },
    { method: "POST", path: "/api/v1/chat", authentication: "API key", body: { message: "string", taskMode: "boolean (optional)" }, description: "Ask IIA a question or request a multi-step answer" },
    { method: "GET", path: "/api/v1/quizzes", authentication: "API key", description: "List quizzes visible to the API key owner" },
    { method: "POST", path: "/api/v1/quizzes/generate", authentication: "API key", body: { documentId: "string", questionCount: "integer from 3 to 20 (optional)" }, description: "Generate a quiz from a PDF already uploaded to the key owner account" },
  ],
  note: "AI answers require the server-side GEMINI_API_KEY. Never send that provider key to clients.",
}));
router.get("/health", (_req, res) => res.json({ ok: true, name: "Integrated Intelligence Agent API", version: "1.0.0" }));
router.use(apiLimiter);
router.use(requireIIAApiKey);
router.use(requirePaidAccess);
router.post("/chat", (req, res, next) => {
  if (typeof req.body?.message !== "string") return res.status(400).json({ error: { code: "invalid_request", message: "The message field must be a string." } });
  return next();
}, chatWithIIA);
router.post("/quizzes/generate", (req, res, next) => {
  if (typeof req.body?.documentId !== "string") return res.status(400).json({ error: { code: "invalid_request", message: "The documentId field must be a string." } });
  return next();
}, generateQuiz);
router.get("/quizzes", listQuizzes);

export default router;
