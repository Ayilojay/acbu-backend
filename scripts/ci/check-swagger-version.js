#!/usr/bin/env node
/**
 * CI check — Swagger spec version drift (#292)
 *
 * Asserts that the OpenAPI spec version in swagger.json (if present) matches
 * the API_VERSION env var (or the default "v1").  Exits non-zero on mismatch
 * so the CI pipeline fails before a stale spec ships.
 *
 * Usage:
 *   node scripts/ci/check-swagger-version.js [path/to/swagger.json]
 *
 * The script is intentionally dependency-free so it runs in any Node env
 * without an install step.
 */

const fs = require("fs");
const path = require("path");

const specPath = process.argv[2] || path.join(__dirname, "../../swagger.json");

if (!fs.existsSync(specPath)) {
  console.log(
    `[swagger-version] No swagger.json found at ${specPath} — skipping drift check.`,
  );
  process.exit(0);
}

let spec;
try {
  spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
} catch (err) {
  console.error(`[swagger-version] Failed to parse ${specPath}: ${err.message}`);
  process.exit(1);
}

const specVersion = spec?.info?.version;
if (!specVersion) {
  console.error("[swagger-version] spec.info.version is missing — cannot verify.");
  process.exit(1);
}

// The API version from env (strip leading 'v' for semver comparison).
const apiVersion = (process.env.API_VERSION || "v1").replace(/^v/, "");

// Accept either an exact match or a semver that starts with the major version.
const specMajor = specVersion.split(".")[0];
if (specMajor !== apiVersion && specVersion !== apiVersion) {
  console.error(
    `[swagger-version] DRIFT DETECTED: swagger.json reports version "${specVersion}" ` +
      `but API_VERSION is "${apiVersion}". Update swagger.json or bump API_VERSION.`,
  );
  process.exit(1);
}

console.log(
  `[swagger-version] OK — swagger.json version "${specVersion}" matches API_VERSION "${apiVersion}".`,
);
process.exit(0);
