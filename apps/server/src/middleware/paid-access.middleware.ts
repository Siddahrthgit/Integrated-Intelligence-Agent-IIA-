import { NextFunction, Request, Response } from "express";
import { getActiveSubscription } from "../data/store";

export function requirePaidAccess(req: Request, res: Response, next: NextFunction) {
  // Roll out payment enforcement only after the merchant credentials and return URL
  // have been configured and the end-to-end payment flow has been tested.
  if (process.env.IIA_REQUIRE_PAID_ACCESS !== "true") return next();
  const userId = (req as Request & { user?: { id?: string } }).user?.id;
  if (!userId) return res.status(401).json({ message: "Sign in to use IIA." });
  const subscription = getActiveSubscription(userId);
  if (!subscription) {
    return res.status(402).json({
      message: "An active IIA Study Plus plan is required to use this feature.",
      code: "PAYMENT_REQUIRED",
      pricingUrl: "/pricing",
    });
  }
  return next();
}
