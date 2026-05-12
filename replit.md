# MasonPowers Mail

A self-contained Gmail-like email service for @masonpowers.co email addresses.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/mail run dev` — run the frontend (port 20126)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes to the external Render PostgreSQL

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter + TanStack Query + shadcn/ui
- API: Express 5
- DB: PostgreSQL (Render.com) + Drizzle ORM
- Auth: HttpOnly cookie sessions + bcryptjs password hashing
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (users, emails, sessions)
- `artifacts/api-server/src/routes/` — Express route handlers (auth.ts, emails.ts)
- `artifacts/api-server/src/lib/auth.ts` — session management, password hashing
- `artifacts/mail/src/` — React frontend

## Architecture decisions

- Sessions are stored in the `sessions` table as random tokens in HttpOnly cookies (30-day expiry)
- All email addresses are `username@masonpowers.co` — domain is hardcoded
- Sending an email creates two records: one in the sender's "sent" folder, one in the recipient's "inbox" (if they exist on the platform)
- External DB (Render.com) is connected via `POSTGRES_URL` secret with SSL required
- `drizzle.config.ts` appends `?sslmode=require` to the connection URL for drizzle-kit push

## Product

- Home page: create your @masonpowers.co email address with real-time username availability check
- Login page: sign in with username and password
- Inbox: three-panel layout — folder sidebar, email list, email detail panel
- Folders: Inbox (unread count), Starred, Sent, Drafts, Trash
- Compose: send emails to any @masonpowers.co address, save drafts, reply to messages
- Star/unstar, move to trash, mark read/unread

## User preferences

- Domain: masonpowers.co
- External PostgreSQL at Render.com (POSTGRES_URL secret)
- Self-contained — no external email APIs (SMTP, etc.)

## Gotchas

- `POSTGRES_URL` must be set as a Replit secret — the DB connection requires SSL
- `DATABASE_URL` is runtime-managed by Replit and points to the Replit DB (used for Replit publish flow). `POSTGRES_URL` is the external Render DB used at runtime.
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- The `drizzle.config.ts` appends `?sslmode=require` to make drizzle-kit push work with Render

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
