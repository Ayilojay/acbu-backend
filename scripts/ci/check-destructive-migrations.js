'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_LABEL = 'allow-destructive-migration';
const SCHEMA_PATH = 'prisma/schema.prisma';
const MIGRATIONS_ROOT = 'prisma/migrations/';
const MAX_STATEMENT_LENGTH = 220;
const DESTRUCTIVE_PATTERNS = [
  { kind: 'DROP TABLE', regex: /\bDROP\s+TABLE\b/i },
  { kind: 'DROP COLUMN', regex: /\bDROP\s+COLUMN\b/i },
  { kind: 'TRUNCATE', regex: /\bTRUNCATE(?:\s+TABLE)?\b/i },
];

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function getChangedMigrationFiles(changedFiles) {
  return changedFiles
    .map(normalizePath)
    .filter((filePath) => filePath.startsWith(MIGRATIONS_ROOT) && filePath.endsWith('.sql'));
}

function splitSqlStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => (statement.endsWith(';') ? statement : `${statement};`));
}

function truncateStatement(statement) {
  const compact = statement.replace(/\s+/g, ' ').trim();
  if (compact.length <= MAX_STATEMENT_LENGTH) {
    return compact;
  }

  return `${compact.slice(0, MAX_STATEMENT_LENGTH - 3)}...`;
}

function findDestructiveStatements(sql) {
  const findings = [];

  for (const statement of splitSqlStatements(sql)) {
    for (const pattern of DESTRUCTIVE_PATTERNS) {
      if (pattern.regex.test(statement)) {
        findings.push({
          kind: pattern.kind,
          statement: truncateStatement(statement),
        });
        break;
      }
    }
  }

  return findings;
}

function runCommand(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function getGitOutput(args) {
  return runCommand('git', args).trim();
}

function getChangedFiles(baseSha) {
  const output = getGitOutput([
    'diff',
    '--name-only',
    `${baseSha}...HEAD`,
    '--',
    SCHEMA_PATH,
    'prisma/migrations',
  ]);

  if (!output) {
    return [];
  }

  return output.split(/\r?\n/).filter(Boolean).map(normalizePath);
}

function loadGitHubEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH is required for destructive migration checks.');
  }

  return JSON.parse(fs.readFileSync(eventPath, 'utf8'));
}

function getPullRequestContext() {
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
    return null;
  }

  const event = loadGitHubEvent();
  const pullRequest = event.pull_request;

  if (!pullRequest) {
    throw new Error('Expected pull_request payload for destructive migration checks.');
  }

  return {
    baseSha: pullRequest.base && pullRequest.base.sha,
    labels: Array.isArray(pullRequest.labels)
      ? pullRequest.labels.map((label) => label.name).filter(Boolean)
      : [],
  };
}

function writeBaseSchema(baseSha) {
  const schema = runCommand('git', ['show', `${baseSha}:${SCHEMA_PATH}`]);
  const tempSchemaPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'acbu-base-schema-')),
    'schema.prisma',
  );

  fs.writeFileSync(tempSchemaPath, schema);
  return tempSchemaPath;
}

function getPrismaExecutable() {
  const executableName = process.platform === 'win32' ? 'prisma.CMD' : 'prisma';
  return path.join(process.cwd(), 'node_modules', '.bin', executableName);
}

function runPrismaSchemaDiff(baseSchemaPath) {
  return runCommand(getPrismaExecutable(), [
    'migrate',
    'diff',
    '--from-schema-datamodel',
    baseSchemaPath,
    '--to-schema-datamodel',
    SCHEMA_PATH,
    '--script',
  ]);
}

function collectMigrationFileFindings(migrationFiles) {
  const findings = [];

  for (const migrationFile of migrationFiles) {
    if (!fs.existsSync(migrationFile)) {
      continue;
    }

    const fileContents = fs.readFileSync(migrationFile, 'utf8');
    const matches = findDestructiveStatements(fileContents);

    for (const match of matches) {
      findings.push({
        source: migrationFile,
        kind: match.kind,
        statement: match.statement,
      });
    }
  }

  return findings;
}

function collectSchemaDiffFindings(baseSha, changedFiles) {
  if (!changedFiles.includes(SCHEMA_PATH)) {
    return [];
  }

  const tempSchemaPath = writeBaseSchema(baseSha);

  try {
    return findDestructiveStatements(runPrismaSchemaDiff(tempSchemaPath)).map((match) => ({
      source: 'prisma migrate diff',
      kind: match.kind,
      statement: match.statement,
    }));
  } finally {
    fs.rmSync(path.dirname(tempSchemaPath), { recursive: true, force: true });
  }
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.source}|${finding.kind}|${finding.statement}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function formatFinding(finding) {
  return `- [${finding.source}] ${finding.kind}: ${finding.statement}`;
}

function main() {
  const context = getPullRequestContext();

  if (!context) {
    console.log('Skipping destructive migration gate outside pull requests.');
    return;
  }

  if (!context.baseSha) {
    throw new Error('Pull request base SHA is required for destructive migration checks.');
  }

  const changedFiles = getChangedFiles(context.baseSha);
  if (changedFiles.length === 0) {
    console.log('No Prisma schema or migration changes detected.');
    return;
  }

  const migrationFiles = getChangedMigrationFiles(changedFiles);
  const findings = dedupeFindings([
    ...collectMigrationFileFindings(migrationFiles),
    ...collectSchemaDiffFindings(context.baseSha, changedFiles),
  ]);

  if (findings.length === 0) {
    console.log('No destructive Prisma migration changes detected.');
    return;
  }

  const requiredLabel = process.env.DESTRUCTIVE_MIGRATION_LABEL || DEFAULT_LABEL;
  const labels = new Set(context.labels);

  console.error('Destructive Prisma migration changes detected:');
  for (const finding of findings) {
    console.error(formatFinding(finding));
  }

  if (!labels.has(requiredLabel)) {
    console.error(
      `Add the "${requiredLabel}" label to the pull request to acknowledge and allow destructive migration changes.`,
    );
    process.exit(1);
  }

  console.log(`"${requiredLabel}" label present; destructive migration changes acknowledged.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  findDestructiveStatements,
  getChangedMigrationFiles,
  normalizePath,
  splitSqlStatements,
};
