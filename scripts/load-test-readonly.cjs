#!/usr/bin/env node
"use strict";

// Read-only load probe for a staging IIA deployment. It never signs up users,
// creates quizzes, uploads documents, or calls Gemini. Use staging, not production.
const baseUrl = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const concurrency = Number.parseInt(process.env.LOAD_TEST_CONCURRENCY || "25", 10);
const totalRequests = Number.parseInt(process.env.LOAD_TEST_REQUESTS || "500", 10);
const tokens = (process.env.LOAD_TEST_TOKENS || process.env.LOAD_TEST_TOKEN || "")
  .split(",").map((token) => token.trim()).filter(Boolean);

if (!baseUrl) {
  console.error("Set LOAD_TEST_BASE_URL to the staging IIA origin.");
  process.exit(2);
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 1000) {
  console.error("LOAD_TEST_CONCURRENCY must be an integer from 1 to 1000.");
  process.exit(2);
}
if (!Number.isInteger(totalRequests) || totalRequests < 1 || totalRequests > 100000) {
  console.error("LOAD_TEST_REQUESTS must be an integer from 1 to 100000.");
  process.exit(2);
}
if (!tokens.length) {
  console.error("Set LOAD_TEST_TOKEN or comma-separated LOAD_TEST_TOKENS (use dedicated staging accounts).");
  process.exit(2);
}

const endpoints = [
  { path: "/api/health", auth: false },
  { path: "/api/quiz/", auth: true },
  { path: "/api/results/", auth: true },
];
const latencies = [];
const statusCounts = new Map();
const errors = [];
let nextIndex = 0;
const startedAt = performance.now();

async function worker(workerId) {
  while (true) {
    const index = nextIndex++;
    if (index >= totalRequests) return;
    const endpoint = endpoints[index % endpoints.length];
    const token = tokens[index % tokens.length];
    const url = `${baseUrl}${endpoint.path}`;
    const start = performance.now();
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: endpoint.auth ? { authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(15000),
      });
      const duration = performance.now() - start;
      latencies.push(duration);
      statusCounts.set(response.status, (statusCounts.get(response.status) || 0) + 1);
      // Drain the response so the connection can be reused.
      await response.arrayBuffer();
      if (!response.ok) errors.push({ status: response.status, path: endpoint.path, workerId });
    } catch (error) {
      const duration = performance.now() - start;
      latencies.push(duration);
      errors.push({ status: "network_error", path: endpoint.path, workerId, message: error instanceof Error ? error.message : String(error) });
    }
  }
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

(async () => {
  console.log(JSON.stringify({
    target: baseUrl,
    mode: "read-only; no AI calls or data writes",
    concurrency,
    requests: totalRequests,
    uniqueTokens: tokens.length,
    endpoints: endpoints.map((item) => item.path),
  }, null, 2));

  await Promise.all(Array.from({ length: Math.min(concurrency, totalRequests) }, (_, id) => worker(id)));
  const elapsedMs = performance.now() - startedAt;
  const report = {
    elapsedSeconds: Number((elapsedMs / 1000).toFixed(2)),
    requestsCompleted: latencies.length,
    requestsPerSecond: Number((latencies.length / (elapsedMs / 1000)).toFixed(2)),
    latencyMs: {
      p50: Number(percentile(latencies, 0.50).toFixed(1)),
      p95: Number(percentile(latencies, 0.95).toFixed(1)),
      p99: Number(percentile(latencies, 0.99).toFixed(1)),
      max: Number(latencies.reduce((maximum, value) => Math.max(maximum, value), 0).toFixed(1)),
    },
    statusCounts: Object.fromEntries(statusCounts),
    errorCount: errors.length,
    errorRatePercent: Number((errors.length / Math.max(1, latencies.length) * 100).toFixed(2)),
    sampleErrors: errors.slice(0, 10),
  };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
