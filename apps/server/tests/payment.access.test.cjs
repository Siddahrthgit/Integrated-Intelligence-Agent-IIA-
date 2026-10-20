const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("paid-access guard blocks unpaid accounts and allows an active subscription", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iia-paid-access-test-"));
  const previous = { dataFile: process.env.DATA_FILE, required: process.env.IIA_REQUIRE_PAID_ACCESS };
  process.env.DATA_FILE = path.join(directory, "store.json");
  process.env.IIA_REQUIRE_PAID_ACCESS = "true";
  const storePath = require.resolve("../dist/data/store.js");
  const middlewarePath = require.resolve("../dist/middleware/paid-access.middleware.js");
  delete require.cache[storePath];
  delete require.cache[middlewarePath];
  const store = require(storePath);
  const { requirePaidAccess } = require(middlewarePath);

  const responseState = { statusCode: 200, body: undefined };
  const response = {
    status(code) { responseState.statusCode = code; return this; },
    json(body) { responseState.body = body; return this; },
  };
  let continued = false;
  const next = () => { continued = true; };
  requirePaidAccess({ user: { id: "unpaid-user" } }, response, next);
  assert.equal(responseState.statusCode, 402);
  assert.equal(responseState.body.code, "PAYMENT_REQUIRED");
  assert.equal(continued, false);

  const order = store.createPaymentOrder({ id: "test-order", userId: "paid-user", planId: "student-monthly", amountPaisa: 49900 });
  store.markPaymentOrderPaid(order.id, "test-transaction");
  responseState.statusCode = 200;
  responseState.body = undefined;
  continued = false;
  requirePaidAccess({ user: { id: "paid-user" } }, response, next);
  assert.equal(continued, true);
  assert.equal(responseState.statusCode, 200);

  t.after(() => {
    if (previous.dataFile === undefined) delete process.env.DATA_FILE;
    else process.env.DATA_FILE = previous.dataFile;
    if (previous.required === undefined) delete process.env.IIA_REQUIRE_PAID_ACCESS;
    else process.env.IIA_REQUIRE_PAID_ACCESS = previous.required;
    delete require.cache[middlewarePath];
    delete require.cache[storePath];
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
