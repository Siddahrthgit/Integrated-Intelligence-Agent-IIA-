const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("PDF exam generation falls back when the preferred Gemini model is unavailable", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iia-quiz-fallback-"));
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
  const storePath = require.resolve("../dist/data/store.js");
  const controllerPath = require.resolve("../dist/controllers/quiz.controller.js");
  delete require.cache[storePath];
  delete require.cache[controllerPath];
  const store = require(storePath);
  const document = store.createUploadedDocument({
    filename: "test.pdf",
    originalName: "Test study notes.pdf",
    mimeType: "application/pdf",
    size: 1234,
    url: "",
    ownerUserId: "test-user",
    extractedText: "Photosynthesis converts light energy into chemical energy. Chlorophyll absorbs light. Plants use carbon dioxide and water to make glucose and release oxygen. This process occurs mainly in chloroplasts.",
    pages: [{ page: 1, text: "Photosynthesis converts light energy into chemical energy." }],
  });
  const { generateQuiz } = require(controllerPath);
  const requestedModels = [];
  const questions = [0, 1, 2].map((index) => ({
    text: `Question ${index + 1} about photosynthesis?`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctOptionIndex: 1,
    explanation: "The source explains photosynthesis.",
  }));
  global.fetch = async (url) => {
    requestedModels.push(String(url));
    if (requestedModels.length === 1) {
      return new Response(JSON.stringify({ error: { message: "model not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ title: "Photosynthesis exam", description: "Practice from the PDF.", questions }) }] } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const state = { statusCode: 200, body: undefined };
  const response = {
    status(code) { state.statusCode = code; return this; },
    json(body) { state.body = body; return this; },
  };
  await generateQuiz({ body: { documentId: document.id, questionCount: 3 }, user: { id: "test-user" } }, response);
  assert.equal(state.statusCode, 201);
  assert.equal(state.body.quiz.questions.length, 3);
  assert.equal(state.body.model, "gemini-3.5-flash-lite");
  assert.equal(requestedModels.length, 2);
  assert.match(requestedModels[0], /model-not-available-to-this-project:generateContent/);
  assert.match(requestedModels[1], /gemini-3\.5-flash-lite:generateContent/);

  t.after(() => {
    global.fetch = previous.fetch;
    for (const [key, value] of Object.entries({
      DATA_FILE: previous.dataFile,
      GEMINI_API_KEY: previous.apiKey,
      GEMINI_MODEL: previous.model,
      GEMINI_FALLBACK_MODELS: previous.fallbacks,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[controllerPath];
    delete require.cache[storePath];
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
