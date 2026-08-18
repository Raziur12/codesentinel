import type {
  ValidationRule
} from "../index.js";

export const npmRules: ValidationRule[] = [
  {
    id:
      "npm/EBADENGINE",

    appliesTo:
      context =>
        context.code === "EBADENGINE",

    evaluate:
      context => {
        const requiredNode =
          typeof context.metadata?.requiredNode === "string"
            ? context.metadata.requiredNode
            : undefined;

        return {
          suggestion:
            requiredNode
              ? `Upgrade Node.js to a supported version: ${requiredNode}.`
              : "Check the package engine requirements and use a compatible Node.js version.",
          documentation:
            "https://docs.npmjs.com/cli/using-npm/config#engine-strict",
          confidence:
            0.95
        };
      }
  }
];
