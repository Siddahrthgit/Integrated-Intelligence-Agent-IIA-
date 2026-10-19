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
export type IIAApiKey = {
  id: string; ownerUserId: string; name: string; keyHash: string; prefix: string;
  createdAt: string; expiresAt: string; lastUsedAt?: string; revokedAt?: string;
};
type StoreSnapshot = { users: User[]; quizzes: Quiz[]; attempts: Attempt[]; uploadedDocuments: UploadedDocument[]; apiKeys: IIAApiKey[] };

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
function saveStore() { persist({ users, quizzes, attempts, uploadedDocuments, apiKeys }); }
function loadSnapshot(): StoreSnapshot {
  ensureDataDirectory();
  if (!fs.existsSync(dataFile)) { persist(seed); return structuredClone(seed); }
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8")) as Partial<StoreSnapshot>;
    if (!Array.isArray(parsed.users) || !Array.isArray(parsed.quizzes) ||
        !Array.isArray(parsed.attempts) || !Array.isArray(parsed.uploadedDocuments)) {
      throw new Error("Persisted store has an invalid shape");
    }
    const snapshot = parsed as StoreSnapshot;
    if (!Array.isArray(snapshot.apiKeys)) snapshot.apiKeys = [];
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
  key.lastUsedAt = new Date().toISOString(); saveStore(); return key;
}
