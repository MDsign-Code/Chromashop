# ChromaStudio Pro — Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Ownership**: Every document in `/users`, `/projects`, `/brushes`, `/assets`, `/plugins`, and `/analytics` MUST have `ownerId == request.auth.uid` and require `request.auth.token.email_verified == true` for writes.
2. **Master Gate Relational Integrity**: Subcollection documents in `/projects/{projectId}/backups/{backupId}` and `/projects/{projectId}/comments/{commentId}` cannot be created, read, updated, or deleted unless the parent `/projects/{projectId}` exists and belongs to `request.auth.uid`, and `incoming().projectId == projectId`.
3. **Immutable Audit Fields**: `ownerId`, `projectId`, and `createdAt` can NEVER be altered on update.
4. **Server Temporal Integrity**: `createdAt == request.time` on create and `updatedAt == request.time` on update.
5. **No Shadow Fields & Bounded Volumes**: Every entity enforces `hasAll` + `hasOnly`, string `.size()` caps, bounded numeric ranges, and bounded array/map sizes.
6. **Zero Blanket Lists**: Every `allow list` strictly enforces `resource.data.ownerId == request.auth.uid` without `get()` or `exists()` lookups.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Attempting to read or create `/projects/p1` with `auth == null`.
2. **Unverified Email Spoof**: Creating `/projects/p1` with `auth.token.email_verified == false`.
3. **Cross-Owner Identity Spoofing**: User A creating `/projects/p1` with `ownerId: "user-B"`.
4. **Shadow Ghost Field Injection**: Updating `/users/uidA` with extra field `isAdmin: true` or `role: "superadmin"`.
5. **Immutable Field Hijack**: Updating `/projects/p1` to change `ownerId` or `createdAt`.
6. **Client Timestamp Forgery**: Creating `/projects/p1` with a backdated client timestamp instead of `request.time`.
7. **ID Poisoning Attack**: Creating `/projects/` with a 200-char ID or special characters (`../admin`).
8. **Orphaned Backup Creation**: Creating `/projects/nonexistent/backups/b1` where parent project does not exist or belongs to User B.
9. **Array Flood on Asset Tags**: Creating `/assets/a1` with 25 tags (exceeds `size() <= 10`) or a non-string tag at index 0.
10. **Value Poisoning on Update**: Updating `/projects/p1` whitelisted field `width` to `"99999"` (string instead of number) or `50000` (out of range).
11. **PII / Private Preferences Cross-Read**: User B attempting `get` on `/users/userA`.
12. **Blanket Collection Scraping**: User A executing an unfiltered `list` query across `/projects` expecting User B's documents.
