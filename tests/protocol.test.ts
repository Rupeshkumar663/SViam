import test from "node:test";
import assert from "node:assert/strict";
import { snapshotSchema, snapshotContext, mockReply, turnSchema } from "../src/lib/protocol";

const snapshot = { documentId: "d466e5da-fcfb-47dc-8c08-17f64d68683b", revision: 3, language: "typescript", code: "const value = 1;", capturedAt: 1000 };
test("RPC boundary rejects invalid versions and oversized UTF-8 snapshots", () => {
  assert.equal(snapshotSchema.safeParse({ ...snapshot, revision: -1 }).success, false);
  assert.equal(snapshotSchema.safeParse({ ...snapshot, code: "😀".repeat(3900) }).success, false);
  assert.equal(snapshotSchema.safeParse({ ...snapshot, language: "shell" }).success, false);
  assert.equal(snapshotSchema.safeParse(snapshot).success, true);
});
test("a captured turn remains independent of subsequent editor changes", () => {
  const captured = snapshotSchema.parse(snapshot);
  const edited = { ...snapshot, revision: 4, code: "const value = 2;" };
  assert.match(snapshotContext(captured), /const value = 1/);
  assert.doesNotMatch(snapshotContext(captured), /const value = 2/);
  assert.equal(edited.revision, 4);
  assert.match(mockReply("Explain this", captured), /revision 3/);
});
test("text turns require a stable ID and nonempty bounded text", () => {
  assert.equal(turnSchema.safeParse({ id: "invalid", text: "Hello" }).success, false);
  assert.equal(turnSchema.safeParse({ id: snapshot.documentId, text: "  " }).success, false);
  assert.equal(turnSchema.safeParse({ id: snapshot.documentId, text: "x".repeat(2001) }).success, false);
});
