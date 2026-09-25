import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { randomUUID } from "node:crypto";
import { voiceAccess } from "../../agent/provider-access";

const t = initTRPC.create();
export const appRouter = t.router({
  join: t.procedure.mutation(async () => {
    const wsURL = process.env.LIVEKIT_URL || "ws://127.0.0.1:7880";
    const url = new URL(wsURL);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["ws:", "wss:"].includes(url.protocol)) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This starter requires a local LiveKit server." });
    }
    const key = process.env.LIVEKIT_API_KEY || "devkey";
    const secret = process.env.LIVEKIT_API_SECRET || "secret";
    const mode = process.env.AGENT_MODE || "mock";
    if (!["mock", "voice"].includes(mode)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AGENT_MODE must be mock or voice." });
    if (mode === "voice") {
      try { voiceAccess(process.env); }
      catch (error) { throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Download your starter pack to configure voice access." }); }
    }
    const identity = `candidate-${randomUUID()}`;
    const roomName = `assignment-${randomUUID()}`;
    const rooms = new RoomServiceClient(wsURL.replace(/^ws/, "http"), key, secret);
    try {
      await rooms.createRoom({ name: roomName, emptyTimeout: 60, maxParticipants: 2, metadata: JSON.stringify({ candidateIdentity: identity, mode }) });
    } catch {
      throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Local LiveKit is unavailable. Start livekit-server --dev first." });
    }
    const token = new AccessToken(key, secret, { identity, ttl: "15m" });
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true });
    return { token: await token.toJwt(), wsURL, identity, roomName, mode: mode as "mock" | "voice" };
  }),
});
export type AppRouter = typeof appRouter;
