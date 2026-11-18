import fs from "node:fs"

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const checks = [
  ["earnings dashboard registers wallet focus effect before render-state early returns", () => {
    const source = read("components/ghc/unified-earnings-dashboard.tsx")
    const hook = source.indexOf('window.addEventListener("ghc:wallet-pi-focus"')
    const earlyReturn = source.indexOf("if (loading && !snap)")
    return hook > -1 && earlyReturn > hook && source.includes("const runWithdraw = useCallback")
  }],
  ["earnings action callbacks have stable dependencies", () => {
    const source = read("components/ghc/unified-earnings-dashboard.tsx")
    // Wallet consent now lives in the withdrawal sheet (phase 28). The dashboard
    // only opens that sheet; all retained callbacks must declare their dependencies.
    return source.includes("const openWithdrawSheet = useCallback(() =>") &&
      source.includes("  }, [])\n\n  const onRevokeWalletAuth = useCallback(async () =>") &&
      source.includes("  }, [authorizingWallet, refresh])") &&
      source.includes("const onPreviewFee = useCallback(async () =>") &&
      source.includes("  }, [snap])\n\n  const runWithdraw = useCallback") &&
      source.includes("  }, [openWithdrawSheet])") &&
      !source.includes("const onRequestPayout = useCallback") &&
      !source.includes("onAuthorizeWallet")
  }],
  ["comment sheet includes media preview in effect dependencies", () =>
    read("components/ghc/comment-sheet.tsx").includes("}, [open, mediaPreview])")],
  ["durable image always supplies an alt attribute", () =>
    read("components/ghc/durable-image.tsx").includes('alt = ""') &&
    read("components/ghc/durable-image.tsx").includes("alt={alt}")],
  ["reward panel captures opener element before cleanup", () => {
    const source = read("components/ghc/post-reward/post-reward-panel.tsx")
    return source.includes("const triggerElement = triggerRef.current") && source.includes("triggerElement?.focus()")
  }],
  ["domain binding effect depends on domain instances", () =>
    read("contexts/ghc-context.tsx").includes("[feedDomain, connectionsDomain, discoveryDomain]")],
  ["wallet asset selector uses native toggle-button semantics", () => {
    const source = read("features/wallet/wallet-balance.tsx")
    return !source.includes('role="option"') && !source.includes("aria-selected={selectedRail") &&
      (source.match(/aria-pressed=/g) || []).length >= 2
  }],
  ["section refresh effect tracks all consumed option fields", () =>
    read("hooks/use-section-refresh.ts").includes("opts?.events")],
  ["ESLint uses flat configuration without legacy environment override", () => {
    const pkg = JSON.parse(read("package.json"))
    return fs.existsSync(new URL("../eslint.config.mjs", import.meta.url)) &&
      !Object.values(pkg.scripts || {}).some((value) => typeof value === "string" && value.includes("ESLINT_USE_FLAT_CONFIG=false")) &&
      !fs.existsSync(new URL("../.eslintrc.json", import.meta.url))
  }],
]

let failed = 0
for (const [label, test] of checks) {
  let passed = false
  try { passed = Boolean(test()) } catch { passed = false }
  console.log(`${passed ? "PASS" : "FAIL"} ${label}`)
  if (!passed) failed += 1
}
console.log(`GitHub Actions #195 lint remediation: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exitCode = 1
