import { Request, Response } from "express";
import { attempts } from "../data/store";

export const listAttempts = async (_req: Request, res: Response) => {
  return res.json(attempts);
};

export const getAttemptById = async (req: Request, res: Response) => {
  const attempt = attempts.find((item) => item.id === req.params.attemptId);
  if (!attempt) {
    return res.status(404).json({ message: "Attempt not found" });
  }

  return res.json(attempt);
};
