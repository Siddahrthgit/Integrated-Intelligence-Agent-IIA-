import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type User = { id: string; name: string; email: string; password: string };
export type Question = { id: string; text: string; options: string[]; correctOptionIndex: number; explanation?: string };
export type Quiz = { id: string; title: string; description: string; questions: Question[]; ownerUserId?: string; sourceDocumentId?: string; createdAt?: string };
export type Attempt = { id: string; userId: string; quizId: string; score: number; totalQuestions: number; percentage: number; passed: boolean; createdAt: string };
export type DocumentPage = { page: number; text: string };
export type UploadedDocument = {
  id: string; filename: string; originalName: string; mimeType: string; size: number;
  url: string; uploadedAt: string; extractedText?: string; pages?: DocumentPage[]; ownerUserId?: string;
};
export type PaymentOrder = { id: string; userId: string; planId: string; amountPaisa: number; pidx?: string; status: "pending" | "paid" | "failed"; createdAt: string; paidAt?: string; transactionId?: string };
export type Subscription = { userId: string; planId: string; startsAt: string; expiresAt: string; paymentOrderId: string };
export type IIAApiKey = {
  id: string; ownerUserId: string; name: string; keyHash: string; prefix: string;
  createdAt: string; expiresAt: string; lastUsedAt?: string; revokedAt?: string;
};
type StoreSnapshot = { users: User[]; quizzes: Quiz[]; attempts: Attempt[]; uploadedDocuments: UploadedDocument[]; apiKeys: IIAApiKey[]; paymentOrders?: PaymentOrder[]; subscriptions?: Subscription[] };

const seed: StoreSnapshot = {
  users: [{ id: "user_1", name: "Demo User", email: "demo@example.com", password: "$2a$10$7J6s1XVH2d9QhJXlYh07vO3QcNfQ5l9zPkCz7H0CDJk4GJ0mdOgLe" }],
  quizzes: [{ id: "quiz_1", title: "Frontend Fundamentals", description: "Sample quiz", questions: [{ id: "q1", text: "What does JWT stand for?", options: ["Java Web Token", "JSON Web Token", "JavaScript Web Text"], correctOptionIndex: 1 }] }],
  attempts: [], uploadedDocuments: [], apiKeys: [],
};
const dataFile = path.resolve(process.env.DATA_FILE || path.join(process.cwd(), "data", "store.json"));
function ensureDataDirectory() { fs.mkdirSync(path.dirname(dataFile), { recursive: true }); }
function persist(snapshot: StoreSnapshot) {
  ensureDataDirectory();
  const temporaryFile = `${dataFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
  fs.renameSync(temporaryFile, dataFile);
}
function saveStore() { persist({ users, quizzes, attempts, uploadedDocuments, apiKeys, paymentOrders, subscriptions }); }
function loadSnapshot(): StoreSnapshot {
  ensureDataDirectory();
  if (!fs.existsSync(dataFile)) {
    // Keep the sample account for local development only. A fresh production
    // deployment must never create a pre-seeded account with a published hash.
    const initialSeed = process.env.NODE_ENV === "production"
      ? { ...seed, users: [] }
      : seed;
    persist(initialSeed);
    return structuredClone(initialSeed);
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8")) as Partial<StoreSnapshot>;
    if (!Array.isArray(parsed.users) || !Array.isArray(parsed.quizzes) ||
        !Array.isArray(parsed.attempts) || !Array.isArray(parsed.uploadedDocuments)) {
      throw new Error("Persisted store has an invalid shape");
    }
    const snapshot = parsed as StoreSnapshot;
    if (!Array.isArray(snapshot.apiKeys)) snapshot.apiKeys = [];
    if (!Array.isArray(snapshot.paymentOrders)) snapshot.paymentOrders = [];
    if (!Array.isArray(snapshot.subscriptions)) snapshot.subscriptions = [];
    // Older API keys without expiry are assigned a four-hour lifetime from creation.
    snapshot.apiKeys = snapshot.apiKeys.map((key) => ({
      ...key,
      expiresAt: key.expiresAt || new Date(new Date(key.createdAt).getTime() + 4 * 60 * 60 * 1000).toISOString(),
    }));
    if (!snapshot.quizzes.some((quiz) => quiz.id === "quiz_1")) snapshot.quizzes.unshift(structuredClone(seed.quizzes[0]));
    persist(snapshot);
    return snapshot;
  } catch (error) {
    throw new Error(`Cannot load persistent IIA data from ${dataFile}: ${error instanceof Error ? error.message : "invalid JSON"}`);
  }
}
const initial = loadSnapshot();
export const users: User[] = initial.users;
export const quizzes: Quiz[] = initial.quizzes;
export const attempts: Attempt[] = initial.attempts;
export const uploadedDocuments: UploadedDocument[] = initial.uploadedDocuments;
export const apiKeys: IIAApiKey[] = initial.apiKeys;
export const paymentOrders: PaymentOrder[] = initial.paymentOrders || [];
export const subscriptions: Subscription[] = initial.subscriptions || [];

export function findUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return users.find((user) => user.email.toLowerCase() === normalizedEmail);
}
export function createUser(data: { name: string; email: string; password: string }) {
  const user: User = { id: randomUUID(), name: data.name.trim(), email: data.email.trim().toLowerCase(), password: data.password };
  users.push(user); saveStore(); return user;
}
export function getQuizById(id: string) { return quizzes.find((quiz) => quiz.id === id); }
export function createQuiz(data: { title: string; description: string; questions: Question[]; ownerUserId: string; sourceDocumentId: string }) {
  const quiz: Quiz = { id: randomUUID(), title: data.title, description: data.description, questions: data.questions, ownerUserId: data.ownerUserId, sourceDocumentId: data.sourceDocumentId, createdAt: new Date().toISOString() };
  quizzes.unshift(quiz); saveStore(); return quiz;
}
export function createAttempt(data: { userId: string; quizId: string; score: number; totalQuestions: number; percentage: number; passed: boolean }) {
  const attempt: Attempt = { id: randomUUID(), userId: data.userId, quizId: data.quizId, score: data.score, totalQuestions: data.totalQuestions, percentage: data.percentage, passed: data.passed, createdAt: new Date().toISOString() };
  attempts.push(attempt); saveStore(); return attempt;
}
export function createUploadedDocument(data: { filename: string; originalName: string; mimeType: string; size: number; url: string; extractedText?: string; pages?: DocumentPage[]; ownerUserId?: string }) {
  const document: UploadedDocument = { id: randomUUID(), filename: data.filename, originalName: data.originalName, mimeType: data.mimeType, size: data.size, url: data.url, uploadedAt: new Date().toISOString(), extractedText: data.extractedText, pages: data.pages, ownerUserId: data.ownerUserId };
  uploadedDocuments.push(document); saveStore(); return document;
}
export function getUploadedDocumentById(id: string) { return uploadedDocuments.find((document) => document.id === id); }
export function getUploadedDocumentByIdForUser(id: string, userId: string) {
  return uploadedDocuments.find((document) => document.id === id && document.ownerUserId === userId);
}
export function createApiKey(data: { ownerUserId: string; name: string; keyHash: string; prefix: string }) {
  const now = new Date();
  const key: IIAApiKey = { id: randomUUID(), ownerUserId: data.ownerUserId, name: data.name.trim().slice(0, 80), keyHash: data.keyHash, prefix: data.prefix, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString() };
  apiKeys.unshift(key); saveStore(); return key;
}
export function listApiKeysForUser(ownerUserId: string) {
  return apiKeys.filter((key) => key.ownerUserId === ownerUserId).map(({ keyHash: _secret, ...key }) => key);
}
export function revokeApiKeyForUser(id: string, ownerUserId: string) {
  const key = apiKeys.find((item) => item.id === id && item.ownerUserId === ownerUserId);
  if (!key || key.revokedAt) return false;
  key.revokedAt = new Date().toISOString(); saveStore(); return true;
}
export function rotateApiKeyForUser(id: string, ownerUserId: string, credentials: { keyHash: string; prefix: string }) {
  const previous = apiKeys.find((item) => item.id === id && item.ownerUserId === ownerUserId && !item.revokedAt);
  if (!previous) return undefined;
  previous.revokedAt = new Date().toISOString();
  const now = new Date();
  const next: IIAApiKey = { id: randomUUID(), ownerUserId, name: previous.name, keyHash: credentials.keyHash, prefix: credentials.prefix, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString() };
  apiKeys.unshift(next); saveStore(); return next;
}
export function findActiveApiKeyByHash(keyHash: string) {
  const now = Date.now();
  const key = apiKeys.find((item) => item.keyHash === keyHash && !item.revokedAt && new Date(item.expiresAt).getTime() > now);
  if (!key) return undefined;

  // API keys can be checked on every request. Persist usage at most once every
  // five minutes per key so authentication does not rewrite the entire JSON
  // database for every API call.
  const lastUsedAt = key.lastUsedAt ? Date.parse(key.lastUsedAt) : 0;
  if (!Number.isFinite(lastUsedAt) || now - lastUsedAt >= 5 * 60 * 1000) {
    key.lastUsedAt = new Date(now).toISOString();
    saveStore();
  }
  return key;
}

export function createPaymentOrder(data: { id: string; userId: string; planId: string; amountPaisa: number }) {
  const order: PaymentOrder = { ...data, status: "pending", createdAt: new Date().toISOString() };
  paymentOrders.unshift(order); saveStore(); return order;
}
export function getPaymentOrderById(id: string) { return paymentOrders.find((order) => order.id === id); }
export function getPaymentOrderByPidx(pidx: string) { return paymentOrders.find((order) => order.pidx === pidx); }
export function attachPaymentPidx(orderId: string, pidx: string) {
  const order = getPaymentOrderById(orderId);
  if (!order || order.status !== "pending") return false;
  order.pidx = pidx; saveStore(); return true;
}
export function markPaymentOrderPaid(orderId: string, transactionId: string) {
  const order = getPaymentOrderById(orderId);
  if (!order) return false;
  if (order.status === "paid") return true;
  order.status = "paid"; order.paidAt = new Date().toISOString(); order.transactionId = transactionId;
  const now = new Date();
  const existing = subscriptions.find((item) => item.userId === order.userId && new Date(item.expiresAt).getTime() > now.getTime());
  const startsAt = existing ? existing.expiresAt : now.toISOString();
  const days = order.planId === "student-annual" ? 365 : 30;
  const expiresAt = new Date(new Date(startsAt).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  const subscription: Subscription = { userId: order.userId, planId: order.planId, startsAt, expiresAt, paymentOrderId: order.id };
  if (existing) Object.assign(existing, subscription);
  else subscriptions.unshift(subscription);
  saveStore(); return true;
}
export function getActiveSubscription(userId: string) {
  const now = Date.now();
  return subscriptions.find((item) => item.userId === userId && new Date(item.expiresAt).getTime() > now) || null;
}
