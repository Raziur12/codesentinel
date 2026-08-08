import fs from "node:fs/promises";
import path from "node:path";

import type {
  DetectionResult,
  ScanContext,
  ScannerPlugin
} from "@codesentinel/scanner-core";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
}

async function readPackageJson(
  projectPath: string,
  files: string[]
): Promise<PackageJson | null> {
  const packageFile = files.find(
    (file) => file === "package.json"
  );

  if (!packageFile) {
    return null;
  }

  try {
    const content = await fs.readFile(
      path.join(projectPath, packageFile),
      "utf8"
    );

    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

function getDependencies(
  packageJson: PackageJson
): Set<string> {
  return new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {})
  ]);
}

function hasDependency(
  dependencies: Set<string>,
  names: string[]
): boolean {
  return names.some((name) =>
    dependencies.has(name)
  );
}

function detectLanguages(
  context: ScanContext
): DetectionResult[] {
  const results: DetectionResult[] = [];

  const extensions = new Set(
    context.files
      .filter((file) => file.includes("."))
      .map((file) =>
        file.substring(file.lastIndexOf(".")).toLowerCase()
      )
  );

  if (
    extensions.has(".ts") ||
    extensions.has(".tsx")
  ) {
    results.push({
      technology: "TypeScript",
      category: "language",
      confidence: 0.99,
      evidence: [
        ".ts/.tsx source files detected"
      ]
    });
  }

  if (
    extensions.has(".js") ||
    extensions.has(".jsx")
  ) {
    results.push({
      technology: "JavaScript",
      category: "language",
      confidence: 0.99,
      evidence: [
        ".js/.jsx source files detected"
      ]
    });
  }

  if (
    extensions.has(".py")
  ) {
    results.push({
      technology: "Python",
      category: "language",
      confidence: 0.99,
      evidence: [
        ".py source files detected"
      ]
    });
  }

  if (
    extensions.has(".java")
  ) {
    results.push({
      technology: "Java",
      category: "language",
      confidence: 0.99,
      evidence: [
        ".java source files detected"
      ]
    });
  }

  if (
    extensions.has(".cs")
  ) {
    results.push({
      technology: "C#",
      category: "language",
      confidence: 0.99,
      evidence: [
        ".cs source files detected"
      ]
    });
  }

  if (
    extensions.has(".go")
  ) {
    results.push({
      technology: "Go",
      category: "language",
      confidence: 0.99,
      evidence: [
        ".go source files detected"
      ]
    });
  }

  if (
    extensions.has(".rs")
  ) {
    results.push({
      technology: "Rust",
      category: "language",
      confidence: 0.99,
      evidence: [
        ".rs source files detected"
      ]
    });
  }

  if (
    extensions.has(".php")
  ) {
    results.push({
      technology: "PHP",
      category: "language",
      confidence: 0.99,
      evidence: [
        ".php source files detected"
      ]
    });
  }

  return results;
}

function detectInfrastructure(
  context: ScanContext
): DetectionResult[] {
  const results: DetectionResult[] = [];

  const files = new Set(context.files);

  if (files.has("Dockerfile")) {
    results.push({
      technology: "Docker",
      category: "infrastructure",
      confidence: 0.99,
      evidence: ["Dockerfile detected"]
    });
  }

  if (
    context.files.some((file) =>
      file.includes(".github/workflows/")
    )
  ) {
    results.push({
      technology: "GitHub Actions",
      category: "infrastructure",
      confidence: 0.98,
      evidence: [
        ".github/workflows directory detected"
      ]
    });
  }

  if (
    context.files.some((file) =>
      file.endsWith(".tf")
    )
  ) {
    results.push({
      technology: "Terraform",
      category: "infrastructure",
      confidence: 0.99,
      evidence: [
        ".tf Terraform files detected"
      ]
    });
  }

  if (
    context.files.some((file) =>
      file.includes("kubernetes") ||
      file.includes("k8s")
    )
  ) {
    results.push({
      technology: "Kubernetes",
      category: "infrastructure",
      confidence: 0.8,
      evidence: [
        "Kubernetes-related path detected"
      ]
    });
  }

  return results;
}

export const universalTechnologyPlugin: ScannerPlugin = {
  id: "universal-technology-detector",

  name: "Universal Technology Detector",

  async detect(
    context: ScanContext
  ): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    results.push(
      ...detectLanguages(context)
    );

    const packageJson =
      await readPackageJson(
        context.projectPath,
        context.files
      );

    if (packageJson) {
      const dependencies =
        getDependencies(packageJson);

      results.push({
        technology: "Node.js ecosystem",
        category: "runtime",
        confidence: 0.9,
        evidence: [
          "package.json detected"
        ]
      });

      if (
        hasDependency(
          dependencies,
          ["react", "react-dom"]
        )
      ) {
        results.push({
          technology: "React",
          category: "framework",
          confidence: 0.99,
          evidence: [
            "react dependency detected"
          ]
        });
      }

      if (
        hasDependency(
          dependencies,
          ["@angular/core"]
        )
      ) {
        results.push({
          technology: "Angular",
          category: "framework",
          confidence: 0.99,
          evidence: [
            "@angular/core dependency detected"
          ]
        });
      }

      if (
        hasDependency(
          dependencies,
          ["vue"]
        )
      ) {
        results.push({
          technology: "Vue",
          category: "framework",
          confidence: 0.99,
          evidence: [
            "vue dependency detected"
          ]
        });
      }

      if (
        hasDependency(
          dependencies,
          ["next"]
        )
      ) {
        results.push({
          technology: "Next.js",
          category: "framework",
          confidence: 0.99,
          evidence: [
            "next dependency detected"
          ]
        });
      }

      if (
        hasDependency(
          dependencies,
          ["express"]
        )
      ) {
        results.push({
          technology: "Express",
          category: "framework",
          confidence: 0.99,
          evidence: [
            "express dependency detected"
          ]
        });
      }

      if (
        hasDependency(
          dependencies,
          ["@nestjs/core"]
        )
      ) {
        results.push({
          technology: "NestJS",
          category: "framework",
          confidence: 0.99,
          evidence: [
            "@nestjs/core dependency detected"
          ]
        });
      }

      if (
        hasDependency(
          dependencies,
          ["mongoose"]
        )
      ) {
        results.push({
          technology: "MongoDB",
          category: "database",
          confidence: 0.95,
          evidence: [
            "mongoose dependency detected"
          ]
        });
      }

      if (
        hasDependency(
          dependencies,
          ["mysql", "mysql2"]
        )
      ) {
        results.push({
          technology: "MySQL",
          category: "database",
          confidence: 0.95,
          evidence: [
            "mysql/mysql2 dependency detected"
          ]
        });
      }

      if (
        hasDependency(
          dependencies,
          ["pg"]
        )
      ) {
        results.push({
          technology: "PostgreSQL",
          category: "database",
          confidence: 0.95,
          evidence: [
            "pg dependency detected"
          ]
        });
      }

      if (
        hasDependency(
          dependencies,
          ["redis", "ioredis"]
        )
      ) {
        results.push({
          technology: "Redis",
          category: "database",
          confidence: 0.95,
          evidence: [
            "Redis client dependency detected"
          ]
        });
      }

      if (
        hasDependency(
          dependencies,
          ["@mui/material"]
        )
      ) {
        results.push({
          technology: "Material UI",
          category: "framework",
          confidence: 0.99,
          evidence: [
            "@mui/material dependency detected"
          ]
        });
      }

      if (
        hasDependency(
          dependencies,
          ["vite"]
        )
      ) {
        results.push({
          technology: "Vite",
          category: "build-tool",
          confidence: 0.99,
          evidence: [
            "vite dependency detected"
          ]
        });
      }

      if (
        hasDependency(
          dependencies,
          ["typescript"]
        )
      ) {
        results.push({
          technology: "TypeScript",
          category: "language",
          confidence: 0.99,
          evidence: [
            "typescript dependency detected"
          ]
        });
      }
    }

    results.push(
      ...detectInfrastructure(context)
    );

    return results;
  }
};