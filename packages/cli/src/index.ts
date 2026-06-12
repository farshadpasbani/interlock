#!/usr/bin/env node
import { Command } from "commander";
import { runCheck } from "./commands/check.js";
import { runInit } from "./commands/init.js";
import { runExplain } from "./commands/explain.js";

const program = new Command();

program
  .name("agent-interlock")
  .description(
    "Tool-neutral governance gate for AI-agent pull requests."
  )
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold interlock.yml and print the workflow to paste")
  .option("--force", "overwrite an existing interlock.yml", false)
  .action((opts: { force: boolean }) => {
    process.exitCode = runInit(
      { cwd: process.cwd(), force: opts.force },
      { log: console.log, error: console.error }
    );
  });

program
  .command("check")
  .description("Classify the current branch's diff against the policy")
  .option("--base <ref>", "base ref to diff against", "main")
  .option("--json", "machine-readable output", false)
  .action((opts: { base: string; json: boolean }) => {
    process.exitCode = runCheck({ base: opts.base, json: opts.json });
  });

program
  .command("explain")
  .description("Show which rule catches a path and the tier it lands in")
  .argument("<path>", "repo-relative path to explain")
  .action((path: string) => {
    process.exitCode = runExplain(path);
  });

program.parse();
