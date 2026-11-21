# Security Specification — Darus Salam Madrasa Firestore

## 1. Data Invariants
1. **Default-Deny Baseline**: Every path not explicitly matched is denied (`/{document=**}`).
2. **PII Isolation**:
   - `/admissions/{admissionId}` and `/students/{studentId}` contain PII (`mobile`, `phone`, `email`, `address`, `fatherName`).
   - `get` and `list` access are strictly limited to verified admins (`kmdfoysal693@gmail.com` with `email_verified == true`, or `/admins/{uid}`) or the owning authenticated user (`existing().ownerUid == request.auth.uid`).
   - Unauthenticated or third-party `read`/`list` queries are strictly rejected.
3. **Anti-Privilege-Escalation**:
   - `/users/{userId}` only allows `role == 'user'` on creation and prevents changing `role` or `uid` on update.
   - `/admins/{adminId}` is strictly non-writable from client SDKs (`allow write: if false`).
4. **Identity & Temporal Integrity**:
   - All `create` operations require `createdAt == request.time && updatedAt == request.time`.
   - All `update` operations require `incoming().createdAt == existing().createdAt && incoming().updatedAt == request.time`.
   - Public admission/student `create` enforces `status == 'pending'` (admissions) or `status == 'active'` (students), strict field allowlisting (`hasAll` + `hasOnly`), regex ID validation (`^[a-zA-Z0-9_\-]+$`), and string `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated PII Read**: Unauthenticated `get(/admissions/ADM-2026-1001)` -> Denied.
2. **Unauthenticated PII List**: Unauthenticated `list(/students)` -> Denied.
3. **Cross-User Read**: Signed-in user `uid_B` reading `/admissions/ADM-2026-1001` owned by `uid_A` -> Denied.
4. **Email Spoofing Admin Check**: User with `token.email == 'kmdfoysal693@gmail.com'` and `token.email_verified == false` listing `/admissions` -> Denied.
5. **Self-Assigned Admin Role**: User creating `/users/uid_A` with `role: 'admin'` -> Denied.
6. **Admin Marker Write**: Any user attempting `set(/admins/uid_A, { uid: 'uid_A', email: '...' })` -> Denied.
7. **Shadow / Ghost Field Injection**: Creating `/admissions/ADM-2026-9999` with extra field `isApproved: true` -> Denied (`hasOnly`).
8. **Status Shortcutting on Create**: Creating `/admissions/ADM-2026-9999` with `status: 'approved'` -> Denied.
9. **Client Timestamp Forgery**: Creating `/admissions/ADM-2026-9999` with a client-supplied `Date` instead of `request.time` -> Denied.
10. **ID Poisoning**: Creating `/admissions/bad..id!!` or 500-char document ID -> Denied (`isValidId`).
11. **Value Poisoning on Update**: Updating `/students/stu_1` with `phone` as a boolean or 200-char string -> Denied (`isValidStudent`).
12. **Immutable Field Tampering**: Updating `/admissions/ADM-2026-1001` and changing `createdAt` or `trackingId` -> Denied.
