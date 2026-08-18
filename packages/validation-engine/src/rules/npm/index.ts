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
  },
  {
    id:
      "npm/audit-vulnerability",

    appliesTo:
      context =>
        context.code === "NPM_AUDIT_VULNERABILITY",

    evaluate:
      context => {
        const packageName =
          typeof context.metadata?.packageName === "string"
            ? context.metadata.packageName
            : "the vulnerable package";

        const fixAvailable =
          context.metadata?.fixAvailable === true;

        return {
          suggestion:
            fixAvailable
              ? `Run npm audit fix, then review and test the ${packageName} dependency update.`
              : `Upgrade, patch, or replace ${packageName}; npm audit did not report an automatic safe fix.`,
          documentation:
            "https://docs.npmjs.com/cli/commands/npm-audit",
          confidence:
            0.95
        };
      }
  }
];
