import fs from "fs";
import path from "path";

describe("src/index dotenv bootstrap order", () => {
  it("loads env config before any other imports", () => {
    const indexPath = path.resolve(__dirname, "../src/index.ts");
    const source = fs.readFileSync(indexPath, "utf8");
    const firstMeaningfulLine = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("//"));

    expect(firstMeaningfulLine).toBe('import "./config/env";');
  });
});
