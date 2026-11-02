// Safe deployment environment shape audit. It never prints environment values.
const vars = process.env;
const failures = [];
const report = (name, status, detail = '') => console.log(`${status} ${name}${detail ? ` — ${detail}` : ''}`);
const urls = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_APP_URL'];
for (const name of urls) {
  const value = vars[name];
  if (!value) { report(name, 'INFO', 'not configured'); continue; }
  try {
    const url = new URL(value);
    const valid = ['https:', ...(process.env.NODE_ENV === 'development' ? ['http:'] : [])].includes(url.protocol)
      && !url.username && !url.password && !url.hash;
    if (!valid) throw new Error('invalid shape');
    report(name, 'PASS', 'valid URL shape; value hidden');
  } catch {
    failures.push(name);
    report(name, 'FAIL', 'invalid URL shape; value hidden');
  }
}
for (const name of ['NEXT_PUBLIC_PI_SANDBOX', 'GHC_E2E_ALLOW_TESTNET', 'GHC_REFERRAL_SETTLEMENT_ENABLED', 'GHC_CURATION_REDISTRIBUTE_ENABLED', 'GHC_CURATION_REDISTRIBUTION_ENABLED', 'GHC_REGISTRATION_BONUS_ENABLED', 'PI_EARNINGS_PAYOUT_REQUESTS_ENABLED', 'PI_EARNINGS_PAYOUT_EXECUTION_ENABLED', 'PI_A2U_ENABLED', 'PI_A2U_TESTNET_ONLY']) {
  const value = vars[name];
  if (value == null || value === '') { report(name, 'INFO', 'not configured'); continue; }
  if (!['0', '1', 'true', 'false'].includes(value.toLowerCase())) {
    failures.push(name); report(name, 'FAIL', 'expected boolean-like value; value hidden');
  } else report(name, 'PASS', 'boolean-like value; value hidden');
}
if (vars.PI_NETWORK && !['testnet', 'mainnet'].includes(vars.PI_NETWORK.toLowerCase())) {
  failures.push('PI_NETWORK'); report('PI_NETWORK', 'FAIL', 'expected testnet or mainnet; value hidden');
} else if (vars.PI_NETWORK) report('PI_NETWORK', 'PASS', 'recognized network name; value hidden');
else report('PI_NETWORK', 'INFO', 'not configured');
for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_JWT_SECRET', 'PI_API_KEY', 'PI_SERVER_API_KEY', 'GHC_OPERATOR_RECONCILE_KEY', 'GHC_A2U_ADMIN_KEY', 'PI_EARNINGS_EXECUTOR_KEY', 'GHC_CREATOR_REWARD_OPERATOR_KEY', 'GHC_SETTLEMENT_OPERATOR_KEY']) {
  if (vars[name] && vars[`NEXT_PUBLIC_${name}`]) {
    failures.push(`NEXT_PUBLIC_${name}`);
    report(`NEXT_PUBLIC_${name}`, 'FAIL', 'server secret must not be public; values hidden');
  }
}
if (failures.length) {
  report('RESULT', 'FAIL', `${failures.length} variable shape issue(s); names only, no values printed`);
  process.exitCode = 1;
} else report('RESULT', 'PASS', 'no invalid configured shapes detected; this does not prove credentials work or are authorized');
