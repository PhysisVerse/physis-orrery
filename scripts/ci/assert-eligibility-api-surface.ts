import fs from "fs";
import path from "path";

type IdlInstruction = {
  name?: unknown;
};

type IdlDocument = {
  instructions?: unknown;
};

function requireCondition(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function toCamelCase(
  value: string,
): string {
  return value.replace(
    /_([a-z])/g,
    (_, letter: string) =>
      letter.toUpperCase(),
  );
}

function walkFiles(
  root: string,
): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries =
    fs.readdirSync(root, {
      withFileTypes: true,
    });

  return entries.flatMap((entry) => {
    const fullPath =
      path.join(root, entry.name);

    if (entry.isDirectory()) {
      return walkFiles(fullPath);
    }

    return entry.isFile()
      ? [fullPath]
      : [];
  });
}

const repositoryRoot =
  process.cwd();

const idlPath =
  path.join(
    repositoryRoot,
    "target",
    "idl",
    "physis_eligibility_registry.json",
  );

requireCondition(
  fs.existsSync(idlPath),
  [
    "Eligibility IDL is missing.",
    `Expected: ${idlPath}`,
    "Run anchor build before checking the API surface.",
  ].join("\n"),
);

const parsedIdl: unknown =
  JSON.parse(
    fs.readFileSync(
      idlPath,
      "utf8",
    ),
  );

requireCondition(
  typeof parsedIdl === "object" &&
    parsedIdl !== null &&
    !Array.isArray(parsedIdl),
  "Eligibility IDL must contain a JSON object",
);

const instructions =
  (parsedIdl as IdlDocument)
    .instructions;

requireCondition(
  Array.isArray(instructions),
  "Eligibility IDL instructions are missing",
);

const instructionNames =
  new Set(
    instructions.map((instruction) => {
      requireCondition(
        typeof instruction === "object" &&
          instruction !== null &&
          !Array.isArray(instruction),
        "Eligibility IDL contains an invalid instruction",
      );

      const name =
        (instruction as IdlInstruction)
          .name;

      requireCondition(
        typeof name === "string" &&
          name.length > 0,
        "Eligibility IDL contains an unnamed instruction",
      );

      return toCamelCase(name);
    }),
  );

for (
  const requiredInstruction of [
    "upsertEligibilityRecordByAuthority",
    "upsertEligibilityRecordByIssuer",
  ]
) {
  requireCondition(
    instructionNames.has(
      requiredInstruction,
    ),
    `Required eligibility instruction is missing: ${requiredInstruction}`,
  );
}

requireCondition(
  !instructionNames.has(
    "upsertEligibilityRecord",
  ),
  "Legacy upsertEligibilityRecord instruction remains in the IDL",
);

const legacyInstructionPath =
  path.join(
    repositoryRoot,
    "programs",
    "physis_eligibility_registry",
    "src",
    "instructions",
    "upsert_eligibility_record.rs",
  );

requireCondition(
  !fs.existsSync(
    legacyInstructionPath,
  ),
  `Legacy instruction source still exists: ${legacyInstructionPath}`,
);

const guardPath =
  path.resolve(
    repositoryRoot,
    "scripts",
    "ci",
    "assert-eligibility-api-surface.ts",
  );

const scanRoots = [
  path.join(
    repositoryRoot,
    "programs",
    "physis_eligibility_registry",
    "src",
  ),
  path.join(
    repositoryRoot,
    "scripts",
  ),
  path.join(
    repositoryRoot,
    "tests",
  ),
];

const forbiddenPatterns = [
  {
    label:
      "legacy TypeScript client call",
    pattern:
      /\.upsertEligibilityRecord\s*\(/,
  },
  {
    label:
      "legacy Rust entrypoint",
    pattern:
      /pub\s+fn\s+upsert_eligibility_record\s*\(/,
  },
  {
    label:
      "legacy Rust processor",
    pattern:
      /process_upsert_eligibility_record\s*\(/,
  },
  {
    label:
      "legacy Rust module export",
    pattern:
      /pub\s+(?:mod|use)\s+upsert_eligibility_record(?:;|::\*)/,
  },
];

const violations: string[] = [];

for (
  const filePath of scanRoots.flatMap(
    walkFiles,
  )
) {
  const resolved =
    path.resolve(filePath);

  if (resolved === guardPath) {
    continue;
  }

  const extension =
    path.extname(filePath);

  if (
    extension !== ".rs" &&
    extension !== ".ts"
  ) {
    continue;
  }

  const content =
    fs.readFileSync(
      filePath,
      "utf8",
    );

  for (
    const {
      label,
      pattern,
    } of forbiddenPatterns
  ) {
    const match =
      pattern.exec(content);

    if (!match) {
      continue;
    }

    const line =
      content
        .slice(0, match.index)
        .split("\n")
        .length;

    violations.push(
      `${path.relative(repositoryRoot, filePath)}:${line}: ${label}`,
    );
  }
}

requireCondition(
  violations.length === 0,
  [
    "Legacy eligibility record-write API references remain:",
    ...violations.map(
      (violation) =>
        `- ${violation}`,
    ),
  ].join("\n"),
);

console.log(
  "Eligibility API surface verified: authenticated root and delegated record writes only.",
);
