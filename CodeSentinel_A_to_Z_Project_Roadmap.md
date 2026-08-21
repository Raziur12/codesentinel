# CodeSentinel — A-to-Z Project Build Roadmap

> **Project:** CodeSentinel – AI Powered Software Validation Platform  
> **Current version:** 0.0.1  
> **Repository:** `codesentinel`  
> **Current branch:** `main`  
> **Primary stack:** TypeScript + Node.js ecosystem + npm workspaces  
> **Goal:** Build a production-grade software validation/scanning platform that can inspect a real project, understand its technology stack and structure, run validation commands, normalize/deduplicate findings, provide actionable fixes, and eventually add AI-powered analysis/reporting.

---

# 1. PRODUCT VISION

CodeSentinel should become an **AI-powered software validation platform**, not merely an `npm build/test` wrapper.

A user should be able to run something like:

```bash
codesentinel ./my-project
```

and receive a structured result containing:

- Project structure
- Languages
- Runtime
- Frameworks
- Databases
- Build tools
- Package managers
- Infrastructure
- Validation status
- Build failures
- Test failures
- Lint failures
- Type-check failures
- Dependency/engine warnings
- Deduplicated findings
- Severity
- File/line/column
- Error codes
- Explanation
- Suggested fixes
- Eventually AI-generated root-cause analysis
- Eventually machine-readable JSON + human-readable reports

The system must be useful for both:
1. **Developers** debugging their projects.
2. **Teams/CI pipelines** validating projects automatically.

---

# 2. ARCHITECTURE DIRECTION

Use a modular monorepo:

```text
CodeSentinel
│
├── apps/
│   └── scanner/
│       └── CLI/application entry point
│
├── packages/
│   ├── scanner-core/
│   │   └── shared scanner models/utilities
│   │
│   ├── project-analyzer/
│   │   └── project structure discovery
│   │
│   ├── technology-detectors/
│   │   └── technology/framework/database detection
│   │
│   └── validation-engine/
│       └── command execution + finding extraction
│
├── tests/
│   └── scanner/
│       └── realistic scanner fixtures
│
├── docs/
│   └── architecture/product/API/database/etc.
│
└── README.md
```

Keep responsibilities separated. Do not put all scanner logic into `apps/scanner`.

---

# 3. CURRENT REPOSITORY STATE

Current Git state is clean and synchronized:

```text
main = origin/main
working tree clean
```

Latest commits:

```text
01c9c7a fix TypeScript workspace configuration
8e8a22a feat: improve validation engine and add validation fixtures
5b9c437 feat(validation): add suggestions for validation findings and enhance command reporting
```

Important: do not lose the existing working scanner/validation functionality while extending it.

---

# 4. ALREADY COMPLETED

## 4.1 Monorepo

npm workspaces are already configured:

```json
"workspaces": [
  "apps/*",
  "packages/*"
]
```

Packages currently include:

- `@codesentinel/scanner`
- `@codesentinel/project-analyzer`
- `@codesentinel/scanner-core`
- `@codesentinel/technology-detectors`
- `@codesentinel/validation-engine`

---

# 5. SCANNER APP — COMPLETED

Current scripts:

```json
{
  "dev": "tsx src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "validation-test": "tsx src/validation-test.ts"
}
```

Root commands include:

```bash
npm run scanner
npm run scanner:build
npm run scanner:start
npm run test
```

The scanner currently accepts a project path:

```bash
npm run scanner -- ./path/to/project
```

It resolves the project path and executes the validation pipeline.

---

# 6. PROJECT ANALYZER — COMPLETED

`packages/project-analyzer` already performs recursive project discovery.

It:

- Walks project directories.
- Ignores:
  - `node_modules`
  - `.git`
  - `dist`
  - `build`
  - `.next`
  - `.codesentinel`
  - `coverage`
- Collects files.
- Collects directories.
- Detects frontend/backend/test structure.
- Detects configuration files.
- Detects package/dependency files.
- Detects infrastructure-related files.

Current structure model:

```text
ProjectStructure
├── rootFiles
├── directories
├── frontend
├── backend
├── tests
├── configuration
├── packageFiles
└── infrastructure
```

---

# 7. TECHNOLOGY DETECTION — COMPLETED

Technology detection currently identifies examples such as:

### Languages
- TypeScript
- JavaScript

### Runtime
- Node.js ecosystem

### Frameworks
- React
- Express
- Material UI

### Database
- MongoDB

### Build tools
- Vite

Detection uses evidence such as:

```text
.ts/.tsx source files
.js/.jsx source files
typescript dependency
react dependency
express dependency
mongoose dependency
@mui/material dependency
vite dependency
package.json
```

Confidence values are already being returned.

---

# 8. TECHNOLOGY PROFILE — COMPLETED

The scanner now produces a normalized technology profile:

```text
languages
runtimes
frameworks
databases
buildTools
packageManagers
infrastructure
unknown
```

This is an important foundation for future technology-specific validators.

---

# 9. VALIDATION ENGINE — COMPLETED

The scanner currently runs:

```text
npm install
npm run build
npm test
npm run lint
npx tsc --noEmit -p tsconfig.json
```

The result tracks:

```text
passed
total
passedCount
failedCount
skippedCount
```

Current validation count:

```text
total = 5
```

---

# 10. FINDING EXTRACTION — COMPLETED

The validation engine already converts failures into structured findings.

Example:

```text
Severity: high
Category: build
Finding: TypeScript error
Message: Type 'number' is not assignable to type 'string'.
File: app.ts
Line: 1
Column: 7
Code: TS2322
Suggested Fix: Check the value type and variable type...
```

This is a major milestone.

---

# 11. ERROR SUGGESTIONS — COMPLETED

Known TypeScript errors already produce useful suggestions.

Examples:

### TS2322

```text
Check the value type and variable type.
Make sure the assigned value matches the expected TypeScript type.
```

### TS2339

```text
Check whether the property or method exists on the current type.
Verify the object type and property name.
```

This suggestion system should later become a dedicated extensible rule engine.

---

# 12. DEDUPLICATION — COMPLETED

The scanner already generates deterministic finding keys.

Example:

```text
TS2322|app.ts|1|7|Type 'number' is not assignable to type 'string'.
```

It then deduplicates repeated findings.

Example observed:

```text
Deduplication: 6 → 3
```

This is correct and must be preserved.

---

# 13. ENGINE WARNING DETECTION — COMPLETED

The scanner detects npm `EBADENGINE`.

Example:

```text
Package engine requirement does not match the current Node.js environment.

Package: vite@7.3.6
Required Node.js: ^20.19.0 || >=22.12.0
Current Node.js: v18.20.8
```

It also provides:

```text
Suggested Fix:
Upgrade Node.js to a supported version...
```

The finding is deduplicated:

```text
Deduplication: 1 → 1
```

---

# 14. FIXTURE TESTS — COMPLETED

## 14.1 Broken project

Fixture:

```text
tests/scanner/fixtures/broken-project
```

It intentionally contains TypeScript errors.

Observed:

```text
Build = failed
Test = passed
Lint = passed
Type Check = failed
```

Final result:

```text
passed = false
total = 5
passedCount = 3
failedCount = 2
skippedCount = 0
```

Three unique TypeScript findings are detected:

```text
TS2322
TS2322
TS2339
```

This fixture proves that real validation failures are being detected.

---

# 15. ENGINE WARNING FIXTURE — COMPLETED

Fixture:

```text
tests/scanner/fixtures/engine-warning-project
```

It intentionally requires:

```text
Node >=99.0.0
```

Current environment is:

```text
Node v18.20.8
```

The scanner detects the engine warning but validation remains:

```text
passed = true
```

This establishes an important distinction:

> Warning != validation failure.

Do not change this behavior without a deliberate severity/policy design.

---

# 16. REACT + NODE + MONGODB FIXTURE — COMPLETED

Fixture:

```text
tests/scanner/fixtures/react-node-mongo
```

Dependencies include:

```text
React
React DOM
Express
Mongoose
Material UI
Vite
TypeScript
```

Scanner correctly detects:

```text
TypeScript
JavaScript
Node.js ecosystem
React
Express
MongoDB
Material UI
Vite
```

It also detects the Vite Node engine warning.

Validation result:

```text
passed = true
total = 5
passedCount = 5
failedCount = 0
```

This proves technology detection and validation can work together.

---

# 17. IMPORTANT ISSUE DISCOVERED: SCANNING THE CODE SENTINEL REPO ITSELF-COMPLETED

Command:

```bash
npm run scanner -- .
```

currently produces failures because CodeSentinel's root package does not expose generic root-level:

```text
build
test
lint
```

and the root does not contain:

```text
tsconfig.json
```

The scanner reports:

```text
Build failed
Test failed
Lint failed
Type Check failed
```

This is NOT automatically a scanner bug.

The scanner currently assumes:

```text
npm run build
npm test
npm run lint
npx tsc --noEmit -p tsconfig.json
```

exist at the target project root.

That assumption must now be redesigned.

## Resolution Status

Status: Completed for the current milestone on 2026-08-16.

Implemented:

- Validation command discovery now reads root `package.json`.
- Missing root `build` script is skipped instead of failed.
- Missing root `lint` script is skipped instead of failed.
- Missing root `tsconfig.json` is skipped instead of failed.
- Workspace fan-out scripts are checked before execution.
- Root `test` is skipped when it only delegates to workspaces that do not expose `test`.
- `npm run scanner -- .` now completes with zero validation failures.

Verified result:

```json
{
  "passed": true,
  "total": 5,
  "passedCount": 1,
  "failedCount": 0,
  "skippedCount": 4
}
```

---

# 18. NEXT CRITICAL FEATURE: VALIDATION COMMAND DISCOVERY

Do NOT blindly run fixed commands.

Create a command discovery layer.

Concept:

```text
ValidationCommandDiscovery
│
├── detect package.json
├── inspect scripts
├── inspect workspace configuration
├── detect tsconfig
├── detect framework/tool
├── determine available validators
└── return executable validation plan
```

Example:

If target project has:

```json
"scripts": {
  "build": "...",
  "test": "...",
  "lint": "..."
}
```

then run those.

If `build` is missing:

```text
build = skipped
reason = "No build script found"
```

If `tsconfig.json` is missing:

```text
typeCheck = skipped
reason = "No tsconfig.json found"
```

Do NOT classify unavailable commands as failures.

---

# 19. VALIDATION PLAN MODEL

Introduce something similar to:

```text
ValidationPlan
├── install
├── build
├── test
├── lint
├── typeCheck
└── custom checks
```

Each item should contain:

```text
name
command
executable
available
skipReason
priority
category
```

Example:

```json
{
  "name": "build",
  "command": "npm run build",
  "available": false,
  "skipReason": "No build script found"
}
```

---

# 20. VALIDATION RESULT MODEL

Separate:

```text
PASS
FAIL
SKIPPED
WARNING
```

Do not treat missing scripts as failures.

Recommended structure:

```text
ValidationResult
├── status
├── category
├── command
├── duration
├── stdout
├── stderr
├── findings
└── skipReason
```

---

# 21. ROOT PROJECT / MONOREPO SUPPORT-COMPLETED

CodeSentinel itself is an npm monorepo.

Therefore CodeSentinel must understand:

```json
"workspaces": [
  "apps/*",
  "packages/*"
]
```

Future scanner behavior:

```text
Root project
│
├── workspace discovery
│
├── apps/scanner
├── packages/project-analyzer
├── packages/scanner-core
├── packages/technology-detectors
└── packages/validation-engine
```

It should be possible to scan:

```bash
codesentinel .
```

without incorrectly treating missing root scripts as failures.

Eventually support:

```bash
codesentinel . --workspace apps/scanner
```

or equivalent.

---

# 22. PACKAGE MANAGER DETECTION-COMPLETED

Current technology profile has:

```text
packageManagers: []
```

Implement package-manager detection.

Detect:

```text
npm
yarn
pnpm
bun
```

using lockfiles/packageManager metadata:

```text
package-lock.json -> npm
yarn.lock -> yarn
pnpm-lock.yaml -> pnpm
bun.lock / bun.lockb -> bun
packageManager field -> declared manager
```

Use the detected manager for validation commands.

---

# 23. TYPESCRIPT DETECTION-COMPLETED

Improve TypeScript validation.

Detect:

```text
tsconfig.json
tsconfig.*.json
typescript dependency
.ts files
.tsx files
```

Type check only when appropriate.

Support:

```bash
tsc --noEmit -p <detected-config>
```

Potentially support multiple tsconfig files later.

---

# 24. BUILD SYSTEM DETECTION-COMPLETED

Build validation should become technology-aware.

Examples:

### Vite

Look for:

```text
vite.config.ts
vite.config.js
vite dependency
```

### Next.js

Look for:

```text
next.config.*
next dependency
```

### Angular

Look for:

```text
angular.json
@angular/core
```

### Generic Node

Use:

```text
package.json scripts.build
```

Never assume one build mechanism for every project.

---

# 25. TEST FRAMEWORK DETECTION-COMPLETED

Add detection for:

```text
Jest
Vitest
Mocha
Cypress
Playwright
Jasmine
```

Evidence can come from:

- package dependencies
- scripts
- config files

Example:

```text
vitest.config.ts
jest.config.js
playwright.config.ts
```

Then select appropriate validation behavior.

---

# 26. LINT DETECTION

Detect:

```text
ESLint
Biome
Prettier
Stylelint
```

Do not run `npm run lint` unless it exists.

Later support direct tool invocation where appropriate.

---

# 27. FINDING DOMAIN-COMPLATED

Create a stable common finding model.

Recommended fields:

```text
id
key
severity
category
code
title
message
file
line
column
source
command
suggestion
documentation
confidence
metadata
```

Possible severity:

```text
critical
high
medium
low
info
```

Possible category:

```text
build
test
lint
type-check
dependency
engine
security
architecture
technology
configuration
```

---

# 28. RULE ENGINE-COMPLETED

Move hardcoded suggestions into a rule system.

Example:

```text
TS2322 -> type mismatch suggestion
TS2339 -> property missing suggestion
EBADENGINE -> Node version suggestion
```

Future architecture:

```text
rules/
├── typescript/
├── npm/
├── react/
├── node/
├── mongodb/
└── security/
```

Each rule should be independently testable.

---

# 29. CONFIGURATION FILE-COMPLETED

Introduce:

```text
.codesentinel/
```

or:

```text
.codesentinel.json
```

Possible configuration:

```json
{
  "validation": {
    "build": true,
    "test": true,
    "lint": true,
    "typeCheck": true
  },
  "severity": {},
  "ignore": [],
  "include": [],
  "exclude": []
}
```

Do not make configuration overly complicated initially.

---

# 30. IGNORE SUPPORT--CoOMPLETED

Support ignoring findings:

```text
.codesentinelignore
```

Example:

```text
node_modules
dist
coverage
generated
```

Eventually allow rule-level suppression:

```text
TS2322
EBADENGINE
```

---

# 31. JSON OUTPUT-COMPLETED

Add CLI output modes:

```bash
codesentinel ./project
codesentinel ./project --format json
codesentinel ./project --format text
```

JSON should be machine-readable and stable.

Recommended top-level schema:

```text
scan
├── metadata
├── project
├── technologyProfile
├── validation
├── findings
└── summary
```

---

# 32. EXIT CODES-COMPLETED

CLI must provide useful process exit codes.

Suggested:

```text
0 = validation passed
1 = validation failed
2 = scanner/configuration error
3 = invalid input
```

Warnings should not automatically produce failure unless policy says so.

---

# 33. REPORTING-COMPLETED

Create report generation.

Initial:

```text
ConsoleReporter
JsonReporter
```

Later:

```text
MarkdownReporter
HtmlReporter
SarifReporter
```

SARIF is especially important for GitHub/code scanning integration.

---

# 34. CI/CD SUPPORT-COMPLETED

Eventually support:

```text
GitHub Actions
GitLab CI
Azure DevOps
Jenkins
```

First target:

```text
GitHub Actions
```

Example:

```yaml
- run: npx codesentinel .
```

CI output should clearly identify:

```text
Passed
Failed
Warnings
Skipped
```

---

# 35. SECURITY VALIDATION-COMPLETED

After core validation is stable, add:

```text
npm audit
dependency vulnerabilities
outdated packages
dangerous package versions
secret detection
```

Potential categories:

```text
security
dependency
secret
```

Do not mix security findings with ordinary build failures.

---

# 36. DEPENDENCY ANALYSIS

Add:

```text
direct dependencies
dev dependencies
peer dependencies
optional dependencies
dependency tree
outdated dependencies
engine requirements
```

Eventually identify:

```text
dependency conflicts
peer dependency conflicts
incompatible Node versions
```

---

# 37. PROJECT HEALTH SCORE-Completed

After enough validators exist, introduce a health score.

Example:

```text
CodeSentinel Health Score: 82/100
```

Possible factors:

```text
build
tests
type safety
lint
dependencies
security
configuration
architecture
```

Do not create a meaningless score early. Build reliable raw findings first.

---

# 38. AI LAYER — IMPORTANT LONG-TERM GOAL-COMPLETED

CodeSentinel's differentiator should be AI-powered analysis.

AI should NOT replace deterministic validation.

Correct architecture:

```text
Deterministic Scanner
        ↓
Structured Findings
        ↓
AI Analysis
        ↓
Root Cause
        ↓
Impact
        ↓
Recommended Fix
        ↓
Optional Patch
```

AI input should be structured rather than raw terminal output wherever possible.

---

# 39. AI ROOT-CAUSE ANALYSIS-COMPLETED

For a finding:

```text
TS2322
app.ts:1:7
Type number is not assignable to string
```

AI should explain:

```text
Root cause
Why it happened
What code caused it
How to fix it
Potential side effects
```

Avoid hallucinated fixes.

AI should explicitly distinguish:

```text
confirmed
inferred
uncertain
```

---

# 40. AI FIX GENERATION-COMPLETED

Later allow:

```bash
codesentinel ./project --fix
```

But initially make it suggestion-only.

Then:

```text
--fix
--dry-run
--interactive
```

Any automatic code modification should:

1. Show affected files.
2. Show diff.
3. Require explicit confirmation.
4. Run validation again.
5. Roll back if validation becomes worse.

---

# 41. AI PROVIDER ABSTRACTION-COMPLETED

Do not tightly couple the scanner to one AI provider.

Create:

```text
AIProvider
├── analyzeFindings()
├── explainFinding()
├── suggestFix()
└── generatePatch()
```

Possible providers later:

```text
OpenAI
Anthropic
Google
local model
```

The core scanner should work without AI.

---

# 42. API / SERVER LAYER — FUTURE-COMPLETED

After CLI becomes stable, add an API.

Possible architecture:

```text
apps/
├── scanner/
└── api/
```

API responsibilities:

```text
POST /scans
GET /scans/:id
GET /scans/:id/findings
GET /scans/:id/report
```

Later add:

```text
authentication
projects
teams
scan history
webhooks
CI integrations
```

---

# 43. DATABASE — FUTURE---COMPLETED

Only introduce a database when scan history/product functionality requires it.

Potential entities:

```text
User
Project
Scan
Finding
ValidationRun
TechnologyProfile
AIAnalysis
Fix
```

Do not add database complexity to the scanner core unnecessarily.

---

# 44. DASHBOARD — FUTURE--COMPLETED

Eventually:

```text
apps/
├── scanner
├── api
└── dashboard
```

Dashboard should show:

```text
Projects
Scans
Health score
Validation status
Technology stack
Findings
Severity distribution
Trends
AI explanations
Fix suggestions
```

Possible frontend stack can be decided later; keep core scanner independent.

---

# 45. TESTING STRATEGY-COMPLETED

Current fixtures are a good start.

Keep and expand:

```text
tests/
├── scanner/
│   ├── fixtures/
│   │   ├── broken-project
│   │   ├── engine-warning-project
│   │   ├── react-node-mongo
│   │   ├── ...
│   └── integration tests
```

Add fixtures for:

```text
missing-build-script
missing-test-script
missing-lint-script
missing-tsconfig
npm-project
pnpm-project
yarn-project
bun-project
vite-project
next-project
react-project
node-express-project
typescript-only-project
monorepo-project
multiple-tsconfig-project
lint-failure-project
test-failure-project
dependency-conflict-project
```

---

# 46. TEST THE SCANNER ITSELF-COMPLETED

Do not only test target projects.

Test:

```text
project-analyzer
technology-detectors
validation-engine
finding parser
deduplication
command discovery
reporters
CLI
configuration
exit codes
```

Use unit + integration tests.

---

# 47. CURRENT BUG/IMPROVEMENT PRIORITY-COMPLETED

The immediate next task is:

## P0 — Fix validation command assumptions

Current problem:

```bash
npm run scanner -- .
```

treats missing root commands as failures.

Implement:

```text
command discovery
```

and:

```text
SKIPPED != FAILED
```

This should be completed before adding AI/dashboard/API.

---

# 48. NEXT DEVELOPMENT ORDER-COMPLETED

Follow this exact order.

## Phase 1 — Stabilize Core

1. Validation command discovery
2. Validation plan
3. PASS/FAIL/SKIPPED/WARNING states
4. Monorepo/workspace awareness
5. Package-manager detection
6. TypeScript config detection
7. Better command execution abstraction
8. Unit tests

---

## Phase 2 — Strong Scanner

9. Build-system detection
10. Test-framework detection
11. Lint detection
12. Dependency analysis
13. Engine/peer dependency analysis
14. Better finding normalization
15. Rule engine
16. `.codesentinel` configuration
17. `.codesentinelignore`

---

## Phase 3 — Professional CLI

18. `--format text`
19. `--format json`
20. `--format markdown`
21. `--format sarif`
22. Exit codes
23. Progress display
24. Quiet mode
25. Verbose/debug mode
26. Scan summary

---

## Phase 4 — Security

27. npm audit
28. vulnerability normalization
29. secret detection
30. dependency security rules
31. security report

---

## Phase 5 — AI

32. AI provider abstraction
33. Finding explanation
34. Root-cause analysis
35. Fix suggestions
36. Patch generation
37. Validation-after-fix
38. Safe `--fix`

---

## Phase 6 — Product

39. API
40. Authentication
41. Projects
42. Scan history
43. Database
44. Dashboard
45. CI/CD integration
46. Team features

---

# 49. CURRENT COMMAND CHECKLIST

These commands are already useful:

```bash
git status
git log --oneline -3

npm run scanner:build

npm run scanner -- ./tests/scanner/fixtures/broken-project

npm run scanner -- ./tests/scanner/fixtures/engine-warning-project

npm run scanner -- ./tests/scanner/fixtures/react-node-mongo
```

Do NOT use:

```bash
npm run scanner -- .
```

as a success criterion until command discovery/monorepo support is implemented.

---

# 50. DEFINITION OF DONE — CORE SCANNER-COMPLETED

Core scanner is considered ready when:

- [x] Any valid project path can be scanned.
- [x] Missing commands are SKIPPED, not FAILED.
- [x] Build/test/lint/type-check are discovered.
- [x] Package manager is detected.
- [x] TypeScript config is detected.
- [x] npm/yarn/pnpm/bun strategy is supported.
- [x] Monorepos are detected.
- [x] Workspace projects can be scanned.
- [x] Findings are normalized.
- [x] Findings are deduplicated.
- [x] Severity is consistent.
- [x] Suggestions are rule-driven.
- [x] JSON output is stable.
- [x] Exit codes are documented.
- [x] Scanner has automated tests.
- [x] Existing fixtures continue passing.

---

# 51. DEFINITION OF DONE — PRODUCT MVP-COMPLETED

MVP should provide:

- [x] CLI
- [x] Project Analyzer
- [x] Technology Detector
- [x] Validation Engine
- [x] Finding Engine
- [x] Rule Engine
- [x] Configuration
- [x] JSON/Console Reports
- [x] Security Checks
- [x] AI Explanation

A user should be able to point CodeSentinel at a real project and receive a useful engineering-quality report.

---

# 52. NON-NEGOTIABLE ENGINEERING PRINCIPLES

1. Do not break existing passing fixtures.
2. Do not hardcode one project's structure.
3. Do not treat missing optional tooling as a failure.
4. Do not couple AI to the scanner core.
5. Do not make database/API dependencies mandatory for CLI scanning.
6. Keep packages independently testable.
7. Prefer structured data over terminal-string parsing.
8. Preserve source location information.
9. Deduplicate deterministic findings.
10. Every new validator must have a fixture/test.
11. Keep CLI output human-readable.
12. Keep JSON output machine-readable.
13. Avoid premature complexity.
14. Build deterministic scanning first; AI second.
15. Every major feature must have documentation and tests.

---

# 53. CODEX EXECUTION INSTRUCTIONS

When using Codex to implement this roadmap:

### Before modifying code

Inspect:

```text
package.json
apps/scanner
packages/scanner-core
packages/project-analyzer
packages/technology-detectors
packages/validation-engine
tests/scanner
docs
```

Understand existing interfaces before replacing anything.

### For every feature

Follow:

```text
Inspect
→ Design
→ Implement
→ Build
→ Test
→ Run relevant fixture
→ Review diff
→ Commit
```

### Never blindly rewrite

Do not replace working modules wholesale unless necessary.

Prefer incremental changes.

---

# 54. FIRST CODEX TASK

Start with ONLY this milestone:

## "Implement validation command discovery and correct SKIPPED semantics."

Requirements:

### A. Inspect package.json

Discover:

```text
scripts
packageManager
workspaces
```

### B. Discover commands

For each validator:

```text
build
test
lint
typeCheck
```

determine whether it is available.

### C. Skip unavailable commands

Example:

```text
No build script found → SKIPPED
No test script found → SKIPPED
No lint script found → SKIPPED
No tsconfig → SKIPPED
```

### D. Preserve findings

Existing:

```text
TS2322
TS2339
EBADENGINE
```

behavior must continue working.

### E. Update validation summary

Example:

```json
{
  "total": 5,
  "passedCount": 1,
  "failedCount": 0,
  "skippedCount": 4
}
```

for a project where only install is available.

### F. Add tests

At minimum:

```text
missing-build-script
missing-test-script
missing-lint-script
missing-tsconfig
```

### G. Run

```bash
npm run scanner:build
npm run scanner -- ./tests/scanner/fixtures/broken-project
npm run scanner -- ./tests/scanner/fixtures/engine-warning-project
npm run scanner -- ./tests/scanner/fixtures/react-node-mongo
npm run scanner -- .
```

### H. Verify

Existing fixtures must retain their intended behavior.

---

# 55. AFTER FIRST CODEX TASK

Do not jump directly to AI.

Proceed:

```text
Command Discovery
        ↓
Monorepo Support
        ↓
Package Manager Detection
        ↓
Technology-Aware Validators
        ↓
Rule Engine
        ↓
Configuration
        ↓
Reports
        ↓
Security
        ↓
AI
        ↓
API
        ↓
Dashboard
```

This order minimizes rework.

---

# 56. FINAL TARGET ARCHITECTURE

```text
                    ┌───────────────────────┐
                    │     CodeSentinel CLI  │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │     Scan Orchestrator │
                    └───────────┬───────────┘
                                │
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
   │ Project Analyzer│ │ Tech Detector   │ │ Config Manager  │
   └────────┬────────┘ └────────┬────────┘ └─────────────────┘
            │                   │
            └──────────┬────────┘
                       ▼
             ┌─────────────────────┐
             │ Validation Planner  │
             └──────────┬──────────┘
                        ▼
             ┌─────────────────────┐
             │ Validation Engine   │
             └──────────┬──────────┘
                        ▼
             ┌─────────────────────┐
             │ Finding Normalizer  │
             └──────────┬──────────┘
                        ▼
             ┌─────────────────────┐
             │ Deduplication/Rules │
             └──────────┬──────────┘
                        ▼
             ┌─────────────────────┐
             │ Report Generator    │
             └──────────┬──────────┘
                        │
            ┌───────────┴────────────┐
            ▼                        ▼
      Console / JSON          SARIF / Markdown
            │
            ▼
      ┌──────────────┐
      │ AI Analysis  │
      └──────┬───────┘
             ▼
      Root Cause / Fix
             │
             ▼
      Optional Safe Patch
```

---

# 57. PROJECT STATUS SNAPSHOT

## Verified From Current Code

Checked on: 2026-08-16

This status is based on reading the current repository files, not on a fresh full test run.

## Done / Present

- [x] Monorepo
- [x] Scanner CLI
- [x] Project analyzer
- [x] Technology detection
- [x] Technology profile
- [x] Validation engine
- [x] npm install validation
- [x] Build validation
- [x] Test validation
- [x] Lint validation
- [x] Type-check validation
- [x] TypeScript error parsing
- [x] Finding location extraction
- [x] Severity
- [x] Suggestions
- [x] Finding keys
- [x] Deduplication
- [x] EBADENGINE detection
- [x] Broken-project fixture
- [x] Engine-warning fixture
- [x] React/Node/Mongo fixture
- [x] Validation summary counts passed/failed/skipped statuses from validation results
- [x] #17 self-scan issue fixed for `npm run scanner -- .`
- [x] Validation command discovery for package scripts
- [x] Correct SKIPPED semantics for missing build/test/lint/type-check commands
- [x] Workspace fan-out test script skip behavior
- [x] Missing-command fixtures added

## Partially Done / Needs Wiring

- [~] Technology profile has a packageManagers field
- [~] Root package has packageManager metadata
- [~] Root package has npm workspaces metadata
- [~] Path resolver can find the CodeSentinel workspace root
- [~] Monorepo/workspace awareness exists for root script fan-out, but full workspace selection is still pending

## Not Verified In This Pass

- [x] Scanner build succeeds
- [x] Existing fixtures still pass after a fresh run
- [ ] Git repository synchronized

Note: `CodeSentinel_A_to_Z_Project_Roadmap.md` is currently untracked, so the working tree is not fully synchronized.

## In Progress / Next

- [x] Validation command discovery
- [x] Correct SKIPPED semantics
- [ ] Monorepo/workspace awareness
- [ ] Package manager detection
- [ ] Better TypeScript config discovery
- [ ] Technology-aware validators
- [ ] Rule engine
- [ ] Configuration
- [ ] Ignore system
- [ ] Report formats
- [ ] Exit codes
- [ ] Security
- [ ] AI analysis
- [ ] API
- [ ] Dashboard

---

# 58. IMPORTANT FINAL NOTE

The current CodeSentinel implementation is **not wasted work**.

The difficult foundation is already working:

```text
Project
  ↓
Analyze
  ↓
Detect Technologies
  ↓
Run Validation
  ↓
Parse Errors
  ↓
Create Findings
  ↓
Suggest Fixes
  ↓
Deduplicate
  ↓
Produce Structured Result
```

The next step is to make the validation layer **project-aware instead of assuming every project has the same commands**.

That is the immediate engineering priority.

Once that is fixed, continue through this roadmap sequentially.
