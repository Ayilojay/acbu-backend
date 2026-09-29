import internationalRoutes from "./internationalRoutes";
import mintRoutes from "./mintRoutes";
import burnRoutes from "./burnRoutes";

describe("internationalRoutes", () => {
  it("uses fresh mint and burn routers instead of reusing top-level router instances", () => {
    const stack = (internationalRoutes as any).stack as Array<unknown>;
    expect(Array.isArray(stack)).toBe(true);

    const nestedRouterHandles = stack
      .filter((layer) => typeof (layer as any).handle === "function")
      .map((layer) => (layer as any).handle);

    expect(nestedRouterHandles).not.toContain(mintRoutes);
    expect(nestedRouterHandles).not.toContain(burnRoutes);
  });
});
