import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createDeveloperApiKey, listDeveloperApiKeys, revokeDeveloperApiKey } from "../controllers/api-keys.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
const keyCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "API key creation limit reached. Try again later." },
});

router.use(requireAuth);
router.get("/keys", listDeveloperApiKeys);
router.post("/keys", keyCreationLimiter, createDeveloperApiKey);
router.delete("/keys/:id", revokeDeveloperApiKey);

export default router;
