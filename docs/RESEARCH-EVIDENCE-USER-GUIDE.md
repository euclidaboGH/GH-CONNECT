# Research Evidence — owner workflow (0.338.91)

1. Sign in to GreenHaven and open Research Studio.
2. Open a project and select Responses to enter its private inbox.
3. Under a response, choose **Add evidence** and select an image, supported video, audio recording or PDF. Owner uploads use the authenticated media pipeline.
4. Public respondents can attach up to five files before submitting a published form. Their upload session is bound to that project and a random submission key; the server links those evidence rows only to the matching response.
5. Field agents can attach evidence to a durable report created by their current field session. A different field session cannot reuse that report's upload scope.
6. All newly attached evidence is marked **Quarantined / Scan pending**. The server streams the private object to compute SHA-256 and checks basic magic bytes, then stores the provenance fields. This does not scan for malware.
7. A trusted external scanner must poll `/api/internal/evidence/scan-queue` and submit an HMAC-authenticated result to `/api/internal/evidence/scan-result`. Until that scanner is configured and reports a matching digest as clean, the content routes refuse to open the file.
8. After a clean scan, the project owner or configured central administrator can open the private evidence link and record a separate Verify, Reject or Quarantine decision.
9. Evidence create, scan and review changes are appended to a database SHA-256 hash chain. This helps detect later tampering; it does not prove the original capture location, time or legal authenticity.

Central administrators can open `/field/admin/evidence` while signed in as the configured `GHC_FIELD_ADMIN_USER_ID` account. Field access codes do not grant GreenHaven account or admin privileges.

The 0.338.91 source migrations `20261116182000`, `20261116190000` and `20261117010001` remain REVIEW_REQUIRED and unapplied. Do not treat the source implementation as live until migrations are reconciled and applied to the intended environment, a trusted scanner is configured, and signed-upload/authorization tests pass.
