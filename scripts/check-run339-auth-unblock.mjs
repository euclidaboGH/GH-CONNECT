import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const context = readFileSync("contexts/pi-auth-context.tsx", "utf8");
const authReady = context.indexOf('setIsAuthenticated(true);', context.indexOf("The Pi identity and durable GH cookie have already been verified"));
const commerceStart = context.indexOf('reportPiAuthDiagnostic("PI_COMMERCE_SDK_INIT_START"');
const detachedStart = context.lastIndexOf("void (async () => {", commerceStart);
const sdkInit = context.indexOf("await loadSDKLite();", commerceStart);
const returnAfterCommerce = context.indexOf("return;", commerceStart);

assert(authReady >= 0, "verified Pi auth must set authenticated state");
assert(commerceStart > authReady, "optional commerce must start after authenticated state is set");
assert(detachedStart > authReady && detachedStart < sdkInit, "optional commerce must run in a detached async task");
assert(returnAfterCommerce > sdkInit, "auth initializer must return without awaiting optional commerce");
assert(context.includes('"PI_COMMERCE_SDK_READY"'), "commerce-ready diagnostic missing");
assert(context.includes('"PI_COMMERCE_SDK_FAILED"'), "commerce-failed diagnostic missing");
assert(context.includes("setSdk(null);"), "commerce failure must not install a local/mock SDK in production auth path");
assert(/let serverDiagnosticCode = identity\.accessToken/.test(context), "server diagnostic code must be initialized in the enclosing auth scope");
assert(/serverDiagnosticCode = bridge\?\.diagnosticCode/.test(context), "bridge diagnostic code must be retained for later failure handling");
assert(context.includes('setAuthMessage(`Identity service unavailable (${serverDiagnosticCode})`)'), "server verification failure must report the retained safe diagnostic code");
console.log("RUN339 auth-unblock contract: 10/10 passed");
