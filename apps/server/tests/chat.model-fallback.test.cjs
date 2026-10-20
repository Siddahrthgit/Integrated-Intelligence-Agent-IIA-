const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("chat retries an unavailable preferred model and reports the model that answered", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iia-model-fallback-test-"));
  const previous = {
    dataFile: process.env.DATA_FILE,
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    fallbacks: process.env.GEMINI_FALLBACK_MODELS,
    fetch: global.fetch,
  };
  process.env.DATA_FILE = path.join(directory, "store.json");
  process.env.GEMINI_API_KEY = "test-only-provider-key";
  process.env.GEMINI_MODEL = "model-not-available-to-this-project";
  process.env.GEMINI_FALLBACK_MODELS = "gemini-3.5-flash-lite";
  const controllerPath = require.resolve("../dist/controllers/chat.controller.js");
  delete require.cache[controllerPath];
  const { chatWithIIA } = require(controllerPath);
  const requestedModels = [];
  global.fetch = async (url) => {
    requestedModels.push(String(url));
    if (requestedModels.length === 1) {
      return new Response(JSON.stringify({ error: { message: "model not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Hello from fallback" }] } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const responseState = { statusCode: 200, body: undefined };
  const response = {
    status(code) { responseState.statusCode = code; return this; },
    json(body) { responseState.body = body; return this; },
  };
  await chatWithIIA({ body: { message: "Say hello" }, user: { id: "test-user" } }, response);

  assert.equal(responseState.statusCode, 200);
  assert.equal(responseState.body.answer, "Hello from fallback");
  assert.equal(responseState.body.model, "gemini-3.5-flash-lite");
  assert.equal(requestedModels.length, 2);
  assert.match(requestedModels[0], /model-not-available-to-this-project:generateContent/);
  assert.match(requestedModels[1], /gemini-3\.5-flash-lite:generateContent/);

  t.after(() => {
    global.fetch = previous.fetch;
    if (previous.dataFile === undefined) delete process.env.DATA_FILE;
    else process.env.DATA_FILE = previous.dataFile;
    if (previous.apiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous.apiKey;
    if (previous.model === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previous.model;
    if (previous.fallbacks === undefined) delete process.env.GEMINI_FALLBACK_MODELS;
    else process.env.GEMINI_FALLBACK_MODELS = previous.fallbacks;
    delete require.cache[controllerPath];
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
