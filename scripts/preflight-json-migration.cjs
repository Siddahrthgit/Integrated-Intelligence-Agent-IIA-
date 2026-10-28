#!/usr/bin/env node
"use strict";

// Read-only preflight for the legacy JSON snapshot. It never prints record contents,
// passwords, API-key hashes, document text, or payment identifiers.
const fs = require("node:fs");
const path = require("node:path");

function fail(message) {
  console.error(`Migration preflight failed: ${message}`);
  process.exitCode = 1;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateSnapshot(snapshot) {
  const errors = [];
  const warnings = [];
  if (!isObject(snapshot)) return { errors: ["root must be a JSON object"], warnings, counts: {} };

  const collections = ["users", "quizzes", "attempts", "uploadedDocuments", "apiKeys", "paymentOrders", "subscriptions"];
  for (const name of collections) {
    if (snapshot[name] === undefined && ["paymentOrders", "subscriptions"].includes(name)) snapshot[name] = [];
    if (!Array.isArray(snapshot[name])) errors.push(name + " must be an array");
  }
  if (errors.length) return { errors, warnings, counts: {} };

  const counts = Object.fromEntries(collections.map((name) => [name, snapshot[name].length]));
  const indexes = {};
  for (const name of collections) {
    const seen = new Set();
    indexes[name] = new Map();
    for (const [i, row] of snapshot[name].entries()) {
      if (!isObject(row)) { errors.push(name + "[" + i + "] must be an object"); continue; }
      if (typeof row.id === "string" && row.id) {
        if (seen.has(row.id)) errors.push(name + " contains duplicate IDs");
        seen.add(row.id);
        indexes[name].set(row.id, row);
      } else if (name !== "subscriptions") {
        errors.push(name + "[" + i + "] has no non-empty string ID");
      }
    }
  }

  const emails = new Set();
  for (const [i, user] of snapshot.users.entries()) {
    if (typeof user.email !== "string" || !user.email.trim()) errors.push("users[" + i + "] has no email");
    else {
      const email = user.email.trim().toLowerCase();
      if (emails.has(email)) errors.push("users contains duplicate normalized email addresses");
      emails.add(email);
    }
    if (typeof user.name !== "string" || typeof user.password !== "string" || !user.password) {
      errors.push("users[" + i + "] is missing name or stored password hash");
    }
  }

  const ref = (collection, id, label, nullable = false) => {
    if ((id === undefined || id === null || id === "") && nullable) return;
    if (typeof id !== "string" || !indexes[collection].has(id)) errors.push(label + " references a missing " + collection.slice(0, -1) + " record");
  };

  for (const [i, quiz] of snapshot.quizzes.entries()) {
    if (typeof quiz.title !== "string") errors.push("quizzes[" + i + "] has no title");
    if (!Array.isArray(quiz.questions)) errors.push("quizzes[" + i + "].questions must be an array");
    ref("users", quiz.ownerUserId, "quiz owner", true);
    ref("uploadedDocuments", quiz.sourceDocumentId, "quiz source document", true);
  }
  for (const [i, row] of snapshot.attempts.entries()) {
    ref("users", row.userId, "attempt user");
    ref("quizzes", row.quizId, "attempt quiz");
    if (!Number.isFinite(row.score) || !Number.isFinite(row.totalQuestions) || !Number.isFinite(row.percentage)) errors.push("attempts[" + i + "] has invalid score fields");
  }
  for (const [i, row] of snapshot.uploadedDocuments.entries()) {
    if (typeof row.filename !== "string" || typeof row.originalName !== "string" || typeof row.mimeType !== "string") errors.push("uploadedDocuments[" + i + "] has invalid file metadata");
    if (!Number.isFinite(row.size) || row.size < 0) errors.push("uploadedDocuments[" + i + "] has invalid size");
    if (row.ownerUserId) ref("users", row.ownerUserId, "document owner");
    if (typeof row.url !== "string" || !row.url) warnings.push("some document URLs may need mapping to private object-storage keys");
  }
  for (const [i, row] of snapshot.apiKeys.entries()) {
    ref("users", row.ownerUserId, "API key owner");
    if (typeof row.keyHash !== "string" || !row.keyHash) errors.push("apiKeys[" + i + "] has no stored key hash");
  }
  const pidxs = new Set();
  for (const [i, row] of snapshot.paymentOrders.entries()) {
    ref("users", row.userId, "payment order user");
    if (!["pending", "paid", "failed"].includes(row.status)) errors.push("paymentOrders[" + i + "] has an unsupported status");
    if (row.pidx) {
      if (pidxs.has(row.pidx)) errors.push("paymentOrders contains duplicate payment provider references");
      pidxs.add(row.pidx);
    }
  }
  const subscriptionUsers = new Set();
  for (const row of snapshot.subscriptions) {
    ref("users", row.userId, "subscription user");
    ref("paymentOrders", row.paymentOrderId, "subscription payment order");
    if (subscriptionUsers.has(row.userId)) errors.push("subscriptions contains more than one record for a user");
    subscriptionUsers.add(row.userId);
  }

  if (!snapshot.quizzes.some((quiz) => quiz.id === "quiz_1")) warnings.push("legacy demo quiz quiz_1 is absent; confirm expected behavior before cutover");
  return { errors, warnings, counts };
}

function main() {
  const input = process.argv[2] || process.env.DATA_FILE || path.join(process.cwd(), "data", "store.json");
  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
  } catch (error) {
    fail("cannot read/parse input JSON (" + (error && error.code === "ENOENT" ? "file not found" : "invalid or unreadable JSON") + ")");
    return;
  }
  const result = validateSnapshot(snapshot);
  console.log("IIA JSON migration preflight (read-only)");
  console.log("Input: " + path.resolve(input));
  console.log("Record counts: " + JSON.stringify(result.counts));
  for (const warning of result.warnings) console.log("WARNING: " + warning);
  if (result.errors.length) {
    for (const error of result.errors) console.error("ERROR: " + error);
    fail(result.errors.length + " validation issue(s); no data was changed");
  } else {
    console.log("PASS: structural and referential checks passed; no data was changed");
  }
}

if (require.main === module) main();
module.exports = { validateSnapshot };
