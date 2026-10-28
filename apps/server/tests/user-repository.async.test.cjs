const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("async JSON user repository normalizes email and prevents duplicate creation", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iia-user-repository-"));
  const previousDataFile = process.env.DATA_FILE;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.DATA_FILE = path.join(directory, "store.json");
  process.env.NODE_ENV = "test";

  const storePath = require.resolve("../dist/data/store.js");
  const repositoryPath = require.resolve("../dist/data/user-repository.js");
  delete require.cache[repositoryPath];
  delete require.cache[storePath];

  try {
    const { JsonUserRepository } = require(repositoryPath);
    const repository = new JsonUserRepository();

    assert.equal(await repository.findByEmail("  NEW.USER@example.test "), undefined);

    const attempts = await Promise.all([
      repository.createIfEmailAvailable({
        name: " New User ",
        email: " New.User@Example.Test ",
        password: "hash-one",
      }),
      repository.createIfEmailAvailable({
        name: "Duplicate User",
        email: "new.user@example.test",
        password: "hash-two",
      }),
    ]);

    const created = attempts.filter(Boolean);
    assert.equal(created.length, 1);
    assert.equal(created[0].name, "New User");
    assert.equal(created[0].email, "new.user@example.test");
    assert.equal(await repository.findByEmail("NEW.USER@EXAMPLE.TEST")?.then((user) => user?.id), created[0].id);

    const stored = JSON.parse(fs.readFileSync(process.env.DATA_FILE, "utf8"));
    assert.equal(stored.users.filter((user) => user.email === "new.user@example.test").length, 1);
  } finally {
    delete require.cache[repositoryPath];
    delete require.cache[storePath];
    if (previousDataFile === undefined) delete process.env.DATA_FILE;
    else process.env.DATA_FILE = previousDataFile;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
