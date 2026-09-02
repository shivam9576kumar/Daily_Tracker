# DSA Study Planner 🧠

An AI-powered full-stack application for systematic DSA (Data Structures & Algorithms) study with spaced repetition, progress tracking, and smart scheduling.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript, Vite, Zustand, React Router |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL + Prisma ORM |
| **AI** | Google Gemini API |
| **Auth** | Google OAuth 2.0 + JWT |

## Project Structure

```
dsa-study-planner/
├── frontend/          # React + Vite SPA
├── backend/           # Express API server
├── shared/            # Shared types, enums, constants
├── .env               # Environment variables (not committed)
└── package.json       # Root workspace config
```

## Prerequisites

- **Node.js** >= 18
- **PostgreSQL** installed and running locally
- **Google Cloud** project with OAuth 2.0 credentials
- **Gemini API** key

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd dsa-study-planner
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Key variables to set:
- `DATABASE_URL` — Your PostgreSQL connection string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth credentials
- `GEMINI_API_KEY` — Google AI API key

### 3. Setup Database

```bash
# Create the database
createdb dsa_study_planner

# Run Prisma migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

### 4. Start Development

```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run dev:frontend   # http://localhost:5173
npm run dev:backend    # http://localhost:3001
```

### 5. Prisma Studio (Database GUI)

```bash
npm run db:studio
```

## Key Features

- ✅ Google OAuth login
- ✅ Dashboard with status overview, vibe banner, today's hitlist
- ✅ Right drawer with task details, notes, rating flow
- ✅ Spaced repetition (Easy/Medium/Hard → dynamic revision schedule)
- ✅ Re-rate & undo with automatic revision management
- ✅ Heatmap + circular topic progress
- ✅ Weekly roadmap with expandable cards
- ✅ AI study slot suggestions from PDF timetable
- ✅ Natural language plan generation
- ✅ Midnight cron for backlog/expiry
- ✅ Dark/light mode, responsive, optimistic UI

## API Endpoints

```
GET    /api/health
GET    /api/auth/google
GET    /api/auth/google/callback
GET    /api/dashboard/today
GET    /api/tasks
POST   /api/tasks/:id/complete
POST   /api/tasks/:id/rate
POST   /api/tasks/:id/undo
POST   /api/plans/generate
POST   /api/timetable/upload
GET    /api/progress/heatmap
...and more
```

## License

MIT
