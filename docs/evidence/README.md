# Testnet beta evidence packet

This directory defines an offline, fail-closed evidence packet for a **Testnet Preview** beta. It cannot deploy the application or authorize Mainnet.

## Create a working packet

From the repository root, run:

```sh
npm run release:evidence:template
```

The command creates `docs/evidence/testnet-beta-evidence.json` and refuses to overwrite an existing file. Fill in the full commit SHA, actual Node/npm versions, all gate results, reviewer names and approval metadata. The packet is blocked by default.

For each gate marked `passed`, attach one or more evidence artifacts under the same directory tree, then record a relative `path`, SHA-256 checksum, ISO-8601 observation timestamp, and the reviewer who inspected it. Example checksum command:

```sh
sha256sum docs/evidence/artifacts/runtime-build.log
```

Do not place credentials, cookies, tokens, raw payment payloads, or unnecessary personal/wallet identifiers in evidence artifacts. Keep artifacts sanitized. The validator checks referenced file existence, path traversal, hashes, timestamps, required gate IDs, full commit SHA, Node 24.15.0, four accountable reviewers, unresolved risks, secret-like strings, and Testnet-only targeting.

## Validate

```sh
npm run release:evidence:validate
```

A nonzero exit status means the packet is not approved. A valid packet means only that the required Testnet evidence packet is structurally complete and reviewed according to this local policy. It is not cryptographic proof that the evidence itself is truthful, not an automated live test, and not Mainnet approval. Reviewers must independently inspect artifacts before approving.

The committed `testnet-beta-evidence.template.json` is a reference template and is deliberately blocked. Do not edit the template to record real approval; create a separate working packet.
