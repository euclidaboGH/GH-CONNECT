> **LEGACY VERIFICATION FIXTURE** — retained as historical evidence; Run #283 / 0.338.47 is the current implementation worklog.

# Run #282 — Active Ecosystem Module Surgical Maintenance

**Source:** GreenHaven 0.338.46 / Run #281 archive  
**Scope:** 11 Active modules × 30 maintenance points = **330 reviewed maintenance points**  
**Static verification:** `npm run verify:static` completed successfully; 3,599 `PASS` assertions, zero `FAIL` lines.  
**Additional checks:** JSX safety 1,075 files; Project Truth 11/11; Release Hygiene 15/15.  
**Runtime:** Node 22.16.0 is installed; project pins Node 24.15.0. Full Next build, browser/device acceptance, and runtime integration are not claimed.

## Interpretation
This is a surgical maintenance and regression-verification pass, not 330 arbitrary source rewrites. Existing code was left intact where its registered checks passed. The 30 points below identify the exact maintenance controls reviewed for each Active module. Static checks do not substitute for a production build, live Pi Testnet payment, or browser/device acceptance.

## 1. Community — 30 maintenance points

01. community directory and detail entry points — reviewed against the current source and registered regression gates.
02. membership join/leave authorization — reviewed against the current source and registered regression gates.
03. owner/admin/moderator role boundaries — reviewed against the current source and registered regression gates.
04. private and invite-only visibility — reviewed against the current source and registered regression gates.
05. community chat opt-in boundary — reviewed against the current source and registered regression gates.
06. chat access after membership revocation — reviewed against the current source and registered regression gates.
07. community post ownership — reviewed against the current source and registered regression gates.
08. announcement payload allow-list — reviewed against the current source and registered regression gates.
09. event date and duration validation — reviewed against the current source and registered regression gates.
10. event URL scheme validation — reviewed against the current source and registered regression gates.
11. resource URL normalization — reviewed against the current source and registered regression gates.
12. report target and reason allow-lists — reviewed against the current source and registered regression gates.
13. moderator removal target bounds — reviewed against the current source and registered regression gates.
14. membership concurrency serialization — reviewed against the current source and registered regression gates.
15. conversation membership revocation — reviewed against the current source and registered regression gates.
16. rejoin does not silently restore chat — reviewed against the current source and registered regression gates.
17. public search excludes private/deleted groups — reviewed against the current source and registered regression gates.
18. search pagination bounds — reviewed against the current source and registered regression gates.
19. canonical membership count integrity — reviewed against the current source and registered regression gates.
20. member role/status enum validation — reviewed against the current source and registered regression gates.
21. community ID sanitization — reviewed against the current source and registered regression gates.
22. private no-store API responses — reviewed against the current source and registered regression gates.
23. bounded JSON request parsing — reviewed against the current source and registered regression gates.
24. stale community state response fencing — reviewed against the current source and registered regression gates.
25. offline join/leave failure behavior — reviewed against the current source and registered regression gates.
26. invitation accept/decline resilience — reviewed against the current source and registered regression gates.
27. keyboard focus and semantic controls — reviewed against the current source and registered regression gates.
28. mobile safe-area and scroll behavior — reviewed against the current source and registered regression gates.
29. migration/RPC privilege boundaries — reviewed against the current source and registered regression gates.
30. prebuild regression registration — reviewed against the current source and registered regression gates.

## 2. GH Chat — 30 maintenance points

01. conversation list authorization — reviewed against the current source and registered regression gates.
02. conversation membership enforcement — reviewed against the current source and registered regression gates.
03. message history owner scoping — reviewed against the current source and registered regression gates.
04. message create actor derivation — reviewed against the current source and registered regression gates.
05. message body byte/character bounds — reviewed against the current source and registered regression gates.
06. message attachment count bounds — reviewed against the current source and registered regression gates.
07. durable media ownership checks — reviewed against the current source and registered regression gates.
08. stable message idempotency — reviewed against the current source and registered regression gates.
09. duplicate send protection — reviewed against the current source and registered regression gates.
10. message search server-side scope — reviewed against the current source and registered regression gates.
11. search query bounds — reviewed against the current source and registered regression gates.
12. read receipt authorization — reviewed against the current source and registered regression gates.
13. presence visibility boundaries — reviewed against the current source and registered regression gates.
14. conversation preference ownership — reviewed against the current source and registered regression gates.
15. community chat explicit opt-in — reviewed against the current source and registered regression gates.
16. blocked-user interaction gates — reviewed against the current source and registered regression gates.
17. call relationship eligibility — reviewed against the current source and registered regression gates.
18. outgoing call authenticated creation — reviewed against the current source and registered regression gates.
19. incoming call authorization — reviewed against the current source and registered regression gates.
20. call transition allow-list — reviewed against the current source and registered regression gates.
21. signaling payload bounds — reviewed against the current source and registered regression gates.
22. TURN credentials short-lived — reviewed against the current source and registered regression gates.
23. peer connection true-connected state — reviewed against the current source and registered regression gates.
24. media track teardown — reviewed against the current source and registered regression gates.
25. voice-note duration bounds — reviewed against the current source and registered regression gates.
26. offline message retry policy — reviewed against the current source and registered regression gates.
27. account-change thread reset — reviewed against the current source and registered regression gates.
28. private no-store responses — reviewed against the current source and registered regression gates.
29. accessible search and call controls — reviewed against the current source and registered regression gates.
30. messaging regression registration — reviewed against the current source and registered regression gates.

## 3. Connections — 30 maintenance points

01. follow actor derives from session — reviewed against the current source and registered regression gates.
02. follow target ID sanitization — reviewed against the current source and registered regression gates.
03. self-follow rejection — reviewed against the current source and registered regression gates.
04. placeholder target rejection — reviewed against the current source and registered regression gates.
05. block relationship enforcement — reviewed against the current source and registered regression gates.
06. mute relationship enforcement — reviewed against the current source and registered regression gates.
07. follow request throttling — reviewed against the current source and registered regression gates.
08. durable write failure is fail-closed — reviewed against the current source and registered regression gates.
09. connection request actor derivation — reviewed against the current source and registered regression gates.
10. connection target validation — reviewed against the current source and registered regression gates.
11. accept action authorization — reviewed against the current source and registered regression gates.
12. decline action authorization — reviewed against the current source and registered regression gates.
13. duplicate request handling — reviewed against the current source and registered regression gates.
14. relationship state normalization — reviewed against the current source and registered regression gates.
15. social graph change events — reviewed against the current source and registered regression gates.
16. connection inbox pagination — reviewed against the current source and registered regression gates.
17. account-change state reset — reviewed against the current source and registered regression gates.
18. stale relationship response fencing — reviewed against the current source and registered regression gates.
19. private profile field exclusion — reviewed against the current source and registered regression gates.
20. notification emitted after durable write — reviewed against the current source and registered regression gates.
21. no client-supplied actor IDs — reviewed against the current source and registered regression gates.
22. bounded request payloads — reviewed against the current source and registered regression gates.
23. bounded upstream timeout — reviewed against the current source and registered regression gates.
24. private no-store responses — reviewed against the current source and registered regression gates.
25. offline mutation honesty — reviewed against the current source and registered regression gates.
26. duplicate tap prevention — reviewed against the current source and registered regression gates.
27. accessible request actions — reviewed against the current source and registered regression gates.
28. responsive connection cards — reviewed against the current source and registered regression gates.
29. humanized safe errors — reviewed against the current source and registered regression gates.
30. prebuild regression registration — reviewed against the current source and registered regression gates.

## 4. Matches — 30 maintenance points

01. candidate discovery uses canonical RPC — reviewed against the current source and registered regression gates.
02. matches-only eligibility from server — reviewed against the current source and registered regression gates.
03. viewer actor derives from session — reviewed against the current source and registered regression gates.
04. candidate privacy flags respected — reviewed against the current source and registered regression gates.
05. hidden candidates excluded — reviewed against the current source and registered regression gates.
06. location privacy respected — reviewed against the current source and registered regression gates.
07. interest privacy respected — reviewed against the current source and registered regression gates.
08. bio privacy respected — reviewed against the current source and registered regression gates.
09. search query bounds — reviewed against the current source and registered regression gates.
10. stable keyset cursor validation — reviewed against the current source and registered regression gates.
11. match signal enum validation — reviewed against the current source and registered regression gates.
12. self-target rejection — reviewed against the current source and registered regression gates.
13. demo target rejection — reviewed against the current source and registered regression gates.
14. match write throttling — reviewed against the current source and registered regression gates.
15. match inbox read throttling — reviewed against the current source and registered regression gates.
16. duplicate signal handling — reviewed against the current source and registered regression gates.
17. relationship state normalization — reviewed against the current source and registered regression gates.
18. block relationship enforcement — reviewed against the current source and registered regression gates.
19. mute relationship enforcement — reviewed against the current source and registered regression gates.
20. identity-change refresh — reviewed against the current source and registered regression gates.
21. stale response fencing — reviewed against the current source and registered regression gates.
22. bounded upstream timeout — reviewed against the current source and registered regression gates.
23. private no-store responses — reviewed against the current source and registered regression gates.
24. no client actor override — reviewed against the current source and registered regression gates.
25. no fabricated match eligibility — reviewed against the current source and registered regression gates.
26. accessible interest/connect actions — reviewed against the current source and registered regression gates.
27. filter empty states — reviewed against the current source and registered regression gates.
28. responsive discovery cards — reviewed against the current source and registered regression gates.
29. humanized safe errors — reviewed against the current source and registered regression gates.
30. prebuild regression registration — reviewed against the current source and registered regression gates.

## 5. Marketplace — 30 maintenance points

01. listing read visibility — reviewed against the current source and registered regression gates.
02. listing owner authorization — reviewed against the current source and registered regression gates.
03. listing ID bounds — reviewed against the current source and registered regression gates.
04. listing report allow-lists — reviewed against the current source and registered regression gates.
05. listing stock zero preservation — reviewed against the current source and registered regression gates.
06. listing price server authority — reviewed against the current source and registered regression gates.
07. seller identity server authority — reviewed against the current source and registered regression gates.
08. currency server authority — reviewed against the current source and registered regression gates.
09. own-listing purchase rejection — reviewed against the current source and registered regression gates.
10. cart own-seller line exclusion — reviewed against the current source and registered regression gates.
11. durable stock reservation — reviewed against the current source and registered regression gates.
12. atomic inventory claim — reviewed against the current source and registered regression gates.
13. idempotent listing/order writes — reviewed against the current source and registered regression gates.
14. durable fail-closed throttling — reviewed against the current source and registered regression gates.
15. payment intent binding — reviewed against the current source and registered regression gates.
16. verified payment evidence requirement — reviewed against the current source and registered regression gates.
17. refund authority boundary — reviewed against the current source and registered regression gates.
18. fulfilment transition authorization — reviewed against the current source and registered regression gates.
19. seller payout evidence integrity — reviewed against the current source and registered regression gates.
20. commission/proceeds separation — reviewed against the current source and registered regression gates.
21. private order detail visibility — reviewed against the current source and registered regression gates.
22. media ownership validation — reviewed against the current source and registered regression gates.
23. bounded mutation JSON — reviewed against the current source and registered regression gates.
24. no-store mutation responses — reviewed against the current source and registered regression gates.
25. database RPC service-role ACL — reviewed against the current source and registered regression gates.
26. migration uniqueness/inventory sync — reviewed against the current source and registered regression gates.
27. safe lifecycle action hints — reviewed against the current source and registered regression gates.
28. responsive seller/buyer UI — reviewed against the current source and registered regression gates.
29. safe user-facing failure states — reviewed against the current source and registered regression gates.
30. prebuild regression registration — reviewed against the current source and registered regression gates.

## 6. Orders — 30 maintenance points

01. buyer order list owner scope — reviewed against the current source and registered regression gates.
02. seller order list owner scope — reviewed against the current source and registered regression gates.
03. order detail buyer/seller scope — reviewed against the current source and registered regression gates.
04. order list durable source of truth — reviewed against the current source and registered regression gates.
05. stable timestamp/ID ordering — reviewed against the current source and registered regression gates.
06. missing timestamps not fabricated — reviewed against the current source and registered regression gates.
07. quantity strict integer bounds — reviewed against the current source and registered regression gates.
08. stable idempotency key required — reviewed against the current source and registered regression gates.
09. server-derived order totals — reviewed against the current source and registered regression gates.
10. server-derived seller and currency — reviewed against the current source and registered regression gates.
11. inventory reservation atomicity — reviewed against the current source and registered regression gates.
12. payment claim fencing — reviewed against the current source and registered regression gates.
13. payment release fencing — reviewed against the current source and registered regression gates.
14. paid cancellation refund authority — reviewed against the current source and registered regression gates.
15. verified payment before fulfilment — reviewed against the current source and registered regression gates.
16. delivery/service activation confirmation — reviewed against the current source and registered regression gates.
17. buyer confirmation authorization — reviewed against the current source and registered regression gates.
18. timeline event durability — reviewed against the current source and registered regression gates.
19. commerce action allow-list — reviewed against the current source and registered regression gates.
20. generic transition restrictions — reviewed against the current source and registered regression gates.
21. refund state protected from public transition — reviewed against the current source and registered regression gates.
22. stale payment claim operator recovery — reviewed against the current source and registered regression gates.
23. no memory fallback for durable writes — reviewed against the current source and registered regression gates.
24. bounded JSON for all mutations — reviewed against the current source and registered regression gates.
25. private no-store responses — reviewed against the current source and registered regression gates.
26. order mapper snake/camel normalization — reviewed against the current source and registered regression gates.
27. duplicate request handling — reviewed against the current source and registered regression gates.
28. accessible order action states — reviewed against the current source and registered regression gates.
29. safe retry/error messaging — reviewed against the current source and registered regression gates.
30. prebuild regression registration — reviewed against the current source and registered regression gates.

## 7. Wallet — 30 maintenance points

01. authenticated wallet summary — reviewed against the current source and registered regression gates.
02. canonical ledger balance source — reviewed against the current source and registered regression gates.
03. PI and GHC balances kept separate — reviewed against the current source and registered regression gates.
04. withdrawable versus total balance distinction — reviewed against the current source and registered regression gates.
05. account-change cache clearing — reviewed against the current source and registered regression gates.
06. stale response fencing — reviewed against the current source and registered regression gates.
07. wallet consent least privilege — reviewed against the current source and registered regression gates.
08. no broader consent retry — reviewed against the current source and registered regression gates.
09. PIN proof server verification — reviewed against the current source and registered regression gates.
10. PIN proof user/idempotency binding — reviewed against the current source and registered regression gates.
11. PIN attempt atomic rate control — reviewed against the current source and registered regression gates.
12. withdrawal idempotency — reviewed against the current source and registered regression gates.
13. atomic reservation — reviewed against the current source and registered regression gates.
14. provider evidence reconciliation — reviewed against the current source and registered regression gates.
15. uncertain outcome remains reserved — reviewed against the current source and registered regression gates.
16. safe release conditions — reviewed against the current source and registered regression gates.
17. no release with provider IDs — reviewed against the current source and registered regression gates.
18. execution lease recovery — reviewed against the current source and registered regression gates.
19. durable payout limits — reviewed against the current source and registered regression gates.
20. withdrawal rate limits — reviewed against the current source and registered regression gates.
21. private no-store financial responses — reviewed against the current source and registered regression gates.
22. bounded payment request bodies — reviewed against the current source and registered regression gates.
23. no client-side balance minting — reviewed against the current source and registered regression gates.
24. ledger history keyset pagination — reviewed against the current source and registered regression gates.
25. CSV export safety — reviewed against the current source and registered regression gates.
26. identity mapping validation — reviewed against the current source and registered regression gates.
27. accessible withdrawal recovery copy — reviewed against the current source and registered regression gates.
28. session step-up requirements — reviewed against the current source and registered regression gates.
29. Testnet-only payout boundary — reviewed against the current source and registered regression gates.
30. wallet release-gate registration — reviewed against the current source and registered regression gates.

## 8. GHC — 30 maintenance points

01. GHC atomic amount parsing — reviewed against the current source and registered regression gates.
02. no floating-point financial arithmetic — reviewed against the current source and registered regression gates.
03. PI and GHC rails remain distinct — reviewed against the current source and registered regression gates.
04. unified card does not sum unlike assets — reviewed against the current source and registered regression gates.
05. GHC send actor derives from session — reviewed against the current source and registered regression gates.
06. GHC recipient ID validation — reviewed against the current source and registered regression gates.
07. transfer idempotency — reviewed against the current source and registered regression gates.
08. durable transfer request state — reviewed against the current source and registered regression gates.
09. duplicate transfer protection — reviewed against the current source and registered regression gates.
10. balance debit server authority — reviewed against the current source and registered regression gates.
11. ledger credit server authority — reviewed against the current source and registered regression gates.
12. canonical transaction history — reviewed against the current source and registered regression gates.
13. transaction identity validation — reviewed against the current source and registered regression gates.
14. transaction status allow-list — reviewed against the current source and registered regression gates.
15. account-change history reset — reviewed against the current source and registered regression gates.
16. stale balance response fencing — reviewed against the current source and registered regression gates.
17. no client ledger writes — reviewed against the current source and registered regression gates.
18. utility payment separation — reviewed against the current source and registered regression gates.
19. GHC purchase catalog authority — reviewed against the current source and registered regression gates.
20. pack intent payment binding — reviewed against the current source and registered regression gates.
21. commission and sink accounting boundaries — reviewed against the current source and registered regression gates.
22. reconciliation evidence handling — reviewed against the current source and registered regression gates.
23. bounded transfer payloads — reviewed against the current source and registered regression gates.
24. rate limits fail closed — reviewed against the current source and registered regression gates.
25. private no-store financial routes — reviewed against the current source and registered regression gates.
26. RPC execute ACL protection — reviewed against the current source and registered regression gates.
27. accessible asset rail controls — reviewed against the current source and registered regression gates.
28. exact amount formatting — reviewed against the current source and registered regression gates.
29. safe error humanization — reviewed against the current source and registered regression gates.
30. prebuild regression registration — reviewed against the current source and registered regression gates.

## 9. Pi Payments — 30 maintenance points

01. Pi Browser runtime detection — reviewed against the current source and registered regression gates.
02. official Pi authentication bridge — reviewed against the current source and registered regression gates.
03. consent asks only required scope — reviewed against the current source and registered regression gates.
04. consent failure does not broaden scope — reviewed against the current source and registered regression gates.
05. payment intent authenticated ownership — reviewed against the current source and registered regression gates.
06. payment direction validation — reviewed against the current source and registered regression gates.
07. Testnet network validation — reviewed against the current source and registered regression gates.
08. provider payer identity binding — reviewed against the current source and registered regression gates.
09. exact provider payment ID binding — reviewed against the current source and registered regression gates.
10. exact amount validation — reviewed against the current source and registered regression gates.
11. transaction verification required — reviewed against the current source and registered regression gates.
12. txid required before completion — reviewed against the current source and registered regression gates.
13. completion idempotency — reviewed against the current source and registered regression gates.
14. recovery lookup before binding — reviewed against the current source and registered regression gates.
15. ambiguous outcome remains pending — reviewed against the current source and registered regression gates.
16. duplicate completion prevention — reviewed against the current source and registered regression gates.
17. server-side payment authority — reviewed against the current source and registered regression gates.
18. client cannot mark paid — reviewed against the current source and registered regression gates.
19. bounded payment JSON — reviewed against the current source and registered regression gates.
20. payment mutation timeout — reviewed against the current source and registered regression gates.
21. durable rate limiting — reviewed against the current source and registered regression gates.
22. private no-store responses — reviewed against the current source and registered regression gates.
23. payment timeline ownership — reviewed against the current source and registered regression gates.
24. cancel/recovery authorization — reviewed against the current source and registered regression gates.
25. A2U eligibility and qualification — reviewed against the current source and registered regression gates.
26. wallet identity mapping integrity — reviewed against the current source and registered regression gates.
27. no fake Pi balance updates — reviewed against the current source and registered regression gates.
28. offline payment honesty — reviewed against the current source and registered regression gates.
29. Pi Testnet-only execution boundary — reviewed against the current source and registered regression gates.
30. prebuild regression registration — reviewed against the current source and registered regression gates.

## 10. Rewards — 30 maintenance points

01. claim actor derives from session — reviewed against the current source and registered regression gates.
02. claim eligibility server-authoritative — reviewed against the current source and registered regression gates.
03. claim idempotency — reviewed against the current source and registered regression gates.
04. duplicate reward ID serialization — reviewed against the current source and registered regression gates.
05. one posted credit per canonical reward — reviewed against the current source and registered regression gates.
06. replay ownership validation — reviewed against the current source and registered regression gates.
07. pending claim recovery — reviewed against the current source and registered regression gates.
08. matured reward reconciliation — reviewed against the current source and registered regression gates.
09. mission progress is guidance only — reviewed against the current source and registered regression gates.
10. durable achievement unlock proof — reviewed against the current source and registered regression gates.
11. unsupported missions remain locked — reviewed against the current source and registered regression gates.
12. no client ledger minting — reviewed against the current source and registered regression gates.
13. GHC and Pi cashback separation — reviewed against the current source and registered regression gates.
14. reward history owner scope — reviewed against the current source and registered regression gates.
15. history keyset pagination — reviewed against the current source and registered regression gates.
16. ledger transaction ID validation — reviewed against the current source and registered regression gates.
17. positive finite amount validation — reviewed against the current source and registered regression gates.
18. timestamp validation — reviewed against the current source and registered regression gates.
19. transaction status allow-list — reviewed against the current source and registered regression gates.
20. account-change history reset — reviewed against the current source and registered regression gates.
21. stale achievement response fencing — reviewed against the current source and registered regression gates.
22. daily claim duplicate protection — reviewed against the current source and registered regression gates.
23. reward notification after durable claim — reviewed against the current source and registered regression gates.
24. bounded claim payloads — reviewed against the current source and registered regression gates.
25. rate limits fail closed — reviewed against the current source and registered regression gates.
26. private no-store responses — reviewed against the current source and registered regression gates.
27. exact asset formatting — reviewed against the current source and registered regression gates.
28. safe reward error messaging — reviewed against the current source and registered regression gates.
29. reward source/ledger reconciliation — reviewed against the current source and registered regression gates.
30. prebuild regression registration — reviewed against the current source and registered regression gates.

## 11. Membership — 30 maintenance points

01. canonical membership plan catalog — reviewed against the current source and registered regression gates.
02. server-derived plan price — reviewed against the current source and registered regression gates.
03. duration and bonus term correctness — reviewed against the current source and registered regression gates.
04. PI/GHC purchase rail distinction — reviewed against the current source and registered regression gates.
05. prepaid term disclosure — reviewed against the current source and registered regression gates.
06. no automatic recurring renewal claim — reviewed against the current source and registered regression gates.
07. active entitlement authoritative status — reviewed against the current source and registered regression gates.
08. future expiry validation — reviewed against the current source and registered regression gates.
09. unknown tier rejection — reviewed against the current source and registered regression gates.
10. malformed active flag rejection — reviewed against the current source and registered regression gates.
11. identity-change entitlement clearing — reviewed against the current source and registered regression gates.
12. abortable membership refresh — reviewed against the current source and registered regression gates.
13. stale response sequence fencing — reviewed against the current source and registered regression gates.
14. session resume refresh — reviewed against the current source and registered regression gates.
15. same-tier duplicate charge prevention — reviewed against the current source and registered regression gates.
16. concurrent purchase serialization — reviewed against the current source and registered regression gates.
17. VVIP downgrade prevention — reviewed against the current source and registered regression gates.
18. Pi completion downgrade guard — reviewed against the current source and registered regression gates.
19. activation route downgrade guard — reviewed against the current source and registered regression gates.
20. purchase intent downgrade guard — reviewed against the current source and registered regression gates.
21. complimentary entitlement labeling — reviewed against the current source and registered regression gates.
22. membership activity account isolation — reviewed against the current source and registered regression gates.
23. entitlement history source clarity — reviewed against the current source and registered regression gates.
24. renewal/expiry operational controls — reviewed against the current source and registered regression gates.
25. private no-store status response — reviewed against the current source and registered regression gates.
26. bounded mutation input — reviewed against the current source and registered regression gates.
27. service-role RPC authority — reviewed against the current source and registered regression gates.
28. no client entitlement grant — reviewed against the current source and registered regression gates.
29. accessible plan comparison — reviewed against the current source and registered regression gates.
30. prebuild regression registration — reviewed against the current source and registered regression gates.

## Release and data-safety boundaries
- All 11 Active statuses and all 30 Coming Soon statuses remain unchanged.
- No SQL migrations were applied and no Testnet data was mutated.
- No wallet balances, rewards, payouts, marketplace orders, or membership entitlements were modified.
- No GitHub push or Vercel deployment was initiated.
- Pi Mainnet remains untouched.

## Remaining acceptance gates
1. Run the required Node 24.15.0 toolchain and install dependencies from the lockfile.
2. Run full TypeScript check and production Next build.
3. Run authenticated browser/device journeys for each Active module.
4. Reconcile missing applied migration source history before any database migration rehearsal.
5. Perform controlled Pi Testnet payment and payout recovery acceptance; never use Mainnet for this maintenance pass.
