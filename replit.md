# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the **OptiLife ERP** application — a full ERP system for OptiLifeWellbeing, built with React + Vite frontend and Express + Drizzle backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS v4 + wouter (routing) + recharts (charts)
- **Auth**: JWT (jose) + httpOnly cookies (`optilife_token`)
- **Build**: esbuild (API server CJS bundle)

## Artifacts

### `artifacts/optilife` — Frontend (port from `PORT` env, currently 18924)
- React + Vite SPA at preview path `/`
- Tailwind CSS v4 with green OptiLife theme (primary: `hsl(170,42%,40%)`, sidebar: `hsl(170,42%,30%)`)
- Routing via `wouter` — all routes in `src/App.tsx`
- Pages: Login, Dashboard, Products, Customers, Orders, OrderDetail, NewOrder, Purchases, SalesReport, Users
- Auth state via `src/hooks/useMe.ts` (global cache + listener pattern)
- Vite proxy: `/api` → `http://localhost:8080`

### `artifacts/api-server` — Backend (port 8080)
- Express API at `/api/*`
- JWT auth via `jose`, bcrypt passwords, httpOnly cookie
- Routes: `/auth/*`, `/products`, `/customers`, `/orders`, `/purchases`, `/users`, `/dashboard`, `/sales-report`
- Drizzle ORM connected to PostgreSQL via `DATABASE_URL`

### `lib/db` — Shared DB package (`@workspace/db`)
- Drizzle schema: `users`, `products`, `customers`, `orders`, `order_items`, `purchases`
- UUID primary keys via `gen_random_uuid()`
- Enums: `role` (ADMIN/USER), `order_status`

## Auth

- **First-run bootstrap**: there is no built-in default admin. On a fresh deploy
  the first signup at `/signup` becomes ADMIN with all permissions; subsequent
  signups are USER with empty permissions (admin can promote them via `/users`).
- Alternatively, run `pnpm --filter @workspace/api-server seed` with
  `ADMIN_USERNAME` and `ADMIN_PASSWORD` (≥12 chars) env vars set to seed an
  admin from the shell.
- **JWT secret**: required from `JWT_SECRET` Replit secret — there is no dev
  fallback; the API server will refuse to start without it.
- ADMIN role has full access; USER role uses the `permissions[]` array.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
