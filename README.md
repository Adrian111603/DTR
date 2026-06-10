# DTR Management System (LGU)

A production-ready MVP **Daily Time Record (DTR) Management System** for a Local Government Unit.
Full-stack monorepo: React 19 + TypeScript + Vite (frontend), Node/Express + Prisma (backend), PostgreSQL, Docker.

## Features

- **Authentication** — JWT, role-based (Admin / HR), protected routes
- **Dashboard** — KPIs + weekly/monthly attendance charts
- **Employee Management** — CRUD, search, pagination
- **Attendance** — manual entry (Time In / Time Out), edit, delete
- **DTR Computation** — total hours, late minutes, undertime
- **Reports** — daily / weekly / monthly, export to PDF & Excel
- **Device Integration** — device CRUD, test connection, biometric attendance receiver endpoint

The system works fully **without any biometric device connected**.

## Quick Start

```bash
docker compose up -d
```

Then open:

- Frontend: http://localhost:5173
- Backend:  http://localhost:3000

Migrations + seed run automatically on backend startup.

### Default Login

| Username | Password   | Role  |
|----------|------------|-------|
| `admin`  | `admin123` | ADMIN |

## Device Attendance Endpoint (works via Postman)

```
POST http://localhost:3000/api/device/attendance
Content-Type: application/json

{
  "employeeId": "1001",
  "timestamp": "2026-06-09T08:00:00",
  "deviceId": "1",
  "verificationType": "FACE"
}
```

`employeeId` matches the employee's **Employee Number**. The endpoint stores the log
and auto-assigns event type (TIME_IN / TIME_OUT) based on existing logs for that day.

## Local Development (without Docker)

```bash
# backend
cd backend
npm install
cp .env.example .env   # adjust DATABASE_URL to your local postgres
npx prisma migrate dev
npx prisma db seed
npm run dev

# frontend
cd frontend
npm install
npm run dev
```

## Project Structure

```
.
├── docker-compose.yml
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── src/
│       ├── index.ts
│       ├── middleware/
│       ├── routes/
│       └── utils/
└── frontend/
    └── src/
        ├── api/
        ├── components/
        ├── context/
        ├── pages/
        └── ...
```

## Default Schedule (DTR computation)

- Standard work day: **08:00 – 17:00** (9 hrs incl. 1 hr lunch → 8 working hrs)
- Late = minutes after 08:00 on Time In
- Undertime = minutes before 17:00 on Time Out
