import { Request, Response } from "express";
import { attempts } from "../data/store";

type AuthenticatedRequest = Request & { user?: { id?: string } };

export const listAttempts = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) return res.status(401).json({ message: "Sign in to view your results." });

  // Never return another account's score history.
  return res.json(attempts.filter((item) => item.userId === userId));
};

export const getAttemptById = async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.id;
  if (!userId) return res.status(401).json({ message: "Sign in to view your results." });

  const attempt = attempts.find((item) => item.id === req.params.attemptId && item.userId === userId);
  // Return the same not-found response for missing and non-owned IDs to avoid leaking record existence.
  if (!attempt) return res.status(404).json({ message: "Attempt not found" });

  return res.json(attempt);
};
