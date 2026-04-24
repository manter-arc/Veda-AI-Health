# Firebase Security Specification

## 1. Data Invariants
- A user can only access their own profile (`/users/{userId}`).
- A user can only access their own subcollections (journal, reminders, records, family, policies, appointments).
- Email verification is required for all write operations.
- Admin access (Google user `m93025641@gmail.com`) is allowed for all collections.
- Terminal states (e.g., deleted or completed status) may prevent further updates (where applicable).
- Timestamps (`createdAt`, `updatedAt`) must be server-validated.

## 2. The "Dirty Dozen" Payloads (Identity & Integrity Attack Surface)

### A. Identity Spoofing
1. **Payload**: `{"uid": "ATTACKER_ID", "email": "victim@example.com"}` to `/users/VICTIM_ID` (Create)
   - **Expected**: PERMISSION_DENIED
2. **Payload**: `{"ownerId": "VICTIM_ID"}` to `/users/ATTACKER_ID/journal/entry1` (Update ownerId)
   - **Expected**: PERMISSION_DENIED

### B. Privilege Escalation
3. **Payload**: `{"role": "admin"}` to `/users/ATTACKER_ID` (Update role)
   - **Expected**: PERMISSION_DENIED

### C. Resource Poisoning (Denial of Wallet)
4. **Payload**: `{"title": "A" * 1048576}` (1MB string) to `/users/ATTACKER_ID/records/record1`
   - **Expected**: PERMISSION_DENIED
5. **Payload**: `{"entryId": "../../../etc/passwd"}` (Path traversal attempt in code-level ID)
   - **Expected**: PERMISSION_DENIED (via `isValidId` and document placement)

### D. Relational Orphans
6. **Payload**: `{"patientId": "NON_EXISTENT_USER"}` to `/users/ATTACKER_ID/appointments/appt1` (Create)
   - **Expected**: PERMISSION_DENIED (relational check)

### E. Timestamp Manipulation
7. **Payload**: `{"createdAt": "2000-01-01T00:00:00Z"}` (Client-provided old timestamp)
   - **Expected**: PERMISSION_DENIED

### F. Terminal State Bypass
8. **Payload**: Changing status from `completed` back to `pending`.
   - **Expected**: PERMISSION_DENIED

### G. PII Leakage
9. **Payload**: Authenticated user trying to `get` another user's email directly.
   - **Expected**: PERMISSION_DENIED

### H. Collection Scraping
10. **Payload**: Authenticated user trying to `list` the `/users` collection without a `where` clause matching their ID.
    - **Expected**: PERMISSION_DENIED

### I. shadow Field Injection
11. **Payload**: `{"name": "John", "isVerified": true, "extraSecret": "XYZ"}` to `/users/ATTACKER_ID`
    - **Expected**: PERMISSION_DENIED (via `affectedKeys().hasOnly()`)

### J. List Type Poisoning
12. **Payload**: `{"conditions": [123, true]}` (Arrays containing invalid types)
    - **Expected**: PERMISSION_DENIED

## 3. Test Runner (Draft)
A `firestore.rules.test.ts` will be implemented to verify these constraints.
