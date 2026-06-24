import { describe, it, expect } from "vitest";
import { decodeYjsState } from "./persistNote";

describe("decodeYjsState", () => {
  it("returns null for empty input", () => {
    expect(decodeYjsState(null)).toBeNull();
    expect(decodeYjsState(undefined)).toBeNull();
    expect(decodeYjsState("")).toBeNull();
  });

  it("passes Uint8Array through unchanged", () => {
    const u8 = new Uint8Array([1, 2, 3]);
    expect(decodeYjsState(u8)).toBe(u8);
  });

  it('decodes Postgres bytea "\\x" hex strings', () => {
    const out = decodeYjsState("\\x000aff");
    expect(out).toEqual(new Uint8Array([0x00, 0x0a, 0xff]));
  });

  it("returns null for malformed hex (odd length)", () => {
    expect(decodeYjsState("\\xabc")).toBeNull();
  });

  it("returns null for non-hex characters", () => {
    expect(decodeYjsState("\\xzzzz")).toBeNull();
  });

  it("decodes base64 fallback", () => {
    // "AAEC" === bytes [0,1,2]
    expect(decodeYjsState("AAEC")).toEqual(new Uint8Array([0, 1, 2]));
  });
});