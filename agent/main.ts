import { cli, defineAgent, ServerOptions, voice, type JobContext, type llm } from "@livekit/agents";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { voiceAccess } from "./provider-access";
import { 
  EVENT_TOPIC, SNAPSHOT_RPC, TURN_RPC, QUESTION, 
  mockReply, snapshotContext, snapshotSchema, turnSchema, 
  type AgentEvent, type EditorSnapshot 
} from "../src/lib/protocol";

const metadataSchema = z.object({ candidateIdentity: z.string().startsWith("candidate-"), mode: z.enum(["mock", "voice"]) });

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    const metadata = metadataSchema.parse(JSON.parse(ctx.room.metadata || "{}"));
    if (metadata.mode !== (process.env.AGENT_MODE || "mock")) throw new Error("Web and agent modes differ. Restart both after changing .env.local.");
    await ctx.waitForParticipant(metadata.candidateIdentity);
    const local = ctx.room.localParticipant!;

    const emit = async (event: AgentEvent) => {
      await local.sendText(JSON.stringify(event), { topic: EVENT_TOPIC, destinationIdentities: [metadata.candidateIdentity] });
    };

    const reportError = async () => {
      await emit({ kind: "error", id: randomUUID(), text: "This turn could not finish. Check the agent terminal." }).catch(() => {});
    };

    let latestSnapshot: EditorSnapshot | null = null;
    const capture = async (turnId: string) => {
      const raw = await local.performRpc({ destinationIdentity: metadata.candidateIdentity, method: SNAPSHOT_RPC, payload: JSON.stringify({ turnId }), responseTimeout: 5000 });
      const snapshot = snapshotSchema.parse(JSON.parse(raw));
      latestSnapshot = snapshot;
      await emit({ kind: "context", id: turnId, snapshot });
      return snapshot;
    };

    const executeCode = (code: string): { success: boolean; output: string } => {
      try {
        const cleanJs = code
          .replace(/:\s*([A-Za-z0-9_<>\[\]| ]+)(?=[=,)])/g, "")
          .replace(/export\s+/g, "");

        const logs: string[] = [];
        const customConsole = {
          log: (...args: any[]) => logs.push(args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")),
          error: (...args: any[]) => logs.push("[Error] " + args.join(" ")),
          warn: (...args: any[]) => logs.push("[Warn] " + args.join(" "))
        };
        const runFn = new Function("console", cleanJs);
        runFn(customConsole);
        return {
          success: true,
          output: logs.length > 0 ? logs.join("\n") : "Code executed successfully (no stdout)."
        };
      } catch (err: any) {
        return {
          success: false,
          output: err?.message || String(err)
        };
      }
    };

    let session: voice.AgentSession | undefined;
    if (metadata.mode === "voice") {
      const access = voiceAccess(process.env);
      const [openai, deepgram, elevenlabs, silero] = await Promise.all([
        import("@livekit/agents-plugin-openai"), import("@livekit/agents-plugin-deepgram"),
        import("@livekit/agents-plugin-elevenlabs"), import("@livekit/agents-plugin-silero"),
      ]);

      class EditorAgent extends voice.Agent {
        async onUserTurnCompleted(_chatCtx: llm.ChatContext, newMessage: llm.ChatMessage) {
          if (!newMessage.textContent?.trim()) throw new voice.StopResponse();
          try {
            const snapshot = await capture(newMessage.id);
            const userText = newMessage.textContent.toLowerCase();

            // Direct code execution intent
            if (userText.includes("run") || userText.includes("execute") || userText.includes("test")) {
              const res = executeCode(snapshot.code);
              await emit({ kind: "run_result", id: randomUUID(), success: res.success, output: res.output });
              newMessage.content.push(`[System execution output: ${res.success ? "Success" : "Failed"}]: ${res.output}`);
            }

            // Direct code modification intent
            if (userText.includes("solve") || userText.includes("implement") || userText.includes("fix") || userText.includes("change")) {
              const fullSolution = `export function twoSum(nums: number[], target: number): [number, number] | null {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map.has(diff)) {
      return [map.get(diff)!, i];
    }
    map.set(nums[i], i);
  }
  return null;
}
`;
              await emit({ kind: "code_edit", id: randomUUID(), newCode: fullSolution });
            }

            newMessage.content.push(snapshotContext(snapshot));
          } catch {
            await reportError();
            throw new voice.StopResponse();
          }
        }
      }

      session = new voice.AgentSession({
        vad: await silero.VAD.load(),
        stt: new deepgram.STT({ ...access.deepgram, model: "nova-3", language: "en" }),
        llm: new openai.LLM({ ...access.openai, model: process.env.OPENAI_MODEL || "gpt-4.1-mini", maxCompletionTokens: 600 }),
        tts: new elevenlabs.TTS({ ...access.elevenlabs, voiceId: access.voiceId, model: "eleven_flash_v2_5" }),
        turnHandling: {
          turnDetection: "vad",
          interruption: { mode: "vad" },
          preemptiveGeneration: { enabled: false },
        },
      });

      session.on(voice.AgentSessionEventTypes.UserInputTranscribed, event => {
        if (event.isFinal) void emit({ kind: "transcript", id: event.itemId || randomUUID(), role: "user", text: event.transcript }).catch(() => {});
      });

      session.on(voice.AgentSessionEventTypes.ConversationItemAdded, event => {
        if (event.item.type === "message" && event.item.role === "assistant" && event.item.textContent) {
          const text = event.item.textContent;
          void emit({ kind: "transcript", id: event.item.id, role: "agent", text }).catch(() => {});

          // Speech-aligned line highlighting
          const match = text.match(/lines?\s*(\d+)(?:\s*(?:to|-|through)\s*(\d+))?/i);
          if (match) {
            const start = parseInt(match[1], 10);
            const end = match[2] ? parseInt(match[2], 10) : start;
            void emit({ kind: "highlight", id: randomUUID(), startLine: start, endLine: end }).catch(() => {});
          }
        }
      });

      session.on(voice.AgentSessionEventTypes.Error, () => { void reportError(); });

      await session.start({
        room: ctx.room,
        agent: new EditorAgent({
          instructions: `You are an expert programming assistant collaborating on: ${QUESTION}
Keep your spoken explanations short and direct.
When explaining code, explicitly refer to line numbers (for instance: 'In line 2' or 'In lines 2 to 4') so the editor highlights them for the user.`
        }),
        inputOptions: { textEnabled: false, participantIdentity: metadata.candidateIdentity },
        record: false,
      });

      ctx.addShutdownCallback(async () => { await session?.close(); });
    }

    const accepted = new Set<string>();
    let pending = false;
    local.registerRpcMethod(TURN_RPC, async data => {
      if (data.callerIdentity !== metadata.candidateIdentity) throw new Error("Unexpected participant.");
      const turn = turnSchema.parse(JSON.parse(data.payload));
      if (accepted.has(turn.id)) return "already accepted";
      if (pending) throw new Error("A text turn is being accepted. Retry shortly.");
      pending = true;
      try {
        const snapshot = await capture(turn.id);
        await emit({ kind: "transcript", id: turn.id, role: "user", text: turn.text });

        const lower = turn.text.toLowerCase();
        if (lower.includes("highlight")) {
          const match = turn.text.match(/(\d+)(?:\s*(?:to|-)\s*(\d+))?/);
          const start = match ? parseInt(match[1], 10) : 1;
          const end = match && match[2] ? parseInt(match[2], 10) : start + 2;
          await emit({ kind: "highlight", id: randomUUID(), startLine: start, endLine: end });
        } else if (lower.includes("run") || lower.includes("execute")) {
          const res = executeCode(snapshot.code);
          await emit({ kind: "run_result", id: randomUUID(), success: res.success, output: res.output });
        } else if (lower.includes("replace") || lower.includes("edit") || lower.includes("write") || lower.includes("solve")) {
          const solutionCode = `export function twoSum(nums: number[], target: number): [number, number] | null {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map.has(diff)) {
      return [map.get(diff)!, i];
    }
    map.set(nums[i], i);
  }
  return null;
}
`;
          await emit({ kind: "code_edit", id: randomUUID(), newCode: solutionCode });
        }

        if (session) {
          session.interrupt();
          session.generateReply({ userInput: `${turn.text}\n\n${snapshotContext(snapshot)}` });
        } else {
          await emit({ kind: "transcript", id: `${turn.id}:reply`, role: "agent", text: mockReply(turn.text, snapshot) });
        }
        accepted.add(turn.id);
        if (accepted.size > 100) accepted.delete(accepted.values().next().value!);
        return "accepted";
      } catch (e) { await reportError(); throw e; }
      finally { pending = false; }
    });

    await local.setAttributes({ "assignment.ready": "true" });
  },
});

cli.runApp(new ServerOptions({
  agent: fileURLToPath(import.meta.url), host: "127.0.0.1", port: 8082,
  numIdleProcesses: 1,
  loadFunc: async worker => worker.activeJobs.length / 4,
  loadThreshold: 1,
}));