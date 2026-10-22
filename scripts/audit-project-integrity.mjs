#!/usr/bin/env node
/**
 * Repository hygiene audit for local development, GitHub Desktop, and Vercel.
 * This is deliberately read-only: it never installs packages or mutates a database.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warnings = [];
const passed = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const walk = (dir, result = []) => {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return result;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", ".vercel", "coverage", "out", "dist"].includes(entry.name)) continue;
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(relative, result);
    else result.push(relative);
  }
  return result;
};
const check = (condition, label, detail = "") => {
  if (condition) passed.push(label);
  else errors.push(`${label}${detail ? ` — ${detail}` : ""}`);
};
const warn = (label, detail = "") => warnings.push(`${label}${detail ? ` — ${detail}` : ""}`);

let pkg, lock, vercel;
try {
  pkg = JSON.parse(read("package.json"));
  lock = JSON.parse(read("package-lock.json"));
  vercel = JSON.parse(read("vercel.json"));
} catch (error) {
  console.error(`ERROR: invalid project JSON: ${error.message}`);
  process.exit(1);
}

// Version and deployment command alignment.
check(pkg.version === lock.version && pkg.version === lock.packages?.[""]?.version,
  "package.json and package-lock.json root versions agree",
  `${pkg.version} / ${lock.version} / ${lock.packages?.[""]?.version}`);
check(pkg.version === (read("lib/app-release.ts").match(/APP_RELEASE_VERSION\s*=\s*"([^"]+)"/) || [])[1],
  "application release marker matches package version");
check(read("lib/server/readiness.ts").includes("version: process.env.npm_package_version || APP_RELEASE_VERSION") && read("lib/server/readiness.ts").includes("import { APP_RELEASE_VERSION } from \"@/lib/app-release\""),
  "health/readiness response uses the current release version fallback");
check(vercel.framework === "nextjs", "Vercel framework is Next.js");
check(vercel.buildCommand === "npm run build", "Vercel build command uses the project build script");
check(vercel.installCommand === "npm ci --legacy-peer-deps", "Vercel uses a reproducible clean install");
check(pkg.scripts?.build && pkg.scripts?.typecheck && pkg.scripts?.lint && pkg.scripts?.["ci:verify"],
  "required build, typecheck, lint, and CI scripts exist");
check(pkg.scripts?.["vercel-build"] === "npm run build", "Vercel build alias matches canonical build command");
const nvmVersion = read(".nvmrc").trim();
const workflowSource = read(".github/workflows/ci.yml");
const lockRepairWorkflow = read(".github/workflows/repair-npm-lock.yml");
check(nvmVersion === "24.15.0" && pkg.engines?.node?.includes("24.15.0"), "local Node pin matches supported Node 24 minimum");
check(workflowSource.includes('node-version: "24.15.0"'), "CI Node runtime matches local Node pin");
check(pkg.scripts?.["check:pi-backend-lock"] === "node scripts/verify-pi-backend-lock.mjs" && exists("scripts/verify-pi-backend-lock.mjs"), "official Pi SDK lock verifier has an npm entry point");
check(lockRepairWorkflow.includes("workflow_dispatch:") && lockRepairWorkflow.includes("npm install --package-lock-only --legacy-peer-deps") && lockRepairWorkflow.includes("npm ci --legacy-peer-deps") && lockRepairWorkflow.includes("npm run ci:verify"), "manual lock-repair workflow regenerates, clean-installs, and verifies the project");
check(lockRepairWorkflow.includes("add-paths: package-lock.json") && lockRepairWorkflow.includes("pull-requests: write"), "lock-repair automation proposes only the lockfile in a reviewable PR");

// Keep security-header policy in one place. Next config still owns route-specific
// validation-key headers and immutable Next static asset caching.
const nextConfig = read("next.config.mjs");
const vercelText = read("vercel.json");
check(!nextConfig.includes("Content-Security-Policy"), "CSP has a single deployment-wide owner");
check(vercelText.includes("Content-Security-Policy") && vercelText.includes("frame-ancestors"),
  "Vercel CSP retains Pi Browser iframe allow-list");
check(!nextConfig.includes('source: "/(.*)"'), "Next config does not duplicate global Vercel headers");
const deployGuide = read("VERCEL_DEPLOY.txt");
check(deployGuide.includes("NEXT_PUBLIC_PI_SANDBOX=true") && deployGuide.includes("NEXT_PUBLIC_PI_SANDBOX=false"),
  "deployment guide explicitly separates Pi Testnet and Mainnet modes");
check(deployGuide.includes("Preview / Testnet") && deployGuide.includes("Production / Mainnet"),
  "deployment guide names Preview/Testnet and Production/Mainnet environments");

// Ensure every local source import resolves. This catches missing/renamed files
// without needing node_modules or the full Next build environment.
const files = walk("");
const sourceFiles = files.filter((file) => /\.(?:[cm]?js|jsx|ts|tsx|mjs|cjs)$/.test(file));
const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".woff", ".woff2"];
const candidatesFor = (base) => extensions.map((ext) => `${base}${ext}`).concat(
  ["index.ts", "index.tsx", "index.js", "index.jsx", "index.mjs"].map((name) => path.join(base, name))
);
const missingImports = [];
const importPattern = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["']([^"']+)["']/g;
for (const file of sourceFiles) {
  const source = read(file);
  importPattern.lastIndex = 0;
  let match;
  while ((match = importPattern.exec(source))) {
    const specifier = match[1];
    if (!(specifier.startsWith(".") || specifier.startsWith("@/"))) continue;
    const base = specifier.startsWith("@/")
      ? path.join(root, specifier.slice(2))
      : path.resolve(root, path.dirname(file), specifier);
    if (!candidatesFor(base).some((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())) {
      missingImports.push(`${file} -> ${specifier}`);
    }
  }
}
check(missingImports.length === 0, "all local source imports resolve", missingImports.slice(0, 8).join("; "));

// Every package script that directly invokes a repository script must target a file.
const missingScriptTargets = [];
for (const [name, command] of Object.entries(pkg.scripts || {})) {
  const matcher = /(?:^|[;&|]\s*|\s)node\s+(scripts\/[A-Za-z0-9_./-]+\.(?:mjs|cjs|js|ts))/g;
  let match;
  while ((match = matcher.exec(command))) {
    if (!exists(match[1])) missingScriptTargets.push(`${name} -> ${match[1]}`);
  }
}
check(missingScriptTargets.length === 0, "all npm script file targets exist", missingScriptTargets.slice(0, 8).join("; "));

// Check direct, literal app links against actual App Router pages and public assets.
const routeFiles = files.filter((file) => /^app\/.+\/page\.[cm]?[jt]sx?$/.test(file) || /^app\/page\.[cm]?[jt]sx?$/.test(file));
const routes = new Set(["/"]);
for (const file of routeFiles) {
  let route = file.replace(/^app\//, "").replace(/\/page\.[cm]?[jt]sx?$/, "").replace(/^page\.[cm]?[jt]sx?$/, "");
  route = route.split("/").filter((part) => !/^\(.+\)$/.test(part)).join("/");
  route = route ? `/${route}` : "/";
  routes.add(route.replace(/\/$/, "") || "/");
}
const badLinks = [];
const linkPattern = /(?:\bhref\s*=\s*\{?\s*|\b(?:push|replace|redirect)\s*\(\s*)["'](\/[A-Za-z0-9_./-]*)["']/g;
const routeMatches = (candidate) => {
  if (routes.has(candidate)) return true;
  for (const route of routes) {
    const routeParts = route.split("/").filter(Boolean);
    const candidateParts = candidate.split("/").filter(Boolean);
    if (routeParts.length !== candidateParts.length) continue;
    if (routeParts.every((part, index) => /^\[\[?\.\.\./.test(part) || /^\[.+\]$/.test(part) || part === candidateParts[index])) return true;
  }
  return false;
};
for (const file of sourceFiles) {
  // Test scripts intentionally contain literal route examples (including routes
  // asserted to be absent from production code). They are not navigation UI and
  // must not be interpreted as user-facing links by this heuristic.
  if (file.startsWith("scripts/")) continue;
  const source = read(file);
  linkPattern.lastIndex = 0;
  let match;
  while ((match = linkPattern.exec(source))) {
    const target = match[1];
    if (target.startsWith("/api/") || target.startsWith("/_next/") || target.startsWith("/validation-key") || target.startsWith("/tpa/")) continue;
    if (target.startsWith("/images/") || target.startsWith("/icons/") || target.startsWith("/fonts/")) {
      if (exists(`public${target}`)) continue;
    }
    if (!routeMatches(target)) badLinks.push(`${file} -> ${target}`);
  }
}
check(badLinks.length === 0, "literal internal navigation targets resolve", badLinks.slice(0, 10).join("; "));

// Repository cleanliness and secret-file safeguards.
const gitignore = read(".gitignore");
for (const [pattern, label] of [["node_modules/", "dependencies"], [".next/", "Next build output"], [".vercel/", "Vercel local state"], [".env*", "environment secrets"], ["!/.env.example", "safe environment template exception"], ["*.tsbuildinfo", "TypeScript incremental state"], ["*.pem", "local signing keys"], ["*.p12", "certificate containers"], ["*.pfx", "certificate containers"], ["*.jks", "Java signing stores"], ["*.keystore", "Java signing stores"], ["/test-results/", "Playwright results"], ["/playwright-report/", "Playwright report"]]) {
  check(gitignore.includes(pattern), `.gitignore excludes ${label}`, `missing ${pattern}`);
}
const forbiddenEnvFiles = files.filter((file) => /(^|\/)\.env(?:\..*)?$/.test(file) && file !== ".env.example");
check(forbiddenEnvFiles.length === 0, "no local environment secret files are packaged", forbiddenEnvFiles.join(", "));
const generatedArtifacts = files.filter((file) => /(?:^|\/)(?:tsconfig\.tsbuildinfo|\.DS_Store|Thumbs\.db)$/.test(file) || /\.(?:log|tsbuildinfo)$/.test(file));
check(generatedArtifacts.length === 0, "no generated compiler/log/OS artifacts remain", generatedArtifacts.join(", "));

// Lock graph is deliberately a warning here so source-level audit can still run
// while the release gate separately fails closed on incomplete npm metadata.
const declaredDependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const missingLockPackages = Object.keys(declaredDependencies).filter((name) => !lock.packages?.[`node_modules/${name}`]);
if (missingLockPackages.length) warn("package-lock graph incomplete", `missing ${missingLockPackages.join(", ")}; clean install/deploy remains blocked`);

console.log(`Project integrity audit: ${passed.length} checks passed, ${errors.length} errors, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`);
for (const item of passed) console.log(`PASS  ${item}`);
for (const item of warnings) console.warn(`WARN  ${item}`);
for (const item of errors) console.error(`ERROR ${item}`);
if (errors.length) process.exit(1);
