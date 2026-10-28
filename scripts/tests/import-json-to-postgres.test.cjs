"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSql, sql } = require("../import-json-to-postgres.cjs");

function snapshot() {
  return {
    users: [{ id: "u'1", name: "Test", email: "test@example.test", password: "$hash" }],
    quizzes: [{ id: "q1", title: "Quiz", description: "", questions: [{ id: "x", text: "Q", options: ["a", "b"], correctOptionIndex: 0 }], ownerUserId: "u'1", createdAt: "2026-01-01T00:00:00.000Z" }],
    attempts: [{ id: "a1", userId: "u'1", quizId: "q1", score: 1, totalQuestions: 1, percentage: 100, passed: true, createdAt: "2026-01-01T00:00:00.000Z" }],
    uploadedDocuments: [],
    apiKeys: [{ id: "k1", ownerUserId: "u'1", name: "test", keyHash: "secret-hash", prefix: "iia_live_", createdAt: "2026-01-01T00:00:00.000Z", expiresAt: "2026-01-01T04:00:00.000Z" }],
    paymentOrders: [{ id: "p1", userId: "u'1", planId: "basic", amountPaisa: 100, status: "paid", createdAt: "2026-01-01T00:00:00.000Z" }],
    subscriptions: [{ userId: "u'1", planId: "basic", startsAt: "2026-01-01T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z", paymentOrderId: "p1" }]
  };
}
test("SQL literals escape quotes and never interpolate raw strings", () => {
  assert.equal(sql("x'; DROP TABLE users; --"), "'x''; DROP TABLE users; --'");
});
test("SQL preserves IDs and hashes, maps JSON and nullable timestamps", () => {
  const generated = buildSql(snapshot());
  assert.match(generated, /INSERT INTO users/);
  assert.match(generated, /'u''1'/);
  assert.match(generated, /'\$hash'/);
  assert.match(generated, /'\[\{\\\"id\\\":/);
  assert.match(generated, /INSERT INTO api_keys/);
  assert.match(generated, /INSERT INTO payment_orders/);
  assert.match(generated, /INSERT INTO subscriptions/);
  assert.match(generated, /IF EXISTS \(SELECT 1 FROM users LIMIT 1\)/);
  assert.match(generated, /COMMIT;/);
});
test("SQL import is transactional and checks all target tables before inserts", () => {
  const generated = buildSql(snapshot());
  assert.ok(generated.indexOf("DO $$ BEGIN") < generated.indexOf("INSERT INTO users"));
  assert.ok(generated.indexOf("BEGIN;") < generated.indexOf("INSERT INTO users"));
  assert.ok(generated.indexOf("INSERT INTO quizzes") < generated.indexOf("INSERT INTO attempts"));
});
