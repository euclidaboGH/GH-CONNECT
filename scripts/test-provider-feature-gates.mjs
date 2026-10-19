import fs from 'node:fs'
import assert from 'node:assert/strict'

const ads = fs.readFileSync('app/api/ads/verify/route.ts', 'utf8')
const staking = fs.readFileSync('app/api/pi/staking/route.ts', 'utf8')
const env = fs.readFileSync('.env.example', 'utf8')
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))

// Pi rewarded ads: client signals must never be treated as provider proof.
assert.match(ads, /resolveAuthenticatedUser\(request\.headers\)/)
assert.match(ads, /checkRateLimit\(/)
assert.match(ads, /GH_ADS_ENABLED/)
assert.match(ads, /ADS_VERIFY_NOT_IMPLEMENTED/)
assert.match(ads, /verified:\s*false/)
assert.match(ads, /rewardAuthorized:\s*false/)
assert.match(ads, /status:\s*501/)
assert.doesNotMatch(ads, /body\.verified\s*===\s*true/)
assert.doesNotMatch(ads, /rewardAmount\s*\*|wallet\.credit|mintGhc\(/i)

// Pi staking: enabling the flag alone must not manufacture staking data.
assert.match(staking, /PI_STAKING_API_ENABLED/)
assert.match(staking, /reason:\s*"api_not_wired"/)
assert.match(staking, /effectiveStake:\s*null/)
assert.match(staking, /Cache-Control.*no-store/)
assert.doesNotMatch(staking, /effectiveStake:\s*Number\(/)

// Explicitly disclose these integration gates in operator configuration.
assert.match(env, /GH_ADS_ENABLED/)
assert.match(env, /PI_STAKING_API_ENABLED/)
assert.match(packageJson.scripts['ci:verify'], /test:provider-feature-gates/)
console.log('Provider feature-gate source checks: 17/17 passed')
