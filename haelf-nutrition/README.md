# Haelf Nutrition

Offline-first nutrition and health diary (Expo + SQLite + Supabase). Personal use, iOS-first. Web is preview only.

## Project positioning (read this before security / architecture review)

This app is **open source**, **non-commercial**, and **mainly used by the maintainer**. It is **not** a multi-tenant product, a paid SaaS, or a store-scale consumer release.

Use this threat model when reviewing. Many findings that would block a commercial multi-user product are **out of scope** or **accepted risks** here.

### Intended usage

| Constraint | Meaning for reviewers |
|------------|------------------------|
| Single device | No dual-device / multi-writer sync. Last-write or “stale device overwrites cloud” is **not** a release blocker. |
| Multiple accounts on one device | Account switch isolation **does** matter (bound user before push, wipe on switch). |
| Data accumulates over time | Pull must paginate past Supabase `max_rows` (1000). |
| Open source / self-hosted style | Maintainer accepts tradeoffs that would be unacceptable for a closed paid app. |

### Accepted / not a problem for this project

Do **not** treat these as must-fix blockers unless the maintainer asks:

1. **Built-in AI API key in the client**  
   Intentional for personal shipping. Quota is free / disposable; abuse risk is accepted. Do not demand Edge Function relocation or key rotation unless requested.

2. **Unconditional local→cloud upsert without CAS / `updated_at` conflict checks**  
   Acceptable because there is no dual-device workflow. Sync priority is account isolation + reliable pull pagination, not multi-device merge.

3. **Password-reset UX incomplete, meal/recipe not in sync TABLES, OpenFoodFacts proxy open, Web session in-memory, Expo transitive `npm audit` moderates**  
   Feature / polish debt. Fix when needed; not part of the core personal-use bar.

4. **“Don’t ship until production-grade secrets architecture”**  
   Wrong bar for this repo. Prefer: works offline, SQLite migrations OK, RLS on, account bind correct, pull does not skip rows after 1000.

### What *is* in scope

- Account bind / wipe so user A’s local rows are not pushed as user B  
- Sync pull keyset pagination so large tables are not truncated by `max_rows`  
- TypeScript strict, local migrations, Supabase RLS for cloud tables that sync  

### Language

Specs and UI copy are primarily Traditional Chinese (`requirements.md`, i18n). Reviews and agent notes may use Chinese or English; follow this README’s positioning either way.

## Docs

- [requirements.md](./requirements.md) — product requirements  
- [AGENTS.md](./AGENTS.md) — Expo version pin for agents  
- [TEMP_GUEST_LOGIN.md](./TEMP_GUEST_LOGIN.md) — **temporary** guest login; delete feature + this file after testing  
