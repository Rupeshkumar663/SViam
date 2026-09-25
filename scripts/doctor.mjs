import { readFileSync } from "node:fs";
import net from "node:net";
let failed = false;
function check(ok, message) { console.log(`${ok ? "OK" : "FAIL"} ${message}`); if (!ok) failed = true; }
check(Number(process.versions.node.split(".")[0]) >= 20, "Node.js 20+ (22 LTS recommended)");
let env = {};
try {
  env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
  check(true, ".env.local exists");
} catch { check(false, ".env.local missing; run npm run setup"); }
check(["mock", "voice"].includes(env.AGENT_MODE), "AGENT_MODE is mock or voice");
if (env.AGENT_MODE === "voice") {
  const required = env.SVIAM_ASSIGNMENT_KEY ? ["SVIAM_ASSIGNMENT_KEY", "SVIAM_GATEWAY_URL", "ELEVEN_VOICE_ID"] : ["OPENAI_API_KEY", "DEEPGRAM_API_KEY", "ELEVEN_API_KEY", "ELEVEN_VOICE_ID"];
  for (const name of required) check(Boolean(env[name]), `${name} is present (validity is not tested)`);
}
else console.log("INFO Mock mode does not test microphone, transcription, LLM, or speech generation.");
try {
  const url = new URL(env.LIVEKIT_URL || "ws://127.0.0.1:7880");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Use a local LiveKit URL");
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: url.hostname.replace(/[\[\]]/g, ""), port: Number(url.port || 7880) });
    socket.setTimeout(2000);
    socket.once("connect", () => { socket.destroy(); resolve(); });
    socket.once("error", reject);
    socket.once("timeout", () => { socket.destroy(); reject(new Error("timeout")); });
  });
  check(true, "Local LiveKit port is reachable (transport and voice need the browser check)");
} catch { check(false, "Local LiveKit is not reachable; run livekit-server --dev"); }
process.exitCode = failed ? 1 : 0;
