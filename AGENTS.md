# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Snapshot
- Stack: Expo + React Native (JavaScript), React Navigation native stack.
- Entry point: `App.js`.
- Auth flow: token/user persisted with AsyncStorage, route switch in `RootNavigator`.
- API: fetch-based client in `src/api/client.js`.

For product-level context and backend contract, see [README.md](README.md).

## Fast Start
- Install: `npm install`
- Dev server: `npm start`
- Device targets: `npm run android`, `npm run ios`, `npm run web`

## Code Layout
- `App.js`: app providers + navigation gate (loading/authenticated/unauthenticated).
- `src/context/AuthContext.js`: session restore, sign-in/sign-out, persisted auth state.
- `src/api/client.js`: backend requests and response validation.
- `src/screens/LoginScreen.js`: credentials UI + sign-in action.
- `src/screens/DashboardScreen.js`: post-login UI and sign-out entrypoint.

## Conventions To Preserve
- Use functional components and React hooks only.
- Keep networking logic inside `src/api/*`, not directly in screens.
- Keep auth/session behavior inside `AuthContext`; screens should call context methods.
- Match existing style patterns:
  - double quotes
  - semicolons
  - `StyleSheet.create` for styles
  - clear color constants inline (project currently does not centralize theme tokens)
- Prefer small, focused edits; avoid broad UI restyling unless explicitly requested.

## Behavior-Critical Notes
- Login backend URL is currently hardcoded in `src/api/client.js`; avoid changing it unless requested.
- `loginRequest` parses raw text then JSON and throws user-facing errors on invalid payloads; preserve this defensive pattern.
- Auth token fallback (`"logged-in"`) is used when backend token fields are missing; do not remove without updating auth expectations.
- `AuthProvider` controls initial loading state; keep `isLoading` flow intact to avoid navigation flicker.

## Validation Checklist After Changes
- Run `npm start` and ensure app boots without red screen errors.
- Verify auth flow end-to-end:
  - logged-out users see Login
  - successful login navigates to Dashboard
  - Sign out returns to Login
- If API-related files changed, ensure failed/invalid JSON responses still surface useful errors.

## Current Gaps (Do Not Assume)
- No test scripts are defined in `package.json`.
- No lint/format scripts are defined in `package.json`.
- No TypeScript setup.

When adding new automation (tests/lint), add scripts in `package.json` and document usage in [README.md](README.md).
