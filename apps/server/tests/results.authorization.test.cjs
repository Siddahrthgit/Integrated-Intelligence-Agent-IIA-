const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("results endpoints return only the authenticated user's attempts", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iia-results-auth-test-"));
  const previousDataFile = process.env.DATA_FILE;
  process.env.DATA_FILE = path.join(directory, "store.json");

  const storePath = require.resolve("../dist/data/store.js");
  const controllerPath = require.resolve("../dist/controllers/result.controller.js");
  delete require.cache[controllerPath];
  delete require.cache[storePath];

  const store = require(storePath);
  const { listAttempts, getAttemptById } = require(controllerPath);
  const own = store.createAttempt({
    userId: "user-a", quizId: "quiz_1", score: 8, totalQuestions: 10,
    percentage: 80, passed: true,
  });
  const other = store.createAttempt({
    userId: "user-b", quizId: "quiz_1", score: 2, totalQuestions: 10,
    percentage: 20, passed: false,
  });

  function responseRecorder() {
    return {
      statusCode: 200,
      body: undefined,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
  }

  const listResponse = responseRecorder();
  await listAttempts({ user: { id: "user-a" } }, listResponse);
  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.body.map((item) => item.id), [own.id]);
  assert.equal(listResponse.body.some((item) => item.userId === "user-b"), false);

  const ownResponse = responseRecorder();
  await getAttemptById({ user: { id: "user-a" }, params: { attemptId: own.id } }, ownResponse);
  assert.equal(ownResponse.statusCode, 200);
  assert.equal(ownResponse.body.id, own.id);

  const otherResponse = responseRecorder();
  await getAttemptById({ user: { id: "user-a" }, params: { attemptId: other.id } }, otherResponse);
  assert.equal(otherResponse.statusCode, 404);
  assert.deepEqual(otherResponse.body, { message: "Attempt not found" });

  const anonymousResponse = responseRecorder();
  await listAttempts({ user: undefined }, anonymousResponse);
  assert.equal(anonymousResponse.statusCode, 401);

  t.after(() => {
    if (previousDataFile === undefined) delete process.env.DATA_FILE;
    else process.env.DATA_FILE = previousDataFile;
    delete require.cache[controllerPath];
    delete require.cache[storePath];
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
