// verify-model.mjs - fixed verification entry for the B installation wrapper.
// Runs one real model turn with the agent CLI, keeps raw stdout/stderr bytes,
// the native exit code, and grades the result with the ORIGINAL judge
// (agent_result.mjs from the reviewed package, pinned by SHA256 below).
//
// Exit codes: 0 passed, 1 graded and failed, 2 invalid input or judge mismatch (the
//             model was NOT invoked), 3 the agent program could not be started,
//             4 the model was invoked but this entry could not finish (saving output,
//             writing the result). Every result carries "invoked" so the caller can
//             tell "nothing ran" (2) from "it ran and we lost the record" (4).
// No dependencies besides Node 18+.
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const JUDGE_SHA256 =
  "0bead26b5e5cad1239682b9e38b6b2582398760971f163dabdbef3ba7f8b5a6f";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error("unexpected argument: " + arg);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--"))
      throw new Error("missing value for --" + key);
    out[key] = value;
    i += 1;
  }
  return out;
}

function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

// Set the instant before spawn() is called; it is the only thing permitted to say
// "the model was invoked". Exit code 2 is impossible once this is true.
let INVOKED = false;

function fail(code, message, extra) {
  let exitCode = code;
  let stage = extra?.stage ?? (INVOKED ? "internal" : "input");
  if (exitCode === 2 && INVOKED) exitCode = 4; // never claim "input error" after a run
  const payload = { passed: false, stage, invoked: INVOKED, error: message };
  if (extra?.resultPath) payload.result = extra.resultPath;
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(exitCode);
}

// Windows command line quoting for cmd.exe /c when the target is a .cmd/.bat shim.
// cmd.exe rules: wrap arguments that contain spaces in double quotes and double any
// inner quote as "" (cmd does not understand backslash escaping).
function cmdQuote(value) {
  if (value === "") return '""';
  if (!/[\s"&|<>^]/.test(value)) return value;
  return '"' + value.replace(/"/g, '""') + '"';
}

function spawnTarget(executable, args, options) {
  const ext = path.extname(executable).toLowerCase();
  if (ext === ".cmd" || ext === ".bat") {
    const comspec = process.env.ComSpec || "cmd.exe";
    const line = [executable, ...args].map(cmdQuote).join(" ");
    // The outer pair of quotes is what cmd.exe /s strips; the rest must reach cmd
    // verbatim, so Node must not re-quote the command line.
    return spawn(comspec, ["/d", "/s", "/c", '"' + line + '"'], {
      ...options,
      windowsVerbatimArguments: true,
    });
  }
  return spawn(executable, args, options);
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const env = process.env;
  const agent = cli.agent ?? env.VERIFY_AGENT;
  const executable = cli.executable ?? env.VERIFY_EXECUTABLE;
  const model = cli.model ?? env.VERIFY_MODEL;
  const settingsFile = cli["settings-file"] ?? env.VERIFY_SETTINGS_FILE ?? "";
  const outputDir = cli["output-dir"] ?? env.VERIFY_OUTPUT_DIR;
  const validator =
    cli.validator ?? env.VERIFY_VALIDATOR ?? path.join(path.dirname(process.argv[1]), "agent_result.mjs");

  if (agent !== "codex" && agent !== "claude")
    fail(2, "--agent must be codex or claude (got: " + String(agent) + ")");
  if (!executable) fail(2, "--executable is required");
  if (!model) fail(2, "--model is required");
  if (!outputDir) fail(2, "--output-dir is required");
  if (!existsSync(executable) || !statSync(executable).isFile())
    fail(2, "executable does not exist or is not a file: " + executable);
  if (agent === "claude") {
    if (model === "auto")
      fail(2, "--model auto is codex-only; claude requires an explicit model name");
    if (!settingsFile) fail(2, "--settings-file is required when --agent is claude");
    if (!existsSync(settingsFile) || !statSync(settingsFile).isFile())
      fail(2, "settings file does not exist or is not a file: " + settingsFile);
  }
  if (!existsSync(validator) || !statSync(validator).isFile())
    fail(2, "judge script (agent_result.mjs) not found: " + validator);
  const judgeSha = sha256File(validator);
  if (judgeSha !== JUDGE_SHA256)
    fail(
      2,
      "judge script is not the reviewed original; expected sha256 " +
        JUDGE_SHA256 +
        " but got " +
        judgeSha +
        " (" +
        validator +
        ")",
    );

  mkdirSync(outputDir, { recursive: true });
  const stdoutFile = path.join(outputDir, "model.stdout.jsonl");
  const stderrFile = path.join(outputDir, "model.stderr.log");
  const resultFile = path.join(outputDir, "verify-result.json");

  const expected = "AGENT_VERIFY_" + randomBytes(16).toString("hex");
  const prompt = "Reply with only this token: " + expected;
  // --model auto means "use whatever model the CLI is configured with" and is the only
  // value that does not pass -m. It is recorded as auto in verify-result.json.
  const modelArgs = model === "auto" ? [] : ["-m", model];
  const agentArgs =
    agent === "claude"
      ? ["-p", prompt, "--output-format", "json", "--model", model, "--settings", settingsFile, "--strict-mcp-config"]
      : ["exec", "--json", "--skip-git-repo-check", "--sandbox", "workspace-write", ...modelArgs, prompt];

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const stdoutChunks = [];
  const stderrChunks = [];
  let spawnError = null;
  let exitCode = null;
  let signal = null;

  const child = (() => {
    INVOKED = true;
    try {
      return spawnTarget(executable, agentArgs, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      spawnError = error;
      return null;
    }
  })();

  if (child) {
    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      child.on("error", (error) => {
        spawnError = error;
        done();
      });
      child.on("close", (code, sig) => {
        exitCode = code;
        signal = sig;
        done();
      });
    });
  }

  const stdoutBuffer = Buffer.concat(stdoutChunks);
  const stderrBuffer = Buffer.concat(stderrChunks);
  const finishedAt = new Date().toISOString();
  try {
    writeFileSync(stdoutFile, stdoutBuffer);
    writeFileSync(stderrFile, stderrBuffer);
  } catch (error) {
    fail(4, "the model ran but its output could not be saved: " + String(error?.message ?? error), {
      stage: "output",
    });
  }

  // A signalled run has no exit code; report it as 124 so the judge fails closed
  // instead of being graded as a successful process.
  const judgeExitCode = exitCode === null && signal ? 124 : exitCode;
  const result = {
    passed: false,
    stage: "ran",
    invoked: true,
    agent,
    model,
    agentArgs,
    executable,
    executableSize: existsSync(executable) ? statSync(executable).size : null,
    settingsFile: agent === "claude" ? settingsFile : null,
    expectedToken: expected,
    node: process.version,
    startedAt,
    finishedAt,
    durationMs: Date.now() - startedMs,
    nativeExitCode: exitCode,
    signal,
    spawnError: spawnError ? String(spawnError.message ?? spawnError) : null,
    stdoutFile,
    stdoutBytes: stdoutBuffer.length,
    stdoutSha256: createHash("sha256").update(stdoutBuffer).digest("hex"),
    stderrFile,
    stderrBytes: stderrBuffer.length,
    stderrSha256: createHash("sha256").update(stderrBuffer).digest("hex"),
    judge: { path: validator, sha256: judgeSha, passed: false, session: null, error: null },
  };

  if (spawnError || judgeExitCode === null) {
    result.stage = "spawn";
    result.error =
      "could not start or could not collect the model process: " + result.spawnError;
    result.judge.error = null;
    try {
      writeFileSync(resultFile, JSON.stringify(result, null, 2) + "\n");
    } catch (error) {
      fail(4, "could not write verify-result.json: " + String(error?.message ?? error), {
        stage: "output",
      });
    }
    return fail(3, result.error, { stage: "spawn", resultPath: resultFile });
  }

  let judgeError = null;
  let judgeSession = null;
  try {
    const judgeModule = await import(pathToFileURL(validator).href);
    if (typeof judgeModule.verifyAgentResult !== "function")
      throw new Error("judge script does not export verifyAgentResult");
    const verdict = judgeModule.verifyAgentResult({
      agent,
      stdout: stdoutBuffer.toString("utf8"),
      exitCode: judgeExitCode,
      expected,
    });
    judgeSession = verdict?.session ?? null;
    result.judge.passed = true;
    result.judge.session = judgeSession;
    result.passed = true;
    result.stage = "graded";
  } catch (error) {
    judgeError = String(error?.message ?? error);
    result.judge.error = judgeError;
    result.stage = "graded";
    result.error = judgeError;
  }

  try {
    writeFileSync(resultFile, JSON.stringify(result, null, 2) + "\n");
  } catch (error) {
    fail(4, "could not write verify-result.json: " + String(error?.message ?? error), {
      stage: "output",
    });
  }
  const summary = {
    passed: result.passed,
    stage: result.stage,
    invoked: true,
    agent,
    model,
    nativeExitCode: exitCode,
    signal,
    expectedToken: expected,
    judgeError,
    session: judgeSession,
    result: resultFile,
    stdout: stdoutFile,
    stderr: stderrFile,
  };
  process.stdout.write(JSON.stringify(summary) + "\n");
  process.exit(result.passed ? 0 : 1);
}

main().catch((error) => {
  const message = "verification entry crashed: " + String(error?.message ?? error);
  fail(INVOKED ? 4 : 2, message, { stage: INVOKED ? "internal" : "input" });
});
