# TEMP: Guest login (delete after testing)

Temporary onboarding test helper. **Remove this entire feature when done testing**, then delete this file.

## What it does

- Login screen button:「臨時訪客（從頭測試）」
- Wipes local SQLite and restarts goals → AI → steps onboarding
- Auth: try Supabase **Anonymous** first; otherwise reuse fixed account `haelf.guest@example.com` / `HaelfGuestTest1!` (sign-in, not a new email each tap)
- Shown in `__DEV__`, or when `EXPO_PUBLIC_ENABLE_GUEST_LOGIN=true`

## If guest fails with email rate limit

1. Prefer: Supabase Dashboard → Authentication → Providers → enable **Anonymous**
2. Or wait for the signup email rate limit to cool down, then tap guest **once** so the fixed account can be created
3. Or manually create user `haelf.guest@example.com` with password `HaelfGuestTest1!` in Auth → Users

## Files touched (revert checklist)

### Remove entirely / undo these hunks

| File | What to remove |
|------|----------------|
| [src/services/auth/client.ts](src/services/auth/client.ts) | `GUEST_EMAIL` / `GUEST_PASSWORD` / entire `signInAsGuest()` |
| [src/context/AuthContext.tsx](src/context/AuthContext.tsx) | `signInAsGuest` import; `clearAllAppTables` import if unused; `signInGuest` on type / implementation / `value` / deps |
| [app/(auth)/login.tsx](app/(auth)/login.tsx) | `GUEST_LOGIN_ENABLED`, `signInGuest`, `onGuest`, guest `MfpButton`; restore `MfpButton` import only if still needed |
| [src/i18n/zh-TW.ts](src/i18n/zh-TW.ts) | `auth.guestLogin` |
| [src/i18n/en.ts](src/i18n/en.ts) | `auth.guestLogin` |
| [.env.example](.env.example) | `EXPO_PUBLIC_ENABLE_GUEST_LOGIN` comments |
| [.env](.env) (if set) | `EXPO_PUBLIC_ENABLE_GUEST_LOGIN` |
| [supabase/config.toml](supabase/config.toml) | Set `enable_anonymous_sign_ins = false` **only if** you enabled it solely for this feature |
| **This file** | Delete `TEMP_GUEST_LOGIN.md` |

### Optional remote cleanup

- Supabase Dashboard → Authentication → Providers → turn off **Anonymous** if you only enabled it for guest testing
- Auth users: delete anonymous users and/or `haelf.guest@example.com` / old `guest-*@haelf.guest` accounts

## Quick verify after removal

1. Login screen has no guest button
2. `rg -n "signInGuest|signInAsGuest|guestLogin|ENABLE_GUEST|haelf.guest@example.com" .` returns nothing (except maybe unrelated words)
3. App still signs in / registers normally
