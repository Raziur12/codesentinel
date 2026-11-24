# CodeSentinel

> **AI-Powered Software Validation & Pre-Production Certification Platform**

![Version](https://img.shields.io/badge/version-v0.0.1--alpha-blue)
![Status](https://img.shields.io/badge/status-Active%20Development-orange)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🎯 Purpose of This Project

Modern software applications rarely consist of isolated scripts—they span distributed architectures, multiple repositories (frontend, backend, microservices, infra), various runtimes, and complex dependency graphs. 

Existing developer tools operate in silos:
- **Linters** check single-file syntax and styling.
- **Unit test runners** execute narrow, isolated tests.
- **Security scanners** check for known CVEs.
- **AI coding assistants** generate code, but do not verify whether the entire project actually links, builds, runs, or deploys cleanly.

**CodeSentinel exists to fill this gap.** It acts as an **automated senior engineer and pre-production gatekeeper**. Instead of inspecting individual files in isolation, CodeSentinel analyzes the complete software architecture, executes real build and test validation pipelines, captures compiler and runtime failures, performs AI-driven root-cause analysis, and provides concrete fix suggestions with a production readiness score before code is deployed.

---

## ⚡ How CodeSentinel Works

CodeSentinel processes projects through an automated 5-stage pipeline:

```
[ Local Workspace / ZIP Upload / Git Repositories ]
                         │
                         ▼
  1. Structure & Technology Discovery
     • Auto-detects frameworks (React, Next.js, Node.js, Express, etc.)
     • Identifies package managers (npm, pnpm, yarn, bun)
     • Discovers build tools, TypeScript configurations, and databases
                         │
                         ▼
  2. Automated Validation Execution
     • Discovers and runs project-specific build, lint, test, and type-check commands
     • Safely skips unavailable scripts without breaking pipelines
     • Captures compiler errors, runtime crashes, and engine warnings (e.g., EBADENGINE)
                         │
                         ▼
  3. Finding Normalization & Deduplication
     • Normalizes errors across tools into unified Finding records
     • Extracts exact file locations (file path, line number, column)
     • Deduplicates identical errors across multi-step cascades
                         │
                         ▼
  4. AI Root-Cause Analysis & Fix Generation
     • Traces error chains to determine true root causes
     • Generates actionable code fix suggestions with confidence scores
     • Supports both deterministic local analysis and Anthropic-backed AI
                         │
                         ▼
  5. Production Readiness Scoring & Reporting
     • Computes an overall Project Health & Production Readiness Score
     • Exports machine-readable JSON reports and human-readable summaries
     • Serves findings via REST API and interactive web dashboard
```

---

## 🚀 Quick Start

### 1. Build Packages
```bash
npm run scanner:build
```

### 2. Run the Scanner CLI
Scan any target project folder or built-in fixture:
```bash
# Scan a project
npm run scanner -- /path/to/target-project

# Output machine-readable JSON
npm run scanner -- /path/to/target-project --json
```

### 3. Start the API Server
Starts the REST backend on port `4317` (connects to MongoDB configured in `.env`):
```bash
npm run api
```

Verify the API:
```bash
curl http://localhost:4317/
```

### 4. Start the Dashboard
Starts the web UI on port `4318`:
```bash
npm run dashboard
```
Open **[http://localhost:4318](http://localhost:4318)** in your browser.

---

## 🏗️ Architecture & Workspace Structure

```text
codesentinel/
├── apps/
│   ├── scanner/      # CLI application entry point
│   ├── api/          # REST API server (port 4317)
│   └── dashboard/    # Web UI server (port 4318)
├── packages/
│   ├── scanner-core/          # Shared data models, contracts, and utilities
│   ├── project-analyzer/      # Project directory discovery and tree traversal
│   ├── technology-detectors/  # Framework, runtime, and package manager detectors
│   ├── validation-engine/     # Command discovery, execution, error parsing & fix suggestions
│   └── database/              # MongoDB persistence layer for projects and scans
└── tests/
    └── scanner/fixtures/      # Real-world project fixtures for validation testing
```


---

## 📚 Documentation

For detailed design specifications, architectural records, and roadmaps, explore:
- [`/docs`](file:///d:/SelfDocs/All_Projects/codesentinel/docs) — Architecture, API, database, and scanner specifications.
- [`CodeSentinel_A_to_Z_Project_Roadmap.md`](file:///d:/SelfDocs/All_Projects/codesentinel/CodeSentinel_A_to_Z_Project_Roadmap.md) — Implementation roadmap and feature tracker.
