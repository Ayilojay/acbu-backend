import { encodeCursor, decodeCursor } from "./pagination";
import { AppError } from "./errorHandler";

describe("pagination cursors (#405)", () => {
  const scope = "user-123";
  const id = "row-abc";

  it("round-trips an id for the same scope", () => {
    const cursor = encodeCursor(id, scope);
    expect(cursor).not.toContain(id); // raw id is not exposed verbatim
    expect(decodeCursor(cursor, scope)).toBe(id);
  });

  it("returns null for an undefined cursor (first page)", () => {
    expect(decodeCursor(undefined, scope)).toBeNull();
  });

  it("rejects a cursor minted for a different scope (IDOR defence)", () => {
    const cursor = encodeCursor(id, scope);
    expect(() => decodeCursor(cursor, "user-999")).toThrow(AppError);
  });

  it("rejects a tampered cursor body", () => {
    const cursor = encodeCursor(id, scope);
    const [, signature] = cursor.split(".");
    const forgedBody = Buffer.from(`${scope}:row-other`).toString("base64url");
    expect(() => decodeCursor(`${forgedBody}.${signature}`, scope)).toThrow(AppError);
  });

  it("rejects a cursor with a forged signature", () => {
    const body = Buffer.from(`${scope}:${id}`).toString("base64url");
    expect(() => decodeCursor(`${body}.deadbeefdeadbeef`, scope)).toThrow(AppError);
  });

  it("rejects a malformed cursor without a signature separator", () => {
    expect(() => decodeCursor("not-a-valid-cursor", scope)).toThrow(AppError);
  });

  it("preserves ids that contain colons", () => {
    const colonId = "type:transfer:42";
    const cursor = encodeCursor(colonId, scope);
    expect(decodeCursor(cursor, scope)).toBe(colonId);
  });
});
