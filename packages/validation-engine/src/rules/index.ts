export interface ValidationRuleContext {
  category: string;

  code?: string;

  message: string;

  metadata?: Record<string, unknown>;
}

export interface ValidationRuleResult {
  ruleId: string;

  suggestion: string;

  documentation?: string;

  confidence?: number;

  metadata?: Record<string, unknown>;
}

export interface ValidationRule {
  id: string;

  appliesTo: (
    context: ValidationRuleContext
  ) => boolean;

  evaluate: (
    context: ValidationRuleContext
  ) => Omit<ValidationRuleResult, "ruleId">;
}

import {
  npmRules
} from "./npm/index.js";

import {
  typescriptRules
} from "./typescript/index.js";

export const validationRules: ValidationRule[] = [
  ...typescriptRules,
  ...npmRules
];

export function evaluateValidationRules(
  context: ValidationRuleContext
): ValidationRuleResult | undefined {
  const rule =
    validationRules.find(
      candidate =>
        candidate.appliesTo(
          context
        )
    );

  if (
    !rule
  ) {
    return undefined;
  }

  return {
    ruleId:
      rule.id,
    ...rule.evaluate(
      context
    )
  };
}
