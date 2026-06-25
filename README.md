# DTR Management System

A production-ready MVP **Daily Time Record (DTR) Management System** for offices, schools, businesses, agencies, and other organizations.
Full-stack monorepo: React 19 + TypeScript + Vite frontend, Node/Express + Prisma backend, and PostgreSQL.

## Features

- **Authentication** - JWT, role-based Admin / HR access, protected routes
- **Dashboard** - KPIs and weekly/monthly attendance charts
- **Employee Management** - CRUD, search, pagination, shift assignment
- **Shift Management** - configurable AM/PM schedule, grace minutes, and OT start/end
- **Attendance** - manual entry, edit, delete, and device-synced logs
- **DTR Computation** - first scan as IN, latest scan as OUT, total hours, late, undertime, OT
- **Reports** - daily / weekly / monthly, export to PDF and Excel
- **Printable DTR Form** - Service Form No. 48 style, Letter/Long paper, one or two forms per page
- **Device Integration** - device CRUD, test connection, attendance receiver endpoint, optional log sync

The system works fully **without any biometric device connected**.

## Quick Start

Install and start PostgreSQL on your machine first, then run the local setup once:

```bat
setup-postgres.cmd
```

After that, start the app:

```bat
start.cmd
```

Then open:

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

`start.cmd` installs missing dependencies, runs Prisma migrations, seeds the database, and starts the backend/frontend dev servers.

## Default Login

| Username | Password   | Role  |
|----------|------------|-------|
| `admin`  | `admin123` | ADMIN |

## Device Attendance Endpoint

```http
POST http://localhost:3000/api/device/attendance
Content-Type: application/json

{
  "employeeId": "1001",
  "timestamp": "2026-06-09T08:00:00",
  "deviceId": "1",
  "verificationType": "FACE"
}
```

`employeeId` matches the employee's **Employee Number**. The endpoint stores the raw log and the DTR uses the oldest scan of the day as Time In and the latest scan as Time Out.

## Local Development

```bash
# backend
cd backend
npm install
copy .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev

# frontend
cd frontend
npm install
npm run dev
```

## Project Structure

```text
.
|-- setup-postgres.cmd
|-- start.cmd
|-- start-fast.cmd
|-- stop.cmd
|-- backend/
|   |-- prisma/
|   |   |-- schema.prisma
|   |   |-- migrations/
|   |   `-- seed.ts
|   `-- src/
|       |-- index.ts
|       |-- middleware/
|       |-- routes/
|       `-- utils/
`-- frontend/
    `-- src/
        |-- api/
        |-- components/
        |-- context/
        |-- pages/
        `-- ...
```

## Default Schedule

- Standard work day: **08:00 - 17:00**
- Lunch break: **12:00 - 13:00**
- Late = minutes after shift Time In
- Undertime = minutes before shift Time Out
- OT = minutes after configured OT start
