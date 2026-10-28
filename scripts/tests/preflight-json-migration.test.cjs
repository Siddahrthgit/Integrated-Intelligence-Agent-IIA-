"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateSnapshot } = require("../preflight-json-migration.cjs");

function validSnapshot() {
  return {
    users: [{ id: "u1", name: "Test", email: "test@example.test", password: "$hash" }],
    quizzes: [{ id: "q1", title: "Quiz", description: "", questions: [], ownerUserId: "u1" }],
    attempts: [{ id: "a1", userId: "u1", quizId: "q1", score: 1, totalQuestions: 1, percentage: 100 }],
    uploadedDocuments: [{ id: "d1", filename: "file.pdf", originalName: "file.pdf", mimeType: "application/pdf", size: 1, url: "/uploads/file.pdf" }],
    apiKeys: [{ id: "k1", ownerUserId: "u1", keyHash: "hash" }],
    paymentOrders: [{ id: "p1", userId: "u1", status: "paid" }],
    subscriptions: [{ userId: "u1", paymentOrderId: "p1" }]
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
