"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateSnapshot } = require("../preflight-json-migration.cjs");

function validSnapshot() {
  return {
    users: [{ id: "u1", name: "Test", email: "test@example.test", password: "$hash" }],
    quizzes: [{ id: "q1", title: "Quiz", description: "", questions: [], ownerUserId: "u1" }],
    attempts: [{ id: "a1", userId: "u1", quizId: "q1", score: 1, totalQuestions: 1, percentage: 100, passed: true, createdAt: "2026-01-01T00:00:00.000Z" }],
    uploadedDocuments: [{ id: "d1", filename: "file.pdf", originalName: "file.pdf", mimeType: "application/pdf", size: 1, url: "/uploads/file.pdf", uploadedAt: "2026-01-01T00:00:00.000Z" }],
    apiKeys: [{ id: "k1", ownerUserId: "u1", name: "test", keyHash: "hash", prefix: "iia_live_", createdAt: "2026-01-01T00:00:00.000Z", expiresAt: "2026-01-01T04:00:00.000Z" }],
    paymentOrders: [{ id: "p1", userId: "u1", planId: "basic", amountPaisa: 100, status: "paid", createdAt: "2026-01-01T00:00:00.000Z", paidAt: "2026-01-01T00:01:00.000Z" }],
    subscriptions: [{ userId: "u1", planId: "basic", startsAt: "2026-01-01T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z", paymentOrderId: "p1" }]
  };
}

test("preflight accepts a consistent legacy snapshot and reports counts", () => {
  const result = validateSnapshot(validSnapshot());
  assert.deepEqual(result.errors, []);
  assert.equal(result.counts.users, 1);
  assert.equal(result.counts.subscriptions, 1);
});

test("preflight detects normalized duplicate emails without exposing values", () => {
  const snapshot = validSnapshot();
  snapshot.users.push({ id: "u2", name: "Second", email: " TEST@example.test ", password: "$hash2" });
  const result = validateSnapshot(snapshot);
  assert.ok(result.errors.some((message) => message.includes("duplicate normalized email")));
  assert.ok(!result.errors.some((message) => message.includes("test@example.test")));
});

test("preflight detects orphaned references", () => {
  const snapshot = validSnapshot();
  snapshot.attempts[0].quizId = "missing";
  const result = validateSnapshot(snapshot);
  assert.ok(result.errors.some((message) => message.includes("missing quiz")));
});

test("preflight detects duplicate IDs and invalid payment status", () => {
  const snapshot = validSnapshot();
  snapshot.quizzes.push({ ...snapshot.quizzes[0] });
  snapshot.paymentOrders[0].status = "unknown";
  const result = validateSnapshot(snapshot);
  assert.ok(result.errors.some((message) => message.includes("duplicate IDs")));
  assert.ok(result.errors.some((message) => message.includes("unsupported status")));
});

test("preflight rejects schema-incompatible timestamps, numeric ranges, and subscription dates", () => {
  const snapshot = validSnapshot();
  snapshot.attempts[0].percentage = 101;
  snapshot.uploadedDocuments[0].uploadedAt = "not-a-date";
  snapshot.apiKeys[0].expiresAt = "not-a-date";
  snapshot.subscriptions[0].expiresAt = snapshot.subscriptions[0].startsAt;
  const result = validateSnapshot(snapshot);
  assert.ok(result.errors.some((message) => message.includes("invalid score fields")));
  assert.ok(result.errors.some((message) => message.includes("uploadedAt timestamp")));
  assert.ok(result.errors.some((message) => message.includes("apiKeys[0] has invalid timestamp")));
  assert.ok(result.errors.some((message) => message.includes("expiresAt must be later")));
});

test("preflight warns that legacy document paths are not verified or migrated", () => {
  const result = validateSnapshot(validSnapshot());
  assert.ok(result.warnings.some((message) => message.includes("does not verify file bytes")));
});
