# Open-source security review

Date: 2026-07-23

This review covers repository secret hygiene, Supabase row-level security, and the unauthenticated Open Food Facts Edge Function. It is a point-in-time engineering review, not a guarantee of production security.

## Secret hygiene

- `.env` and `.env.vm` are ignored.
- `.env.example` and `.env.vm.example` contain placeholders only.
- Gitleaks 8.30.1 scanned all six reachable Git commits, current tracked changes, and untracked non-ignored files.
- No leaks were detected, so no credential rotation was required by this review.

Always revoke and rotate a credential if later evidence shows that it was exposed.

## Supabase row-level security

All application tables in `haelf-nutrition/supabase/schema.sql` enable RLS and apply authenticated owner checks for select, insert, update, and delete operations. No direct cross-user read or write policy was identified.

Before production deployment:

- Add explicit update `WITH CHECK (user_id = auth.uid())` clauses for clarity and defense in depth.
- Bind `saved_meal_items` to `saved_meals` and `recipe_ingredients` to `recipes` with tenant-aware composite foreign keys that include `user_id`.
- Add two-user integration tests proving that one account cannot read, create, update, or delete records associated with another account.
- Re-run this review whenever tables, policies, functions, or service-role workflows change.

The tenant-aware foreign-key change can affect existing cloud data and should be deployed through a reviewed migration after validating current rows.

## Public Edge Function

`off-search` is intentionally configured with `verify_jwt = false`. Its upstream host is fixed, so no server-side request-forgery route was identified. However, anonymous callers can consume function and upstream resources.

Before production deployment:

- Allow only `GET` and `OPTIONS`.
- Normalize input and enforce a maximum query length.
- Add upstream timeouts, response-size limits, caching, rate limiting, and monitoring.
- Return generic client errors while keeping detailed diagnostics in server logs.
- Restrict CORS to production web origins if browser access does not require a wildcard.
- Reconsider anonymous access if signed-in-only barcode search is acceptable.

These controls depend on deployment requirements, expected traffic, and allowed origins; they are intentionally not changed by this documentation-only review.

## Dependency review

`npm audit` currently reports moderate transitive findings in Expo SDK 54 tooling. The available automated remediation would force a breaking Expo major upgrade, so it should be handled through a planned SDK upgrade rather than `npm audit fix --force`.
