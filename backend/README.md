# IT Helpdesk Backend

NestJS API with Prisma and PostgreSQL. Local development settings are loaded
from `backend/.env`; configure `DATABASE_URL` and a random
`AUTH_SESSION_SECRET` of at least 32 bytes before starting the API.

## Setup

```powershell
npm ci
npx prisma validate --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npm run start:dev
```

The migrations seed built-in roles and active ticket categories. Test accounts
are created with `npm run db:seed` on a disposable local database. Public account
registration is disabled; accounts and roles are provisioned internally.

## API

All application endpoints use the `/api/v1` prefix. Authentication uses an
HttpOnly, SameSite=Lax session cookie.

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/api/v1/auth/login` | Public |
| `POST` | `/api/v1/auth/logout` | Clears the session cookie |
| `GET` | `/api/v1/auth/me` | Authenticated |
| `GET` | `/api/v1/categories` | Public; active categories |
| `GET` | `/api/v1/tickets` | Authenticated; scope depends on role |
| `POST` | `/api/v1/tickets` | Requester |
| `GET` | `/api/v1/tickets/:id` | Authenticated; scope depends on role |
| `GET` | `/api/v1/tickets/:id/activity` | Requester who owns the Ticket; public activity only |
| `POST` | `/api/v1/tickets/:id/comments` | Requester who owns an open Ticket |
| `POST` | `/api/v1/tickets/:id/close` | Requester who owns a resolved Ticket |
| `POST` | `/api/v1/tickets/:id/reopen` | Requester who owns a resolved Ticket, within 72 hours |

Requesters can only read their own tickets. Technicians can only read tickets
assigned to them. Supervisors can read all tickets. ADMIN alone has no Ticket
access. Ticket priority is calculated by the backend from `impact` and `urgency`.

The Requester activity endpoint filters `visibility=PUBLIC`; internal notes are
never returned to Requesters. Comment and close/reopen actions require the
Ticket's current integer `version` in the JSON body to reject stale concurrent
requests. Reopen also requires a `reason` (3–2000 characters). A Backend sweep
automatically closes resolved Tickets 72 hours after `resolvedAt`, at startup
and once per minute while the API runs. Assignment and Technician/Supervisor
workflow transitions remain with their respective modules. Reopening returns an
assigned Ticket to `ASSIGNED`, or an unassigned Ticket to `TRIAGED`.
