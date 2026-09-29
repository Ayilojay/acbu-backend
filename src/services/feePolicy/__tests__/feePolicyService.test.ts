import { getSpreadBps } from "../feePolicyService";

describe("feePolicyService", () => {
  it("returns a positive spread basis points value", () => {
    expect(getSpreadBps()).toBeGreaterThan(0);
  });
});
