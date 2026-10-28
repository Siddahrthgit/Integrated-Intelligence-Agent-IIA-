const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("fresh production store does not seed a demo login", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iia-production-seed-test-"));
  const previousDataFile = process.env.DATA_FILE;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.DATA_FILE = path.join(directory, "store.json");
  process.env.NODE_ENV = "production";
  const storePath = require.resolve("../dist/data/store.js");
  delete require.cache[storePath];

  const store = require(storePath);
  assert.equal(store.users.length, 0);
  assert.ok(store.quizzes.some((quiz) => quiz.id === "quiz_1"));
  const persisted = JSON.parse(fs.readFileSync(process.env.DATA_FILE, "utf8"));
  assert.deepEqual(persisted.users, []);

  t.after(() => {
    if (previousDataFile === undefined) delete process.env.DATA_FILE;
    else process.env.DATA_FILE = previousDataFile;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    delete require.cache[storePath];
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
