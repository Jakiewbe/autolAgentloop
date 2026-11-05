// Emits a well-formed codex event stream whose final message is NOT the token:
// it must be graded as a failure, not as an input error.
const args = process.argv.slice(2);
const token = (args[args.length - 1] || "").replace(/^.*token: /, "").trim();
process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "stub-wrongtext-thread" }) + "\n");
process.stdout.write(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: token + " (extra)" } }) + "\n");
process.stdout.write(JSON.stringify({ type: "turn.completed" }) + "\n");
