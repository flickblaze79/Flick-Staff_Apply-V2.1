# Security Specification: Flick Staff Apply V2.1

## 1. Data Invariants
- Users: UID must match Auth UID. Role cannot be self-assigned.
- Applications: Applicant must own the application (applicantUid). Status updates only by Staff.
- Reports: Author must own the report.
- Settings: Only Owner/Admin can write to settings.

## 2. The "Dirty Dozen" Payloads (Examples)
1. { "role": "OWNER" } - Attempt to upgrade own role.
2. { "isSuspended": true } - Attempt to suspend own account.
3. { "applicantUid": "other-user-uid" } - Attempt to create app as someone else.
4. { "status": "Accepted" } - Attempt to approve own application.
5. { "subject": "<script>alert(1)</script>" } - XSS attempt.
6. { "authorUid": "other-user-uid" } - Attempt to create report as someone else.
7. { "read": true } - Attempt to update notification of another user.
8. { "role": "ADMIN" } - Update other user profile role.
9. { "foo": "bar" } - Shadow field injection.
10. { "createdAt": "2000-01-01" } - Attempt to spoof createdAt.
11. { "description": "very long string..." } - ID/Field poisoning.
12. { "role": "USER" } - Attempt to change role on create.

## 3. Test Runner (Conceptual)
A complete `firestore.rules.test.ts` will verify these payloads return PERMISSION_DENIED.
