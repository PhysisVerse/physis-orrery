import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";

import type { PhysisEligibilityRegistry } from "../../packages/idl-types/physis_eligibility_registry.ts";

export function getEligibilityProgram(): Program<PhysisEligibilityRegistry> {
  return anchor.workspace
    .PhysisEligibilityRegistry as Program<PhysisEligibilityRegistry>;
}
