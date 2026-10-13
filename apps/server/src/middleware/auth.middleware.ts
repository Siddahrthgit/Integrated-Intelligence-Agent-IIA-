import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });

  const token = authHeader.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    (req as Request & { user?: jwt.JwtPayload | string }).user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};


/** Attach a verified user when a bearer token is supplied, but allow public sample-quiz access without one. */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();
  if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ message: "Invalid authorization header" });

  try {
    const decoded = jwt.verify(authHeader.slice("Bearer ".length), getJwtSecret());
    if (typeof decoded === "string" || typeof decoded.id !== "string") {
      return res.status(401).json({ message: "Invalid token" });
    }
    (req as Request & { user?: jwt.JwtPayload | string }).user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};
