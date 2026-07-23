# Haelf Nutrition

An iOS-first, offline-capable nutrition and health diary built with Expo, React Native, TypeScript, SQLite, and Supabase.

Haelf Nutrition helps users record meals, calories, macronutrients, water, exercise, steps, and weight. Core data is available locally through SQLite, while signed-in users can synchronize supported records with Supabase. The interface supports English and Traditional Chinese.

> [!IMPORTANT]
> This project is under active development. iOS is the primary target. Android may work but is not the current acceptance target, and the web build is a development preview rather than a production deployment.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Supabase setup](#supabase-setup)
- [Running the app](#running-the-app)
- [Validation](#validation)
- [Privacy and security](#privacy-and-security)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

## Features

- Email/password authentication and onboarding with Supabase Auth
- Versioned daily calorie and protein, fat, and carbohydrate goals
- Meal diary grouped by breakfast, lunch, dinner, and snacks
- Manual foods, recent foods, favorites, saved meals, and recipes
- Per-100-gram and per-serving nutrition calculations
- Barcode scanning with local caching and Open Food Facts lookup
- User-initiated AI food analysis through an OpenAI-compatible endpoint
- Water, exercise, step, and weight tracking
- Seven- and thirty-day progress views
- Offline-first SQLite storage with schema migrations and recovery handling
- Supabase synchronization for authenticated users
- English and Traditional Chinese localization
## Technology

| Area | Technology |
| --- | --- |
| App framework | Expo SDK 54, React Native 0.81, React 19 |
| Language | TypeScript with strict mode |
| Navigation | Expo Router with typed routes |
| Local data | Expo SQLite |
| Authentication and cloud data | Supabase Auth and Postgres |
| Device capabilities | Camera, image picker, secure storage, and pedometer |
| Web preview | React Native Web and Metro static output |
| Validation scripts | TypeScript, `tsx`, and `sql.js` |

## Architecture

The app uses an offline-first data flow:

1. Expo Router screens in `haelf-nutrition/app/` call contexts, hooks, and services.
2. Pure calculations and validation live in `haelf-nutrition/src/domain/`.
3. Repositories in `haelf-nutrition/src/db/` persist data to the device SQLite database.
4. Database migrations run during startup before writes are enabled.
5. Authenticated users synchronize supported local records with Supabase Postgres.
6. Open Food Facts requests go through the `off-search` Supabase Edge Function.
7. AI analysis occurs only after a user configures an endpoint and explicitly starts a request. Suggestions remain editable drafts until confirmed.

External barcode and AI results are never written directly to the diary. The user must review and confirm them first.

## Repository layout

```text
.
├── README.md                     # Project documentation
├── LICENSE                       # MIT license
└── haelf-nutrition/
    ├── app/                      # Expo Router routes and layouts
    ├── assets/                   # App icons, splash images, and fonts
    ├── scripts/                  # Domain/repository checks and VM helpers
    ├── src/
    │   ├── components/           # Reusable application UI
    │   ├── context/              # Application and authentication state
    │   ├── db/                   # SQLite setup, migrations, repositories
    │   ├── domain/               # Pure business rules and calculations
    │   ├── hooks/                # Shared React hooks
    │   ├── i18n/                 # English and Traditional Chinese strings
    │   └── services/             # Workflows and external integrations
    ├── supabase/
    │   ├── functions/off-search/ # Open Food Facts proxy
    │   ├── config.toml           # Local Supabase configuration
    │   └── schema.sql            # Cloud database schema and policies
    ├── .env.example              # Safe client configuration template
    ├── app.json                  # Expo application configuration
    └── package.json              # Dependencies and npm scripts
```

## Prerequisites

- [Node.js](https://nodejs.org/) 22 LTS and npm
- Git
- An iOS device with Expo Go, or macOS with Xcode/iOS Simulator
- A Supabase project for authentication, cloud sync, and food search
- Optional: Android Studio for Android development
- Optional: Docker and the Supabase CLI for local backend development

The application may start without valid Supabase values, but account, synchronization, and remote food-search features require them.

## Getting started

1. Clone the repository and enter the Expo application directory:

   ```sh
   git clone <repository-url>
   cd <repository-directory>/haelf-nutrition
   ```

2. Install the locked dependencies:

   ```sh
   npm ci
   ```

3. Create a local environment file.

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   macOS/Linux:

   ```sh
   cp .env.example .env
   ```

4. Set the two public Supabase client values in `.env`:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```

Obtain these values from the Supabase project API settings. Variables beginning with `EXPO_PUBLIC_` are bundled into the client application; never place a service-role key, database password, AI key, or other private credential in them.
## Supabase setup

### Hosted project

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run `haelf-nutrition/supabase/schema.sql`. Review the SQL before executing it against an existing project.
3. Install the Supabase CLI, authenticate, and link the repository to your project:

   ```sh
   supabase login
   supabase link --project-ref <project-ref>
   ```

4. Deploy the Open Food Facts proxy:

   ```sh
   cd haelf-nutrition
   supabase functions deploy off-search --no-verify-jwt
   ```

   If the shell is already in `haelf-nutrition/`, omit the `cd` command.

5. Copy the project URL and anon key into `haelf-nutrition/.env`, then restart Expo.

The included schema enables row-level security so signed-in users can access only their own synchronized records. The `off-search` function is intentionally callable without a user JWT so barcode search can use the public client configuration. Before a production rollout, add suitable rate limiting, monitoring, and abuse protection.

### Local Supabase

`haelf-nutrition/supabase/config.toml` is included for Supabase CLI development. The canonical schema currently lives in `supabase/schema.sql`; a fully automated migration/seed workflow has not yet been added. Avoid assuming `supabase db reset` is authoritative until migration and seed files are introduced.

## Running the app

Run commands from `haelf-nutrition/`.

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Expo development server |
| `npm run ios` | Start Expo and open iOS |
| `npm run android` | Start Expo and open Android |
| `npm run web` | Start the development-only web preview |
| `npm run start:tunnel` | Start Expo through an ngrok tunnel |

The start commands are interactive and continue running until stopped. Follow the terminal instructions to open Expo Go, an emulator, or the browser.

### Optional persistent VM tunnel

The repository includes Ubuntu/PM2 helpers in `haelf-nutrition/scripts/vm/`. Copy `.env.vm.example` to `.env.vm`, add an Expo access token, and follow the script comments. `.env.vm` is ignored by Git and must never be committed. A persistent public development tunnel increases exposure; restrict VM access and rotate the token if it is leaked.

## Validation

Run the complete local validation before opening a pull request:

```sh
npm run check
npm run export:web
```

The combined `check` command runs:

- `lint` — Expo ESLint rules
- `typecheck` — strict TypeScript checking without emitted files
- `test` — domain and SQLite repository verification scripts

GitHub Actions runs the same checks and exports the web preview for every pull request and push to `main` or `master`.

## Privacy and security

Haelf Nutrition handles health-related data. Treat every deployment as sensitive even though this project is not a medical device and does not provide medical advice.

- Structured diary data is stored in SQLite on the device.
- Signed-in users may synchronize supported records to their Supabase account.
- Supabase credentials in `EXPO_PUBLIC_*` variables are public client identifiers, not secrets. Security depends on row-level security policies.
- Native AI API keys use Expo Secure Store. The web preview keeps them only in memory because browser storage is not treated as secure.
- AI requests are user initiated and should contain only the selected image or entered description. AI output must be reviewed before saving.
- Barcode lookup sends the search term to the project Edge Function and Open Food Facts.
- Camera, photo-library, and motion permissions are requested only for related features.
- Never commit `.env`, `.env.vm`, signing certificates, service-role keys, database dumps, production exports, or user data.

See [SECURITY.md](SECURITY.md) for private vulnerability reporting and [the security review](docs/SECURITY_REVIEW.md) for the latest repository, Supabase, and Edge Function findings.

## Known limitations

- iOS is the primary supported platform; Android is not the current acceptance target.
- Web is a development preview. Its storage and secret-handling behavior does not represent the native app.
- The app requires a configured Supabase project for account and synchronization workflows.
- Open Food Facts data can be incomplete or inaccurate and must be reviewed by the user.
- AI estimates can be inaccurate and must not be treated as medical or dietary advice.
- Local Supabase migration and seed automation is incomplete.
- Automated verification currently uses focused domain and repository scripts rather than a general test framework.
- App Store and Play Store release automation is outside the current project scope.

Detailed product behavior and acceptance criteria are documented in `haelf-nutrition/requirements.md`.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), search the [issue tracker](https://github.com/jacky620141760/Haelf-Nutrition-Tracking/issues), and submit security findings through GitHub's [private advisory form](https://github.com/jacky620141760/Haelf-Nutrition-Tracking/security/advisories/new).

## License

This project is available under the [MIT License](LICENSE). Third-party packages, data sources, and services remain subject to their own licenses and terms.

