#!/usr/bin/env node
// Validates the template's own integrity: settings.json parses, and every
// agent file has the frontmatter fields the orchestrator relies on.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REQUIRED_FIELDS = ["name", "description", "tools", "model"];
const VALID_MODELS = new Set(["sonnet", "opus", "haiku", "inherit"]);

let errors = [];

function checkSettings() {
  const settingsPath = path.join(ROOT, ".claude", "settings.json");
  const raw = fs.readFileSync(settingsPath, "utf8");
  try {
    JSON.parse(raw);
  } catch (e) {
    errors.push(`.claude/settings.json is not valid JSON: ${e.message}`);
  }
}

function parseFrontmatter(content, file) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    errors.push(`${file}: missing --- frontmatter block`);
    return null;
  }
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

function checkAgents() {
  const agentsDir = path.join(ROOT, ".claude", "agents");
  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    errors.push(".claude/agents/ has no agent definitions");
  }
  for (const file of files) {
    const content = fs.readFileSync(path.join(agentsDir, file), "utf8");
    const fields = parseFrontmatter(content, `agents/${file}`);
    if (!fields) continue;

    for (const key of REQUIRED_FIELDS) {
      if (!fields[key]) {
        errors.push(`agents/${file}: missing required frontmatter field "${key}"`);
      }
    }
    const expectedName = path.basename(file, ".md");
    if (fields.name && fields.name !== expectedName) {
      errors.push(
        `agents/${file}: frontmatter name "${fields.name}" doesn't match filename "${expectedName}"`
      );
    }
    if (fields.model && !VALID_MODELS.has(fields.model)) {
      errors.push(`agents/${file}: unknown model "${fields.model}"`);
    }
  }
}

checkSettings();
checkAgents();

if (errors.length > 0) {
  console.error("Template validation failed:\n");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log("Template validation passed.");
