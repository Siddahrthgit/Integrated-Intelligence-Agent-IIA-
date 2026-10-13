const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const node = process.execPath;
const npm = isWindows ? "npm.cmd" : "npm";

const children = [
  spawn(node, [path.join(root, "apps/server/dist/server.js")], {
    cwd: root, env: process.env, stdio: "inherit",
  }),
  spawn(npm, ["--workspace", "@smart-quiz/web", "run", "start", "--", "-p", process.env.WEB_PORT || "3000"], {
    cwd: root, env: process.env, stdio: "inherit",
  }),
];

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
  }
  const forceTimer = setTimeout(() => {
    for (const child of children) if (child.exitCode === null) child.kill("SIGKILL");
  }, 8000);
  forceTimer.unref();
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", (error) => {
    console.error("Failed to start application process:", error);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(`Application process exited (code=${code}, signal=${signal}). Stopping container.`);
      shutdown(code && code !== 0 ? code : 1);
    }
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}
