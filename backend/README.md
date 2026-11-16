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

The migration seeds the built-in roles and active ticket categories. New users
can register as Requesters. Internal roles must be assigned by an administrator
through the database; public registration cannot choose an internal role.

## API

All application endpoints use the `/api/v1` prefix. Authentication uses an
HttpOnly, SameSite=Lax session cookie.

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Public; creates a Requester |
| `POST` | `/api/v1/auth/login` | Public |
| `POST` | `/api/v1/auth/logout` | Clears the session cookie |
| `GET` | `/api/v1/auth/me` | Authenticated |
| `GET` | `/api/v1/categories` | Public; active categories |
| `GET` | `/api/v1/tickets` | Authenticated; scope depends on role |
| `POST` | `/api/v1/tickets` | Requester |
| `GET` | `/api/v1/tickets/:id` | Authenticated; scope depends on role |

Requesters can only read their own tickets. Technicians can only read tickets
assigned to them. Supervisors and Admins can read all tickets. Ticket priority
is calculated by the backend from the submitted `impact` and `urgency`.

Assignment, comments, and ticket workflow transitions are not implemented yet.
