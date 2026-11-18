# Security Specification & TDD Plan (`security_spec.md`)

## 1. Data Invariants
1. **Admin Authority (`isAdmin`)**: Only verified Firebase Auth users present in `/admins/{uid}` OR the bootstrapped verified admin email (`kmdfoysal693@gmail.com` with `email_verified == true`) can mutate CMS sections (`cms_sections`, `cms_departments`, `cms_notices`, `cms_gallery`, `cms_teachers`), read/update/delete `admissions`, or access `admin_ui`.
2. **Public Website Read Access**: Public CMS documents (`cms_sections`, `cms_departments`, `cms_notices`, `cms_gallery`, `cms_teachers`) contain zero private PII and are readable by all website visitors (`allow read: if true`) so Vercel and AI Studio stay synced live.
3. **Admissions PII Isolation**: `admissions` documents contain personal phone numbers and home addresses. Non-admin users MUST NEVER be able to `get`, `list`, `update`, or `delete` any `admissions` document.
4. **Public Admission Submission Integrity**: Unauthenticated applicants may only `create` an `admissions` document when:
   - `admissionId` matches `^[a-zA-Z0-9_\-]+$` and equals `incoming().id`
   - `status` is strictly `'pending'` and `adminNote` is `''` (no self-approval)
   - Required fields (`studentName`, `fatherName`, `department`, `className`, `mobile`, `address`, `trackingId`) pass strict type, regex, and maxLength bounds
   - `createdAt == request.time` and `updatedAt == request.time`
   - Exact allowlist of keys (`hasAll` + `hasOnly`) prevents shadow fields.
5. **Immutable Timestamps & Keys**: `createdAt` on `admissions` cannot change on admin updates (`incoming().createdAt == existing().createdAt`). `updatedAt` must always equal `request.time`.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated CMS Write**: Anonymous `setDoc` on `cms_sections/siteSettings` -> DENIED.
2. **Non-Admin Signed-In CMS Write**: Signed-in non-admin user updating `cms_notices/n1` -> DENIED.
3. **Email Spoofing Attack**: Signed-in user with `email == 'kmdfoysal693@gmail.com'` and `email_verified == false` -> DENIED.
4. **Privilege Escalation**: Non-admin attempting `setDoc` on `/admins/{theirUid}` -> DENIED.
5. **Public Admission Read / Scrape**: Unauthenticated or non-admin `getDocs(collection(db, 'admissions'))` -> DENIED.
6. **Self-Approved Admission Create**: Public `create` on `admissions/adm1` with `status: 'approved'` -> DENIED.
7. **Shadow Field Injection**: Public `create` on `admissions/adm1` injecting extra field `isAdminApproved: true` -> DENIED (`hasOnly` check).
8. **ID Poisoning**: Creating document with 500-char ID or invalid characters -> DENIED (`isValidId`).
9. **Resource Exhaustion / 1MB String**: Creating `admissions/adm1` with a 10KB `studentName` -> DENIED (`.size() <= 160`).
10. **Invalid Bangladeshi Mobile Pattern**: Creating `admissions/adm1` with `mobile: 'invalid'` -> DENIED (`matches('^01[3-9][0-9]{8}$')`).
11. **Temporal Forgery**: Admin or applicant writing fake past `updatedAt` timestamp -> DENIED (`updatedAt == request.time`).
12. **Admin UI Config Tampering**: Non-admin writing to `admin_ui/dashboard_config` -> DENIED.
