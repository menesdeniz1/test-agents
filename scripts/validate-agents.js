#!/usr/bin/env node
// Validates the template's own integrity: settings.json parses and uses real
// keys, and every agent file has the frontmatter and report contract the
// orchestrator relies on.
//
// This checks that the agent files are well-formed, not that they are good.
// Measuring quality is golden-task/'s job.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REQUIRED_FIELDS = ["name", "description", "tools", "model"];
const VALID_MODELS = new Set(["sonnet", "opus", "haiku", "inherit"]);
// Frontmatter keys that look plausible but are never read. In the Claude Code
// CLI binary the agent frontmatter object only ever carries `model` and
// `permissionMode`; skills parse an `effort` field, subagents do not.
const DEAD_FRONTMATTER = {
  effort: "not read for subagents; effort comes from the session (settings.effortLevel or /effort)",
};
// The four sections every worker must end with, per CLAUDE.md.
const REPORT_SECTIONS = ["Changed", "Verified", "Assumptions", "Open"];
// Settings keys that silently do nothing — easy to reintroduce from memory.
const DEAD_SETTINGS = {
  teammateDefaultModel: "not a real setting; worker models live in each agent file's `model:`",
  effort: 'not a settings.json key; the persisted one is "effortLevel"',
};
const VALID_EFFORT_LEVELS = new Set(["low", "medium", "high", "xhigh"]);

const errors = [];

// Windows editors happily write UTF-8 with a BOM, which would otherwise make
// JSON.parse throw and the `^---` frontmatter match fail.
function read(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^﻿/, "");
}

function checkSettings() {
  const settingsPath = path.join(ROOT, ".claude", "settings.json");
  let settings;
  try {
    settings = JSON.parse(read(settingsPath));
  } catch (e) {
    errors.push(`.claude/settings.json is not valid JSON: ${e.message}`);
    return;
  }

  for (const [key, why] of Object.entries(DEAD_SETTINGS)) {
    if (key in settings) {
      errors.push(`.claude/settings.json: "${key}" is ${why}`);
    }
  }

  const level = settings.effortLevel;
  if (level !== undefined && !VALID_EFFORT_LEVELS.has(level)) {
    errors.push(
      `.claude/settings.json: effortLevel "${level}" is not one of ${[...VALID_EFFORT_LEVELS].join(", ")}`
    );
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
    const label = `agents/${file}`;
    const content = read(path.join(agentsDir, file));
    const fields = parseFrontmatter(content, label);
    if (!fields) continue;

    for (const key of REQUIRED_FIELDS) {
      if (!fields[key]) {
        errors.push(`${label}: missing required frontmatter field "${key}"`);
      }
    }

    const expectedName = path.basename(file, ".md");
    if (fields.name && fields.name !== expectedName) {
      errors.push(
        `${label}: frontmatter name "${fields.name}" doesn't match filename "${expectedName}"`
      );
    }

    if (fields.model && !VALID_MODELS.has(fields.model)) {
      errors.push(`${label}: unknown model "${fields.model}"`);
    }

    for (const [key, why] of Object.entries(DEAD_FRONTMATTER)) {
      if (key in fields) {
        errors.push(`${label}: frontmatter "${key}" is ${why}`);
      }
    }

    for (const section of REPORT_SECTIONS) {
      if (!content.includes(`**${section}:**`)) {
        errors.push(
          `${label}: report contract broken — no "**${section}:**" section (see CLAUDE.md)`
        );
      }
    }
  }
}

// The two installers rewrite the same delimited block in a project's
// CLAUDE.md. If their markers drift apart they would each manage a separate
// block and a project installed on one OS could not be updated from the other.
function checkInstallerMarkersMatch() {
  const marker = /agent-template:begin[^'"\n]*/;
  const found = {};
  for (const file of ["install.ps1", "install.sh"]) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) {
      errors.push(`${file}: missing`);
      continue;
    }
    const m = read(filePath).match(marker);
    if (!m) {
      errors.push(`${file}: no agent-template:begin marker found`);
      continue;
    }
    found[file] = m[0];
  }
  const values = Object.values(found);
  if (values.length === 2 && values[0] !== values[1]) {
    errors.push(
      `install.ps1 and install.sh disagree on the managed-block marker:\n` +
        `      install.ps1: ${found["install.ps1"]}\n` +
        `      install.sh:  ${found["install.sh"]}`
    );
  }
}

checkSettings();
checkAgents();
checkInstallerMarkersMatch();

if (errors.length > 0) {
  console.error("Template validation failed:\n");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log("Template validation passed.");
