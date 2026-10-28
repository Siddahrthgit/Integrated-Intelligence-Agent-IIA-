import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { userRepository } from "../data/user-repository";

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
};

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const signup = async (req: Request, res: Response) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!name || name.length > 100 || !validEmail(email) || email.length > 254 || password.length < 8 || password.length > 128) {
    return res.status(400).json({
      message: "Provide a name (up to 100 characters), a valid email, and a password between 8 and 128 characters.",
    });
  }

  if (await userRepository.findByEmail(email)) return res.status(409).json({ message: "An account with this email already exists." });

  const hash = await bcrypt.hash(password, 10);
  // The repository performs the final check-and-create atomically for its adapter.
  const user = await userRepository.createIfEmailAvailable({ name, email, password: hash });
  if (!user) return res.status(409).json({ message: "An account with this email already exists." });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, getJwtSecret(), { expiresIn: "7d" });
  return res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
};

export const login = async (req: Request, res: Response) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || email.length > 254 || !password || password.length > 128) {
    return res.status(400).json({ message: "Provide a valid email and password." });
  }

  const user = await userRepository.findByEmail(email);
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, getJwtSecret(), { expiresIn: "7d" });
  return res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
};

export const me = async (req: Request, res: Response) => {
  const user = (req as Request & { user?: unknown }).user;
  return res.json({ user: user || null });
};
