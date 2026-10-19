const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("application records survive reloading the store module", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iia-store-test-"));
  const dataFile = path.join(directory, "store.json");
  process.env.DATA_FILE = dataFile;

  const modulePath = require.resolve("../dist/data/store.js");
  delete require.cache[modulePath];
  const store = require(modulePath);

  const user = store.createUser({
    name: "Persistence Test",
    email: "persist@example.test",
    password: "hashed-password",
  });
  const apiKey = store.createApiKey({
    ownerUserId: user.id,
    name: "Persistence API key",
    keyHash: "test-sha256-hash",
    prefix: "iia_live_test",
  });
  assert.equal(store.listApiKeysForUser(user.id)[0].keyHash, undefined);
  assert.equal(store.findActiveApiKeyByHash("test-sha256-hash")?.id, apiKey.id);
  assert.ok(new Date(apiKey.expiresAt).getTime() - Date.now() > 3 * 60 * 60 * 1000);
  assert.ok(new Date(apiKey.expiresAt).getTime() - Date.now() <= 4 * 60 * 60 * 1000);

  const attempt = store.createAttempt({
    userId: user.id,
    quizId: "quiz_1",
    score: 1,
    totalQuestions: 1,
    percentage: 100,
    passed: true,
  });
  const document = store.createUploadedDocument({
    filename: "fixture.pdf",
    originalName: "fixture.pdf",
    mimeType: "application/pdf",
    size: 123,
    url: "/uploads/fixture.pdf",
    ownerUserId: user.id,
  });

  delete require.cache[modulePath];
  const reloaded = require(modulePath);

  assert.equal(reloaded.findUserByEmail("PERSIST@example.test")?.id, user.id);
  assert.equal(reloaded.attempts.find((item) => item.id === attempt.id)?.percentage, 100);
  assert.equal(reloaded.getUploadedDocumentById(document.id)?.originalName, "fixture.pdf");
  assert.equal(reloaded.getUploadedDocumentById(document.id)?.ownerUserId, user.id);
  assert.equal(reloaded.getUploadedDocumentByIdForUser(document.id, user.id)?.id, document.id);
  assert.equal(reloaded.getUploadedDocumentByIdForUser(document.id, "another-user"), undefined);
  assert.equal(reloaded.listApiKeysForUser(user.id)[0]?.id, apiKey.id);
  assert.equal(reloaded.findActiveApiKeyByHash("test-sha256-hash")?.id, apiKey.id);
  assert.equal(reloaded.revokeApiKeyForUser(apiKey.id, "another-user"), false);
  const expiringKey = reloaded.apiKeys.find((item) => item.id === apiKey.id);
  expiringKey.expiresAt = new Date(Date.now() - 1000).toISOString();
  assert.equal(reloaded.findActiveApiKeyByHash("test-sha256-hash"), undefined);
  const rotated = reloaded.rotateApiKeyForUser(apiKey.id, user.id, { keyHash: "rotated-sha256-hash", prefix: "iia_live_rotated" });
  assert.ok(rotated);
  assert.notEqual(rotated.id, apiKey.id);
  assert.equal(reloaded.findActiveApiKeyByHash("test-sha256-hash"), undefined);
  assert.equal(reloaded.findActiveApiKeyByHash("rotated-sha256-hash")?.id, rotated.id);
  assert.equal(reloaded.revokeApiKeyForUser(rotated.id, user.id), true);
  assert.equal(reloaded.findActiveApiKeyByHash("rotated-sha256-hash"), undefined);

  delete require.cache[modulePath];
  delete process.env.DATA_FILE;
  fs.rmSync(directory, { recursive: true, force: true });
  t.after(() => {
    delete require.cache[modulePath];
    delete process.env.DATA_FILE;
    fs.rmSync(directory, { recursive: true, force: true });
  });
});


test("multi-step planner accepts only a bounded non-empty string plan", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iia-plan-test-"));
  const previousDataFile = process.env.DATA_FILE;
  process.env.DATA_FILE = path.join(directory, "store.json");
  const controllerPath = require.resolve("../dist/controllers/chat.controller.js");
  delete require.cache[controllerPath];
  const { parseBoundedPlan } = require(controllerPath);

  assert.deepEqual(
    parseBoundedPlan(JSON.stringify({ steps: ["  Understand the request ", "Compare options", "Summarize", "Ignore the step limit"] })),
    ["Understand the request", "Compare options", "Summarize"],
  );
  assert.throws(() => parseBoundedPlan(JSON.stringify({ steps: ["only one"] })), /multi-step plan/);
  assert.throws(() => parseBoundedPlan(JSON.stringify({ steps: [1, null] })), /multi-step plan/);
  assert.throws(() => parseBoundedPlan("not json"));

  delete require.cache[controllerPath];
  if (previousDataFile === undefined) delete process.env.DATA_FILE;
  else process.env.DATA_FILE = previousDataFile;
  fs.rmSync(directory, { recursive: true, force: true });
  t.after(() => {
    delete require.cache[controllerPath];
    if (previousDataFile === undefined) delete process.env.DATA_FILE;
    else process.env.DATA_FILE = previousDataFile;
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
