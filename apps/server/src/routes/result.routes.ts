import { Router } from "express";
import { listAttempts, getAttemptById } from "../controllers/result.controller";

const router = Router();

router.get("/", listAttempts);
router.get("/:attemptId", getAttemptById);

export default router;
