import type {
  ValidationRule
} from "../index.js";

function isTypeScriptCode(
  code: string | undefined
): boolean {
  return Boolean(
    code?.startsWith("TS")
  );
}

export const typescriptRules: ValidationRule[] = [
  {
    id:
      "typescript/TS2322",

    appliesTo:
      context =>
        context.code === "TS2322",

    evaluate:
      () => ({
        suggestion:
          "Check the value type and variable type. Make sure the assigned value matches the expected TypeScript type.",
        documentation:
          "https://www.typescriptlang.org/tsconfig#TS2322",
        confidence:
          0.95
      })
  },
  {
    id:
      "typescript/TS2339",

    appliesTo:
      context =>
        context.code === "TS2339",

    evaluate:
      () => ({
        suggestion:
          "Check whether the property or method exists on the current type. Verify the object type and property name.",
        documentation:
          "https://www.typescriptlang.org/tsconfig#TS2339",
        confidence:
          0.95
      })
  },
  {
    id:
      "typescript/TS2304",

    appliesTo:
      context =>
        context.code === "TS2304",

    evaluate:
      () => ({
        suggestion:
          "Check whether the referenced name is declared, imported, or spelled correctly.",
        documentation:
          "https://www.typescriptlang.org/tsconfig#TS2304",
        confidence:
          0.9
      })
  },
  {
    id:
      "typescript/default",

    appliesTo:
      context =>
        isTypeScriptCode(
          context.code
        ),

    evaluate:
      context => ({
        suggestion:
          "Review the TypeScript error and update the code so the types and declarations match.",
        documentation:
          context.code
            ? `https://www.typescriptlang.org/tsconfig#${context.code}`
            : undefined,
        confidence:
          0.75
      })
  }
];
