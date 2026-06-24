import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueueNoteUpdate,
  listOutbox,
  outboxSize,
  deleteOutboxEntry,
  flushOutbox,
  __resetOutboxForTests,
} from "./notesOutbox";

// Mock the supabase client used by flushOutbox.
const updateMock = vi.fn();
const eqMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: (payload: unknown) => {
        updateMock(payload);
        return { eq: (col: string, val: string) => eqMock(col, val) };
      },
    }),
  },
}));

beforeEach(async () => {
  // Wipe IndexedDB between tests.
  await new Promise<void>((res) => {
    const req = indexedDB.deleteDatabase("collab-notes-outbox");
    req.onsuccess = req.onerror = req.onblocked = () => res();
  });
  __resetOutboxForTests();
  updateMock.mockReset();
  eqMock.mockReset();
  eqMock.mockResolvedValue({ error: null });
});

describe("notesOutbox", () => {
  it("queues a single entry", async () => {
    await enqueueNoteUpdate("n1", { title: "Hello" });
    expect(await outboxSize()).toBe(1);
    const [entry] = await listOutbox();
    expect(entry.noteId).toBe("n1");
    expect(entry.payload).toEqual({ title: "Hello" });
    expect(typeof entry.queuedAt).toBe("number");
  });

  it("coalesces multiple updates to the same note", async () => {
    await enqueueNoteUpdate("n1", { title: "A" });
    await enqueueNoteUpdate("n1", { color: "red" });
    await enqueueNoteUpdate("n1", { title: "B" });
    expect(await outboxSize()).toBe(1);
    const [entry] = await listOutbox();
    expect(entry.payload).toEqual({ title: "B", color: "red" });
  });

  it("keeps separate notes separate", async () => {
    await enqueueNoteUpdate("n1", { title: "A" });
    await enqueueNoteUpdate("n2", { title: "B" });
    expect(await outboxSize()).toBe(2);
  });

  it("deletes by id", async () => {
    await enqueueNoteUpdate("n1", { title: "A" });
    await deleteOutboxEntry("n1");
    expect(await outboxSize()).toBe(0);
  });

  it("flushes successful writes and clears entries", async () => {
    await enqueueNoteUpdate("n1", { title: "Hello" });
    await enqueueNoteUpdate("n2", { title: "World" });
    const res = await flushOutbox();
    expect(res).toEqual({ ok: 2, failed: 0 });
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(await outboxSize()).toBe(0);
  });

  it("keeps entries when the server returns an error", async () => {
    await enqueueNoteUpdate("n1", { title: "Hello" });
    eqMock.mockResolvedValueOnce({ error: { message: "boom" } });
    const res = await flushOutbox();
    expect(res).toEqual({ ok: 0, failed: 1 });
    expect(await outboxSize()).toBe(1);
  });

  it("rejects empty noteId", async () => {
    await expect(enqueueNoteUpdate("", { title: "x" })).rejects.toThrow();
  });

  it("is safe to call flushOutbox concurrently", async () => {
    await enqueueNoteUpdate("n1", { title: "A" });
    const [a, b] = await Promise.all([flushOutbox(), flushOutbox()]);
    // Single in-flight flush is shared — both resolutions see the same result.
    expect(a).toEqual(b);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});