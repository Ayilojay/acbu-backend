import {
  assertIfMatchHeaderPresent,
  formatWalletEtag,
  parseIfMatchHeader,
} from "./walletConcurrency";

describe("walletConcurrency", () => {
  it("formats wallet ETags as quoted version strings", () => {
    expect(formatWalletEtag(7)).toBe('"7"');
  });

  it("parses strong and weak If-Match headers", () => {
    expect(parseIfMatchHeader('"12"')).toBe(12);
    expect(parseIfMatchHeader('W/"3"')).toBe(3);
  });

  it("rejects missing or invalid If-Match headers", () => {
    expect(() => assertIfMatchHeaderPresent(undefined)).toThrow(
      expect.objectContaining({ statusCode: 428 }),
    );
    expect(() => assertIfMatchHeaderPresent("not-an-etag")).toThrow(
      expect.objectContaining({ statusCode: 428 }),
    );
  });
});
