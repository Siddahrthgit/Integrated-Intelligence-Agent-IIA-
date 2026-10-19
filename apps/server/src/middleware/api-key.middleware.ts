import { createHash } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { findActiveApiKeyByHash } from "../data/store";

export const requireIIAApiKey = (req: Request, res: Response, next: NextFunction) => {
  const rawKey = req.header("x-iia-api-key");
  if (!rawKey || rawKey.length > 160 || !/^iia_live_[A-Za-z0-9_-]{32,}$/.test(rawKey)) {
    return res.status(401).json({ error: { code: "invalid_api_key", message: "Provide a valid API key using the X-IIA-API-Key header." } });
  }
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const record = findActiveApiKeyByHash(keyHash);
  if (!record) {
    return res.status(401).json({ error: { code: "invalid_api_key", message: "The API key is invalid or has been revoked." } });
  }
  (req as Request & { user?: { id: string } }).user = { id: record.ownerUserId };
  return next();
};
