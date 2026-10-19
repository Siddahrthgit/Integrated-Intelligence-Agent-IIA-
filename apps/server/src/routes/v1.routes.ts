import { Router } from "express";
import rateLimit from "express-rate-limit";
import { chatWithIIA } from "../controllers/chat.controller";
import { listQuizzes } from "../controllers/quiz.controller";
import { requireIIAApiKey } from "../middleware/api-key.middleware";

const router = Router();
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.header("x-iia-api-key") || req.ip || "unknown",
  message: { error: { code: "rate_limit_exceeded", message: "IIA API rate limit reached. Retry after the rate limit window." } },
});

router.get("/docs", (_req, res) => res.json({
  name: "Integrated Intelligence Agent API",
  version: "1.0.0",
  authentication: { header: "X-IIA-API-Key", createKey: "POST /api/developer/keys" },
  endpoints: [
    { method: "GET", path: "/api/v1/health", authentication: "none", description: "API health check" },
    { method: "POST", path: "/api/v1/chat", authentication: "API key", body: { message: "string", taskMode: "boolean (optional)" }, description: "Ask IIA a question or request a multi-step answer" },
    { method: "GET", path: "/api/v1/quizzes", authentication: "API key", description: "List quizzes visible to the API key owner" },
  ],
  note: "AI answers require the server-side GEMINI_API_KEY. Never send that provider key to clients.",
}));
router.get("/health", (_req, res) => res.json({ ok: true, name: "Integrated Intelligence Agent API", version: "1.0.0" }));
router.use(apiLimiter);
router.use(requireIIAApiKey);
router.post("/chat", (req, res, next) => {
  if (typeof req.body?.message !== "string") return res.status(400).json({ error: { code: "invalid_request", message: "The message field must be a string." } });
  return next();
}, chatWithIIA);
router.get("/quizzes", listQuizzes);

export default router;
