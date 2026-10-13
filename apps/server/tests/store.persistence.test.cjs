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
