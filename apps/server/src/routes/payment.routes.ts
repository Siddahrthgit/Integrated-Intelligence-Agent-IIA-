import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getPaymentStatus, initiateKhaltiPayment, khaltiPaymentCallback } from "../controllers/payment.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
const paymentLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false });

router.get("/status", requireAuth, getPaymentStatus);
router.post("/khalti/initiate", requireAuth, paymentLimiter, initiateKhaltiPayment);
router.get("/khalti/callback", khaltiPaymentCallback);

export default router;
