const args = process.argv.slice(2);
const token = (args[args.length - 1] || "").replace(/^.*token: /, "").trim();
for (const a of args) process.stdout.write(JSON.stringify({ type: "arg", value: a }) + "\n");
process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "stub-args-thread" }) + "\n");
process.stdout.write(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: token } }) + "\n");
process.stdout.write(JSON.stringify({ type: "turn.completed" }) + "\n");
