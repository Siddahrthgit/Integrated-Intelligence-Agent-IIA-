import { createHash, randomBytes } from "node:crypto";
import { Request, Response } from "express";
import { createApiKey, listApiKeysForUser, revokeApiKeyForUser, rotateApiKeyForUser } from "../data/store";

type AuthRequest = Request & { user?: { id?: string } };

export const listDeveloperApiKeys = (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) return res.status(401).json({ message: "Sign in to manage API keys." });
  return res.json({ keys: listApiKeysForUser(userId) });
};

export const createDeveloperApiKey = (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) return res.status(401).json({ message: "Sign in to create an API key." });
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 80) return res.status(400).json({ message: "API key name must be between 1 and 80 characters." });
  if (listApiKeysForUser(userId).filter((key) => !key.revokedAt && new Date(key.expiresAt).getTime() > Date.now()).length >= 10) return res.status(409).json({ message: "You already have 10 active API keys. Revoke an unused key before creating another." });
  const rawKey = "iia_live_" + randomBytes(32).toString("base64url");
  const record = createApiKey({
    ownerUserId: userId,
    name,
    keyHash: createHash("sha256").update(rawKey).digest("hex"),
    prefix: rawKey.slice(0, 17),
  });
  return res.status(201).json({
    key: rawKey,
    warning: "Copy this key now. It is shown only once; IIA stores only its SHA-256 hash.",
    apiKey: { id: record.id, name: record.name, prefix: record.prefix, createdAt: record.createdAt },
  });
};

export const revokeDeveloperApiKey = (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) return res.status(401).json({ message: "Sign in to revoke an API key." });
  if (!revokeApiKeyForUser(req.params.id, userId)) return res.status(404).json({ message: "API key not found or already revoked." });
  return res.status(204).end();
};

export const rotateDeveloperApiKey = (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) return res.status(401).json({ message: "Sign in to regenerate an API key." });
  const rawKey = "iia_live_" + randomBytes(32).toString("base64url");
  const record = rotateApiKeyForUser(req.params.id, userId, {
    keyHash: createHash("sha256").update(rawKey).digest("hex"),
    prefix: rawKey.slice(0, 17),
  });
  if (!record) return res.status(404).json({ message: "API key not found or already revoked. Create a new key if necessary." });
  return res.status(200).json({
    key: rawKey,
    warning: "Copy this replacement key now. It is shown only once. The previous key has been revoked.",
    apiKey: { id: record.id, name: record.name, prefix: record.prefix, createdAt: record.createdAt, expiresAt: record.expiresAt },
  });
};
