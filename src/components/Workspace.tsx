"use client";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, ParticipantKind, Track, type Participant } from "livekit-client";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/server/router";
import { EVENT_TOPIC, SNAPSHOT_RPC, TURN_RPC, QUESTION, STARTER_CODE, eventSchema, snapshotSchema, type EditorSnapshot, type AgentEvent } from "@/lib/protocol";
import Editor from "./Editor";

const api = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: "/api/trpc" })] });

export default function Workspace() {
  const roomRef = useRef<Room | null>(null);
  const audioHost = useRef<HTMLDivElement>(null);
  const documentRef = useRef({ documentId: "", revision: 0, code: STARTER_CODE });
  const generation = useRef(0);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("Disconnected");
  const [busy, setBusy] = useState(false);
  const [agentIdentity, setAgentIdentity] = useState("");
  const [mode, setMode] = useState<"mock" | "voice" | null>(null);
  const [mic, setMic] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [snapshot, setSnapshot] = useState<EditorSnapshot | null>(null);

  const [activeHighlight, setActiveHighlight] = useState<{ startLine: number; endLine: number } | null>(null);
  const [controlledCode, setControlledCode] = useState<string | null>(null);

  useEffect(() => () => { generation.current++; void roomRef.current?.disconnect(); }, []);

  function receive(event: AgentEvent) {
    if (event.kind === "context") {
      setSnapshot(event.snapshot);
    } else if (event.kind === "highlight") {
      setActiveHighlight({ startLine: event.startLine, endLine: event.endLine });
    } else if (event.kind === "code_edit") {
      documentRef.current = {
        ...documentRef.current,
        code: event.newCode,
        revision: documentRef.current.revision + 1,
      };
      setRevision(documentRef.current.revision);
      setControlledCode(event.newCode);
    } else if (event.kind === "run_result") {
      const runTranscript: AgentEvent = {
        kind: "transcript",
        id: event.id,
        role: "agent",
        text: `[Execution ${event.success ? "Success" : "Error"}]\n${event.output}`,
      };
      setEvents(previous => [...previous.filter(item => item.id !== event.id), runTranscript].slice(-100));
    } else {
      setEvents(previous => [...previous.filter(item => item.id !== event.id), event].slice(-100));
    }
  }

  async function connect() {
    if (roomRef.current || busy) return;
    const current = ++generation.current;
    setBusy(true); setError(""); setStatus("Connecting"); setSnapshot(null); setEvents([]);
    const room = new Room();
    roomRef.current = room;
    const active = () => generation.current === current && roomRef.current === room;
    try {
      const connection = await api.join.mutate();
      if (!active()) { await room.disconnect(); return; }
      setMode(connection.mode);
      room.localParticipant.registerRpcMethod(SNAPSHOT_RPC, async data => {
        const caller = room.remoteParticipants.get(data.callerIdentity);
        if (!active() || caller?.kind !== ParticipantKind.AGENT) throw new Error("Only this room's agent can request editor context.");
        documentRef.current.documentId ||= crypto.randomUUID();
        return JSON.stringify(snapshotSchema.parse({ ...documentRef.current, language: "typescript", capturedAt: Date.now() }));
      });
      room.registerTextStreamHandler(EVENT_TOPIC, async (reader, participant) => {
        const sender = room.remoteParticipants.get(participant.identity);
        if (sender?.kind !== ParticipantKind.AGENT) return;
        try { const event = eventSchema.parse(JSON.parse(await reader.readAll())); if (active()) receive(event); }
        catch { if (active()) setError("Received an invalid agent event."); }
      });
      const findAgent = (participant: Participant) => {
        if (active() && participant.kind === ParticipantKind.AGENT) {
          const ready = participant.attributes["assignment.ready"] === "true";
          setAgentIdentity(ready ? participant.identity : "");
          setStatus(ready ? "Connected" : "Agent starting");
        }
      };
      room.on(RoomEvent.ParticipantConnected, findAgent);
      room.on(RoomEvent.ParticipantAttributesChanged, (_changed, participant) => findAgent(participant));
      room.on(RoomEvent.ParticipantDisconnected, participant => { if (active() && participant.kind === ParticipantKind.AGENT) { setAgentIdentity(""); setStatus("Agent disconnected"); } });
      room.on(RoomEvent.Reconnecting, () => { if (active()) setStatus("Reconnecting"); });
      room.on(RoomEvent.Reconnected, () => { if (active()) { setStatus("Connected"); room.remoteParticipants.forEach(findAgent); } });
      room.on(RoomEvent.Disconnected, () => { if (active()) { roomRef.current = null; setStatus("Disconnected"); setAgentIdentity(""); setMic(false); setBusy(false); } });
      room.on(RoomEvent.TrackSubscribed, track => {
        if (active() && track.kind === Track.Kind.Audio) audioHost.current?.appendChild(track.attach());
      });
      room.on(RoomEvent.TrackUnsubscribed, track => track.detach().forEach(element => element.remove()));
      await room.connect(connection.wsURL, connection.token);
      if (!active()) { await room.disconnect(); return; }
      await room.startAudio();
      setStatus("Waiting for agent");
      room.remoteParticipants.forEach(findAgent);
    } catch (e) {
      if (active()) { setError(e instanceof Error ? e.message : "Connection failed"); setStatus("Disconnected"); roomRef.current = null; }
      await room.disconnect();
    } finally { if (generation.current === current) setBusy(false); }
  }

  async function disconnect() {
    generation.current++;
    const room = roomRef.current; roomRef.current = null;
    setAgentIdentity(""); setStatus("Disconnected"); setMic(false); setBusy(false); setSending(false);
    await room?.disconnect();
    audioHost.current?.replaceChildren();
  }

  async function send() {
    const room = roomRef.current;
    if (!room || !agentIdentity || !text.trim() || sending) return;
    const turn = { id: crypto.randomUUID(), text: text.trim() };
    setSending(true); setError("");
    try {
      await room.localParticipant.performRpc({ destinationIdentity: agentIdentity, method: TURN_RPC, payload: JSON.stringify(turn), responseTimeout: 10_000 });
      if (roomRef.current === room) setText("");
    } catch (e) { if (roomRef.current === room) setError(e instanceof Error ? e.message : "Turn failed. Retry after the agent reconnects."); }
    finally { if (roomRef.current === room) setSending(false); }
  }

  async function toggleMic() {
    try { await roomRef.current?.localParticipant.setMicrophoneEnabled(!mic); setMic(!mic); }
    catch { setError("Microphone access failed. Check browser permissions."); }
  }

  return (
    <main>
      <header>
        <a className="brand" href="/">sv<span>i</span>am<span className="brand-dot">.</span></a>
        <span className="eyebrow">ENGINEERING TAKE-HOME</span>
        <span className="local">● LOCAL WORKSPACE</span>
      </header>
      <section className="intro">
        <div>
          <p className="eyebrow">01 / THE STARTER</p>
          <h1>Make the conversation<br /><em>interactive.</em></h1>
          <p className="description">This take-home starter has a voice agent that can read your code. Build the three actions below.</p>
        </div>
        <div className="requirements">
          <span>YOUR THREE FEATURES</span>
          <p>01 <strong>Highlight while speaking</strong></p>
          <p>02 <strong>Edit code directly</strong></p>
          <p>03 <strong>Run and explain</strong></p>
        </div>
      </section>
      <section className="problem">
        <span className="eyebrow">SAMPLE PROBLEM</span>
        <p>{QUESTION}</p>
      </section>
      <div className="workspace">
        <section className="panel">
          <div className="panel-head">
            <strong>solution.ts</strong>
            <span>TypeScript · revision {revision}</span>
          </div>
          <Editor
            initialCode={STARTER_CODE}
            code={controlledCode}
            highlight={activeHighlight}
            onChange={code => {
              documentRef.current = { ...documentRef.current, code, revision: documentRef.current.revision + 1 };
              setRevision(documentRef.current.revision);
            }}
          />
          <div className="panel-foot">Interactive AI editor with speech-aligned highlights, direct code manipulation, and sandbox execution.</div>
        </section>
        <section className="panel conversation">
          <div className="panel-head">
            <strong>Agent conversation</strong>
            <span role="status">{status}</span>
          </div>
          <div className="controls">
            <button disabled={busy || !!roomRef.current} onClick={() => void connect()}>
              {busy ? "Connecting…" : "Connect agent"}
            </button>
            <button className="secondary" disabled={!roomRef.current && !busy} onClick={() => void disconnect()}>
              Disconnect
            </button>
            {mode === "voice" && (
              <button className="secondary" disabled={!agentIdentity} onClick={() => void toggleMic()}>
                {mic ? "Mute microphone" : "Enable microphone"}
              </button>
            )}
          </div>
          <p className="mode">
            {mode === "voice" ? "Live voice · provider credentials required" : "Mock mode checks text + editor transport without paid API calls."}
          </p>
          <div className="messages" aria-live="polite">
            {events.length === 0 && (
              <div className="empty">
                <span>↗</span>
                <h2>Start with a question.</h2>
                <p>Connect the local agent, then ask about your code. Each turn requests a fresh editor snapshot.</p>
              </div>
            )}
            {events.map(event => {
              if (event.kind === "transcript") {
                return (
                  <article className={`message ${event.role}`} key={event.id}>
                    <label>{event.role === "user" ? "You" : "Agent"}</label>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{event.text}</pre>
                  </article>
                );
              }
              if (event.kind === "error") {
                return (
                  <article className="message failure" key={event.id}>
                    <label>Connection issue</label>
                    <p>{event.text}</p>
                  </article>
                );
              }
              return null;
            })}
          </div>
          <form className="composer" onSubmit={e => { e.preventDefault(); void send(); }}>
            <input aria-label="Message the agent" placeholder="Ask about your code…" value={text} maxLength={2000} onChange={e => setText(e.target.value)} />
            <button disabled={!agentIdentity || !text.trim() || sending}>{sending ? "Sending…" : "Send ↗"}</button>
          </form>
          {error && <p className="error" role="alert">{error}</p>}
        </section>
      </div>
      <details className="context">
        <summary>Editor context used by the agent {snapshot ? `· revision ${snapshot.revision}${snapshot.revision !== revision ? " · editor has changed since capture" : ""}` : "· no turn yet"}</summary>
        {snapshot && (
          <>
            <p>Captured {new Date(snapshot.capturedAt).toLocaleTimeString()}. This copy belongs to that turn.</p>
            <pre>{snapshot.code}</pre>
          </>
        )}
      </details>
      <footer>Build locally. Explain your decisions. Submit a PR in your private assignment repository.</footer>
      <div ref={audioHost} />
    </main>
  );
}