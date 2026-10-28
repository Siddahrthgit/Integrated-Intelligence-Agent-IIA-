const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("API key authentication avoids rewriting storage for every request", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iia-api-key-usage-test-"));
  const previousDataFile = process.env.DATA_FILE;
  process.env.DATA_FILE = path.join(directory, "store.json");
  const storePath = require.resolve("../dist/data/store.js");
  delete require.cache[storePath];

  const store = require(storePath);
  const user = store.createUser({ name: "API Test", email: "api-test@example.test", password: "hashed" });
  const key = store.createApiKey({
    ownerUserId: user.id,
    name: "test key",
    keyHash: "test-key-hash",
    prefix: "iia_live_test",
  });

  const firstUse = store.findActiveApiKeyByHash(key.keyHash);
  assert.ok(firstUse.lastUsedAt);
  const firstTimestamp = firstUse.lastUsedAt;

  const immediateRepeat = store.findActiveApiKeyByHash(key.keyHash);
  assert.equal(immediateRepeat.lastUsedAt, firstTimestamp);

  immediateRepeat.lastUsedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  const staleTimestamp = immediateRepeat.lastUsedAt;
  const afterWindow = store.findActiveApiKeyByHash(key.keyHash);
  assert.notEqual(afterWindow.lastUsedAt, staleTimestamp);
  assert.ok(Date.parse(afterWindow.lastUsedAt) > Date.parse(staleTimestamp));

  t.after(() => {
    if (previousDataFile === undefined) delete process.env.DATA_FILE;
    else process.env.DATA_FILE = previousDataFile;
    delete require.cache[storePath];
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
