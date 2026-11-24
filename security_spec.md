# DR BOLDIN DATA SUB Security Specification

## 1. Data Invariants
1. A user profile (`users/{userId}`) can only be created by the verified owner (`request.auth.uid == userId`), initialized with `role: 'user'`, `status: 'active'`, `walletBalance: 0`, and `bonusBalance: 0`.
2. Users cannot escalate their `role`, reactivate a `suspended` account, or inject shadow fields.
3. Referral records (`referrals/{referralId}`) cannot reference the user as their own referrer (`referrerId != referredUserId`), and transition strictly from `pending` -> `credited` by the referrer or admin.
4. Data plans (`dataPlans/{planId}`) and API connections (`apiConnections/{connId}`) can only be written by verified administrators.
5. Transactions (`transactions/{txId}`) and wallet deposits (`walletDeposits/{depositId}`) are strictly isolated to the owning user (`userId == request.auth.uid`) or verified administrator; terminal `SUCCESS` or `FAILED` transactions cannot be altered by non-admins.
6. Support tickets (`supportTickets/{ticketId}`) can be created only by their owner with initial status `OPEN` and empty `adminReply`, and only admins can post `adminReply` or resolve tickets.
7. All `createdAt` and `updatedAt` timestamps must match `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Role Escalation on Signup**: `users/{uid}` create with `{ role: 'admin', walletBalance: 0 }` -> `PERMISSION_DENIED`.
2. **Wallet Inflation on Signup**: `users/{uid}` create with `{ role: 'user', walletBalance: 500000 }` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection**: `users/{uid}` update with `{ fullName: 'Test', isAdmin: true }` -> `PERMISSION_DENIED`.
4. **Email Spoofing Admin Bypass**: Request with `email: 'abdulwahhabumar698@gmail.com'` and `email_verified: false` reading `apiConnections` -> `PERMISSION_DENIED`.
5. **PII Cross-User Read**: User B reading `users/{userA}` -> `PERMISSION_DENIED`.
6. **Unauthorized Query Scraping**: User B listing `transactions` without `userId == userB` filter -> `PERMISSION_DENIED`.
7. **Self-Referral Fraud**: `referrals/{id}` create with `referrerId == referredUserId` -> `PERMISSION_DENIED`.
8. **Non-Owner Transaction Creation**: User A creating `transactions/{id}` with `userId: userB` -> `PERMISSION_DENIED`.
9. **Terminal Transaction Tampering**: User A updating `transactions/{id}` from `SUCCESS` back to `PENDING` -> `PERMISSION_DENIED`.
10. **Non-Admin Plan Price Manipulation**: Regular user updating `dataPlans/{id}` `sellingPrice: 1` -> `PERMISSION_DENIED`.
11. **Oversized ID Poisoning**: Document ID > 128 chars or containing invalid symbols -> `PERMISSION_DENIED`.
12. **Client Timestamp Forgery**: Creating a transaction with backdated `createdAt` (`!= request.time`) -> `PERMISSION_DENIED`.
