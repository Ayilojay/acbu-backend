import fs from "fs";
import path from "path";

describe("Express Async Errors Patching Integration", () => {
  it("should have imported express-async-errors in src/index.ts", () => {
    const indexPath = path.resolve(__dirname, "../src/index.ts");
    const content = fs.readFileSync(indexPath, "utf8");
    expect(content).toContain('import "express-async-errors";');
  });
});
