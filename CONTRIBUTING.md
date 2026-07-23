# Contributing to Haelf Nutrition

Thank you for contributing. Keep changes focused, privacy-conscious, and compatible with the project's offline-first design.

## Before starting

- Search existing [issues](https://github.com/jacky620141760/Haelf-Nutrition-Tracking/issues).
- Use an issue to discuss large features, schema changes, or security-sensitive work first.
- Report vulnerabilities through the process in [SECURITY.md](SECURITY.md), not in a public issue.

## Development setup

```sh
git clone https://github.com/jacky620141760/Haelf-Nutrition-Tracking.git
cd Haelf-Nutrition-Tracking/haelf-nutrition
npm ci
```

Copy `.env.example` to `.env` and provide your own development Supabase public client configuration. Never commit credentials or real user data.

## Project guidelines

- Keep business rules and calculations in `src/domain/` when possible.
- Keep SQLite access in `src/db/repositories/`.
- Preserve offline behavior and existing database migration compatibility.
- Enforce user ownership in every cloud table, relation, policy, and query.
- Treat barcode and AI responses as untrusted drafts requiring user confirmation.
- Update both English and Traditional Chinese strings for user-facing text.
- Use synthetic data in tests, screenshots, logs, and issue reports.
- Avoid unrelated formatting or refactoring in focused pull requests.

## Validation

Run the complete local check before submitting:

```sh
npm run check
npm run export:web
```

## Pull requests

Describe:

- The problem and proposed solution
- Platforms and scenarios tested
- UI screenshots when behavior is visible
- Database, synchronization, privacy, or security impact
- Any follow-up work or known limitations

Schema changes must include a forward migration strategy and explain compatibility with existing local and cloud data.
