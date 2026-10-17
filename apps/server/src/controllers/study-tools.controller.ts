import { Request, Response } from "express";
import { analyzeLocalText } from "../study-tools/localQuizEngine";

export function analyzeStudyText(req: Request, res: Response) {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const countValue = Number(req.body?.questionCount ?? 20);
  if (!text.trim()) return res.status(400).json({ message: "Provide non-empty study text." });
  if (text.length > 100_000) return res.status(413).json({ message: "Study text is too large. Limit: 100,000 characters." });
  if (!Number.isFinite(countValue) || countValue < 0 || countValue > 20) {
    return res.status(400).json({ message: "questionCount must be between 0 and 20." });
  }
  return res.json(analyzeLocalText(text, countValue));
}
