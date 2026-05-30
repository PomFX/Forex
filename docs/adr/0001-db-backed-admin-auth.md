# 0001 — DB-Backed Admin Authentication

Context: The original admin auth used hardcoded env vars (`ADMIN_EMAIL` + `ADMIN_PASSWORD`) which limits the system to a single admin. The user wants to support multiple admins.

Decision: Add an `is_admin BOOLEAN DEFAULT false` column to the `users` table. The login route checks both the env-var super admin AND the database `is_admin` flag. The env-var admin remains as a "break glass" super admin that cannot be deleted or demoted.

This approach was chosen over a separate `admins` table because:
- Simpler schema — no join needed
- A user account is already required to log in as admin
- Easy to promote/demote via the existing members management UI

The rejected alternative was a separate `admins` table with its own roles, which would be more secure but introduces unnecessary complexity for this use case.
