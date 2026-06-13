import { parse as parseYaml } from "yaml";
import { z } from "zod";

export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyError";
  }
}

const globList = z
  .array(z.string().min(1, "glob must be a non-empty string"))
  .default([]);

const agentsSchema = z
  .object({
    accounts: globList,
    branches: globList,
    trailers: globList,
  })
  .strict()
  .prefault({});

export const policySchema = z
  .object({
    version: z.literal(1, {
      error: "only version: 1 is supported",
    }),
    mode: z.enum(["observe", "enforce"]).default("observe"),
    authors: z.object({ agents: agentsSchema }).strict().prefault({}),
    tiers: z
      .object({
        tier0: globList,
        tier2: globList,
      })
      .strict()
      .prefault({}),
    rules: z
      .object({
        "agent-on-tier2": z.enum(["block", "warn"]).default("block"),
        "human-on-tier2": z.enum(["warn", "require-review"]).default("warn"),
      })
      .strict()
      .prefault({}),
  })
  .strict();

export type Policy = z.infer<typeof policySchema>;

export function parsePolicy(yamlText: string): Policy {
  let doc: unknown;
  try {
    doc = parseYaml(yamlText);
  } catch (e) {
    throw new PolicyError(
      `interlock.yml is not valid YAML: ${(e as Error).message}`
    );
  }
  if (doc === null || doc === undefined) {
    throw new PolicyError("interlock.yml is empty");
  }
  const result = policySchema.safeParse(doc);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`
    );
    throw new PolicyError(`interlock.yml is invalid:\n${lines.join("\n")}`);
  }
  return result.data;
}
