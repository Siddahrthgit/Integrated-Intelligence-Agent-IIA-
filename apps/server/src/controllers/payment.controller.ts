import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import {
  attachPaymentPidx,
  createPaymentOrder,
  getPaymentOrderById,
  getPaymentOrderByPidx,
  getActiveSubscription,
  markPaymentOrderPaid,
  users,
} from "../data/store";

const plans = {
  "student-monthly": { name: "IIA Study Plus · 30 days", amountPaisa: 49_900 },
  "student-annual": { name: "IIA Study Plus · 365 days", amountPaisa: 499_900 },
} as const;
type PlanId = keyof typeof plans;

const baseUrl = () => (process.env.PUBLIC_APP_URL || "https://integratedia.duckdns.org").replace(/\/$/, "");
const khaltiBase = () => process.env.KHALTI_ENV === "production"
  ? "https://khalti.com/api/v2"
  : "https://dev.khalti.com/api/v2";

export function getPaymentStatus(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id?: string } }).user?.id;
  if (!userId) return res.status(401).json({ message: "Sign in to check your plan." });
  const subscription = getActiveSubscription(userId);
  return res.json({ subscription, paymentConfigured: Boolean(process.env.KHALTI_SECRET_KEY) });
}

export async function initiateKhaltiPayment(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id?: string } }).user?.id;
  if (!userId) return res.status(401).json({ message: "Sign in before purchasing access." });
  const planId = typeof req.body?.planId === "string" ? req.body.planId as PlanId : "";
  if (!(planId in plans)) return res.status(400).json({ message: "Choose a valid IIA access plan." });
  const secret = process.env.KHALTI_SECRET_KEY;
  if (!secret) return res.status(503).json({ message: "Online payments are not enabled yet. Please contact IIA on Instagram while payment setup is completed." });
  if (!process.env.PUBLIC_APP_URL) {
    return res.status(503).json({ message: "Payment return URL is not configured. Set PUBLIC_APP_URL on the server before accepting payments." });
  }
  const publicUrl = new URL(baseUrl());
  if (publicUrl.protocol !== "https:" && publicUrl.hostname !== "localhost") {
    return res.status(503).json({ message: "Payment checkout requires a secure HTTPS website URL." });
  }

  const user = users.find((item) => item.id === userId);
  if (!user) return res.status(401).json({ message: "Please sign in again." });
  const plan = plans[planId];
  const orderId = randomUUID();
  createPaymentOrder({ id: orderId, userId, planId, amountPaisa: plan.amountPaisa });

  try {
    const response = await fetch(`${khaltiBase()}/epayment/initiate/`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Key ${secret}` },
      body: JSON.stringify({
        return_url: `${baseUrl()}/api/payments/khalti/callback`,
        website_url: baseUrl(),
        amount: plan.amountPaisa,
        purchase_order_id: orderId,
        purchase_order_name: plan.name,
        customer_info: { name: user.name, email: user.email },
        product_details: [{
          identity: planId,
          name: plan.name,
          total_price: plan.amountPaisa,
          quantity: 1,
          unit_price: plan.amountPaisa,
        }],
        merchant_extra: "IIA",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({})) as { pidx?: string; payment_url?: string; detail?: string; message?: string };
    if (!response.ok || !payload.pidx || !payload.payment_url) {
      console.error("Khalti initiate failed", { status: response.status, detail: payload.detail || payload.message || "No provider detail" });
      return res.status(502).json({ message: "Khalti could not start checkout. No access has been activated; please retry." });
    }
    const paymentHost = new URL(payload.payment_url).hostname;
    if (!["khalti.com", "test-pay.khalti.com", "pay.khalti.com"].includes(paymentHost) && !paymentHost.endsWith(".khalti.com")) {
      console.error("Khalti returned an unexpected payment host", { paymentHost });
      return res.status(502).json({ message: "Payment provider returned an invalid checkout URL." });
    }
    attachPaymentPidx(orderId, payload.pidx);
    return res.json({ paymentUrl: payload.payment_url, orderId });
  } catch (error) {
    console.error("Khalti checkout network failure", error instanceof Error ? error.message : "Unknown error");
    return res.status(502).json({ message: "Could not reach Khalti. No access has been activated; please retry." });
  }
}

export async function khaltiPaymentCallback(req: Request, res: Response) {
  const pidx = typeof req.query.pidx === "string" ? req.query.pidx : "";
  const orderId = typeof req.query.purchase_order_id === "string" ? req.query.purchase_order_id : "";
  if (!pidx || !orderId) return res.redirect(`${baseUrl()}/pricing?payment=failed`);
  const order = getPaymentOrderById(orderId);
  if (!order || order.pidx !== pidx || order.status === "failed") {
    return res.redirect(`${baseUrl()}/pricing?payment=failed`);
  }
  if (order.status === "paid") return res.redirect(`${baseUrl()}/pricing?payment=success`);
  const secret = process.env.KHALTI_SECRET_KEY;
  if (!secret) return res.redirect(`${baseUrl()}/pricing?payment=unconfigured`);

  try {
    const response = await fetch(`${khaltiBase()}/epayment/lookup/`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Key ${secret}` },
      body: JSON.stringify({ pidx }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({})) as {
      pidx?: string; total_amount?: number; status?: string; transaction_id?: string | null; refunded?: boolean;
    };
    if (!response.ok || payload.pidx !== order.pidx || Number(payload.total_amount) !== order.amountPaisa ||
        payload.status !== "Completed" || payload.refunded === true) {
      console.warn("Khalti payment not verified as completed", { orderId, status: payload.status, amountMatches: Number(payload.total_amount) === order.amountPaisa });
      return res.redirect(`${baseUrl()}/pricing?payment=pending`);
    }
    if (!markPaymentOrderPaid(order.id, payload.transaction_id || pidx)) {
      return res.redirect(`${baseUrl()}/pricing?payment=pending`);
    }
    return res.redirect(`${baseUrl()}/pricing?payment=success`);
  } catch (error) {
    console.error("Khalti lookup failed", error instanceof Error ? error.message : "Unknown error");
    return res.redirect(`${baseUrl()}/pricing?payment=pending`);
  }
}
