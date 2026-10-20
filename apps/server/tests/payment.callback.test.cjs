const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("Khalti callback activates access only after amount and completion are verified", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iia-khalti-callback-"));
  const previous = {
    dataFile: process.env.DATA_FILE,
    secret: process.env.KHALTI_SECRET_KEY,
    env: process.env.KHALTI_ENV,
    publicUrl: process.env.PUBLIC_APP_URL,
    fetch: global.fetch,
  };
  process.env.DATA_FILE = path.join(directory, "store.json");
  process.env.KHALTI_SECRET_KEY = "test-only-khalti-key";
  process.env.KHALTI_ENV = "sandbox";
  process.env.PUBLIC_APP_URL = "https://example.test";
  const storePath = require.resolve("../dist/data/store.js");
  const controllerPath = require.resolve("../dist/controllers/payment.controller.js");
  delete require.cache[storePath];
  delete require.cache[controllerPath];
  const store = require(storePath);
  const { khaltiPaymentCallback } = require(controllerPath);

  const validOrder = store.createPaymentOrder({ id: "valid-order", userId: "paid-user", planId: "student-monthly", amountPaisa: 49900 });
  store.attachPaymentPidx(validOrder.id, "valid-pidx");
  const invalidOrder = store.createPaymentOrder({ id: "invalid-order", userId: "unpaid-user", planId: "student-monthly", amountPaisa: 49900 });
  store.attachPaymentPidx(invalidOrder.id, "wrong-amount-pidx");

  global.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    const valid = request.pidx === "valid-pidx";
    return new Response(JSON.stringify({
      pidx: request.pidx,
      total_amount: valid ? 49900 : 100,
      status: "Completed",
      transaction_id: valid ? "txn-valid" : "txn-invalid",
      refunded: false,
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const redirectTo = [];
  const response = { redirect(url) { redirectTo.push(url); return this; } };
  await khaltiPaymentCallback({ query: { pidx: "valid-pidx", purchase_order_id: validOrder.id } }, response);
  await khaltiPaymentCallback({ query: { pidx: "wrong-amount-pidx", purchase_order_id: invalidOrder.id } }, response);

  assert.equal(store.getPaymentOrderById(validOrder.id).status, "paid");
  assert.ok(store.getActiveSubscription("paid-user"));
  assert.equal(store.getPaymentOrderById(invalidOrder.id).status, "pending");
  assert.equal(store.getActiveSubscription("unpaid-user"), null);
  assert.equal(redirectTo[0], "https://example.test/pricing?payment=success");
  assert.equal(redirectTo[1], "https://example.test/pricing?payment=pending");

  t.after(() => {
    global.fetch = previous.fetch;
    for (const [key, value] of Object.entries({
      DATA_FILE: previous.dataFile,
      KHALTI_SECRET_KEY: previous.secret,
      KHALTI_ENV: previous.env,
      PUBLIC_APP_URL: previous.publicUrl,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[controllerPath];
    delete require.cache[storePath];
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
