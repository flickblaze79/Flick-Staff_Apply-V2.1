# Security Specification for Flick Staff Apply V2.1

## Data Invariants
1. User Profiles (`users/{userId}`) are owner-only for writes.
2. Applications (`applications/{appId}`) are staff-only for updates, applicant-only for read.
3. Owner role is immutable and derived from a secure list.
4. Cooldown records are staff-only.

## The "Dirty Dozen" Payloads (Examples)
1. User setting their own role to 'OWNER'.
2. User updating another user's profile.
3. Applicant modifying their application status.
4. Unauthorized staff member modifying owner settings.

## Security Rules Test Plan
... [to be implemented in firestore.rules.test.ts]
