# 🚀 PROJECT_CONTEXT.md — Comprehensive Master Architecture & Technical Blueprint

> **Notice for AI Assistants & LLMs**: This file is a complete, single-source-of-truth technical blueprint for the **Daily Tracker & DSA Study Planner** repository (`shivam9576kumar/Daily_Tracker`). It details the system architecture, database schema, core algorithms, state management, question banks, API contracts, and business logic rules.

---

## 📌 1. Executive Summary

**Daily Tracker & DSA Study Planner** is a full-stack, AI-enhanced Data Structures & Algorithms study planner, 4-stage spaced repetition revision scheduler, LeetCode Problem of the Day (POTD) auto-synchronizer, semester class timetable tracker, and gamified CS student dashboard.

### Core Problems Solved:
1. **Burnout & Imbalanced Pacing**: Generates weighted daily problem targets based on weekday/weekend availability, user pace, and upcoming exam/busy days.
2. **Forgetting Curve (Spaced Repetition)**: Automatically schedules 4 revision stages (+1, +3, +7, +14 days) when a user rates a completed problem's difficulty.
3. **Chaotic Student Timetable**: Combines academic class schedules with DSA tasks, supporting a zero-backend 1-tap "Hide for Today" class cancellation feature.
4. **Consistency & Gamification**: Tracks 365-day GitHub-style contribution heatmaps, daily solve streaks, POTD streaks, topic mastery percentages, and coin rewards.

---

## 🏗️ 2. Technology Stack & Monorepo Structure

| Component | Technology | Description |
|---|---|---|
| **Monorepo** | npm workspaces | Packages: `shared`, `backend`, `frontend` |
| **Frontend** | React 18, TypeScript, Vite, Vanilla CSS | Single Page App (SPA) with CSS design tokens, React Router v6, Zustand state stores |
| **Backend** | Node.js, Express.js, TypeScript, Winston | RESTful API server with custom middleware and background cron triggers |
| **Database & ORM** | PostgreSQL, Prisma ORM 5 | Relational database with automated migrations, schema constraints, and indexes |
| **AI Integration** | Google Gemini API (`@google/genai` / SDK) | Natural language study plan prompt parser and interactive AI chat planner |

### Workspace Directory Layout:

```text
Daily_Tracker/
├── package.json                         # Monorepo root workspace configuration
├── render.yaml                          # Render cloud deployment specification
├── README.md                            # High-level overview & quickstart guide
├── PROJECT_CONTEXT.md                   # Complete AI Context & Architecture Blueprint (this file)
│
├── shared/                              # ─── SHARED MODULE (@dsa-planner/shared)
│   ├── package.json
│   └── src/
│       ├── index.ts                     # Main shared exports
│       ├── constants/                   # Spaced repetition rules & canonical topics
│       ├── enums/                       # Difficulty, Platform, Rating, TaskStatus, TaskType
│       └── types/                       # Shared TypeScript interfaces for models & payloads
│
├── backend/                             # ─── BACKEND API SERVER (@dsa-planner/backend)
│   ├── prisma/
│   │   └── schema.prisma                # PostgreSQL schema & database models
│   └── src/
│       ├── server.ts                    # Express server entry point
│       ├── controllers/                 # Express route controllers
│       ├── cron/                        # Backlog processing, task expiry & POTD cron jobs
│       ├── data/                        # Curated question bank JSON files
│       │   ├── striverSheet.json        # 435 questions across 20 topics
│       │   ├── coderArmySheet.json      # 715 questions across 17 topics
│       │   └── neetcodeSample.json      # 20 essential pattern questions
│       ├── middleware/                  # Auth JWT, Timezone & Error handling middleware
│       ├── repositories/                # Prisma data access layer
│       ├── routes/                      # API endpoint definitions (/api/v1/*)
│       ├── services/                    # Business logic & weighted scheduling engine
│       └── utils/                       # Date keys, Logger, Gemini client, Topic normalizer
│
└── frontend/                            # ─── FRONTEND APPLICATION (@dsa-planner/frontend)
    └── src/
        ├── main.tsx                     # React root mount
        ├── App.tsx                      # App router & global layout
        ├── index.css                    # Design system tokens, variables & dark mode styles
        ├── pages/                       # Dashboard, GeneratePlan, Roadmap, Progress, StudySlots
        ├── components/                  # Modular UI components
        ├── hooks/                       # Custom React hooks (useTaskActions, useDebounce)
        ├── services/                    # Axios API client services
        ├── store/                       # Zustand global state stores
        ├── types/                       # Client-side TypeScript interfaces
        └── utils/                       # Platform icons, labels & plan draft helpers
```

---

## 🗄️ 3. Database Schema & Prisma Models

The database schema (`backend/prisma/schema.prisma`) defines 11 core models:

```mermaid
erDiagram
    User ||--o{ Plan : creates
    User ||--o{ Task : owns
    User ||--o{ Assignment : tracks
    User ||--o{ Note : writes
    User ||--o{ Notification : receives
    User ||--o{ ClassSchedule : sets
    User ||--o{ PotdDismissal : dismisses
    Plan ||--o{ Task : contains
    Task ||--o{ Task : "has revisions"
    Task ||--o{ Note : "attached notes"
    Task ||--o{ Revision : "parent/child revision records"
```

### Model Definitions:

1. **`User`** (`users`):
   - `id` (UUID PK), `googleId` (Unique), `email` (Unique), `name`, `avatarUrl`, `coins` (Int, default 0), `createdAt`, `updatedAt`.

2. **`Plan`** (`plans`):
   - `id` (UUID PK), `userId` (FK), `name`, `source` (`striver` | `coderarmy` | `neetcode150` | `custom`), `startDate`, `endDate`, `status` (`active` | `completed` | `archived`), `weekdayCapacity`, `weekendCapacity`.

3. **`Task`** (`tasks`):
   - `id` (UUID PK), `userId` (FK), `planId` (FK, nullable), `parentTaskId` (FK, self-relation for revisions), `title`, `topic`, `difficulty` (`easy` | `medium` | `hard`), `platform` (`leetcode` | `gfg` | `striver` | `hackerrank` | `interviewbit` | `spoj` | `custom`), `problemUrl`, `taskType` (`new` | `revision` | `assignment` | `potd`), `status` (`pending` | `completed` | `backlog` | `expired`), `scheduledDate`, `originalSolveDate`, `completedAt`, `rating` (`easy` | `medium` | `hard`), `revisionNumber` (Int, 0 for new, 1..4 for revisions), `isBacklog` (Boolean), `backlogSince`, `isExpired` (Boolean), `notes` (String), `potdDateKey` (`YYYY-MM-DD`, unique per user).

4. **`Revision`** (`revisions`):
   - `id` (UUID PK), `parentTaskId` (FK), `revisionTaskId` (FK), `revisionNumber` (1..4), `scheduledDate`, `status` (`pending` | `completed` | `expired`), `completedAt`.

5. **`Assignment`** (`assignments`):
   - `id` (UUID PK), `userId` (FK), `title`, `description`, `deadline`, `status` (`pending` | `completed`), `completedAt`.

6. **`Note`** (`notes`):
   - `id` (UUID PK), `taskId` (FK), `userId` (FK), `content`, `createdAt`, `updatedAt`.

7. **`ClassSchedule`** (`class_schedules`):
   - `id` (UUID PK), `userId` (FK), `dayOfWeek` (0=Sun..6=Sat), `subject`, `startTime` (`HH:MM`), `endTime` (`HH:MM`), `location`.

8. **`Notification`** (`notifications`):
   - `id` (UUID PK), `userId` (FK), `type` (`backlog` | `expired` | `revision` | `system`), `title`, `message`, `metadata` (JSON), `readAt`.

9. **`CronRun`** (`cron_runs`):
   - `id` (UUID PK), `jobName`, `runDate` (`YYYY-MM-DD`), `status` (`running` | `completed` | `failed`), `error`, `startedAt`, `completedAt`.

10. **`PotdCache`** (`potd_cache`):
    - `dateKey` (PK, `YYYY-MM-DD`), `title`, `titleSlug`, `difficulty`, `url`, `topicTags` (String[]), `questionId`, `fetchedAt`.

11. **`PotdDismissal`** (`potd_dismissals`):
    - `id` (UUID PK), `userId` (FK), `dateKey` (`YYYY-MM-DD`). Unique `[userId, dateKey]`.

---

## ⚡ 4. Core Engines & Business Logic

### A. Weighted Plan Pacing & Scheduling Engine
- **Load Unit Weights**:
  - `Easy` = **0.5 units**
  - `Medium` = **1.0 unit**
  - `Hard` = **1.5 units**
- **Daily Capacity Calculation**:
  - `weekdayLoad` (e.g. 2.0 = 2 Mediums or 4 Easies)
  - `weekendLoad` (e.g. 3.0 = 3 Mediums or 2 Hards)
- **Exams & Busy Days Cut**:
  - Daily capacity is scaled by `(100 - loadReductionPct) / 100`.
  - Presets: Light 30%, Half 50%, Exam Day 60%, Heavy 80%, No Study 100%.
- **Dual Scheduling Modes**:
  - **Balanced Mode (Default)**: Rotates topics across days so student studies mixed concepts.
  - **Sequential Mode**: Schedules all problems of Topic 1 completely before starting Topic 2 (e.g. *Finish ALL Arrays $\rightarrow$ then ALL Linked List $\rightarrow$ then ALL Trees*).

### B. Spaced Repetition & Revision Engine (4 Stages)
- **Workflow**: `Solve Task` $\rightarrow$ `User Rates Difficulty (Easy / Medium / Hard)`.
- **Automatic 4-Stage Scheduling**:
  - Stage 1: **+1 Day** (`revisionNumber: 1`)
  - Stage 2: **+3 Days** (`revisionNumber: 2`)
  - Stage 3: **+7 Days** (`revisionNumber: 3`)
  - Stage 4: **+14 Days** (`revisionNumber: 4`)
- **Rewards**: Base Solve = **+10 coins**. Medium Rating Bonus = **+5 coins**. Hard Rating Bonus = **+10 coins**.
- **Un-Rate Action (Contract)**:
  - Tapping an active rating pill again reverts task to `pending`.
  - Refunds awarded coins.
  - **Cascading Deletion**: Immediately deletes all 4 pending revision tasks from the database and UI.

### C. Topic Normalization & Alias Engine
- `topicKey(input)` strips alphanumerics, lowercases, and removes trailing 's'.
- Standardized topic lookup ensures user free-text inputs like `"dp"`, `"dynamic programming"`, `"trees"`, `"linkedlist"` resolve to canonical bank names (`Dynamic Programming`, `Binary Tree`, `Linked List`).
- Backend `/api/v1/plans/topics` serves as the dynamic source-of-truth for problem counts and topic names.

### D. LeetCode POTD Auto-Sync Engine
- Background daily cron job (`potdCron.ts`) queries official LeetCode GraphQL API.
- Caches POTD into `PotdCache`.
- When a user logs in, if POTD task doesn't exist for today, it auto-creates a POTD task (`taskType: 'potd'`).
- Dedicated **POTD Streak Service** tracks consecutive POTD completions independently of general daily streaks.

### E. Semester Timetable Tracker ("My Classes")
- Fixed weekly class schedules (`dayOfWeek`: 0..6).
- Dashboard calculates live status:
  - `LIVE`: Current time is between `startTime` and `endTime`.
  - `UPCOMING`: Class is today and start time is in the future.
  - `DONE`: Class end time has passed today.
- **1-Tap Hide for Today**: Zero-backend state. Clicking cancel stores `hidden_class_{id}_{YYYY-MM-DD}` in `localStorage`. Class auto-reappears next week.

---

## 🎨 5. Frontend Architecture & Design System

### Design System & Theme:
- Built with **Vanilla CSS** and CSS custom properties (`var(--brand)`, `var(--bg-surface)`, `var(--text-primary)`).
- Full **Dark & Light Mode** support via `themeStore.ts`.
- Modern aesthetics: Glassmorphism, smooth micro-animations, color-coded status badges, interactive sliders, and GitHub-style contribution heatmaps.

### Client Pages:
1. **`Dashboard.tsx`** (`/dashboard`): Daily Hitlist, Status Overview (Coins, Streak, Backlog), POTD Widget, Today's Classes Strip, Vibe Banner.
2. **`GeneratePlanPage.tsx`** (`/generate-plan`): Multi-step manual wizard & AI Chat planner.
3. **`RoadmapPage.tsx`** (`/roadmap`): Active plan timeline, weekly cards, revision tags, plan archive/restore/delete.
4. **`ProgressPage.tsx`** (`/progress`): 365-day solved contribution heatmap, topic progress circles, difficulty distribution, activity log.
5. **`StudySlotsPage.tsx`** (`/study-slots`): Semester timetable management.

### Global State Stores (Zustand):
- `authStore`: JWT token, user profile, coins, authentication state.
- `dashboardStore`: Daily hitlist, status overview, POTD state.
- `planStore`: Active plan, preview data, topic quotas.
- `progressStore`: Heatmap data, topic mastery percentages, activity logs.
- `taskStore`: Task filters, active task selection, notes drawer.
- `themeStore`: Light / Dark mode toggle.
- `uiStore`: Toast notifications & global modal states.

---

## 🔌 6. API Reference Contract (`/api/v1`)

| Module | Method | Endpoint | Description |
|---|---|---|---|
| **Auth** | `POST` | `/api/v1/auth/google` | Authenticate via Google OAuth token |
| | `GET` | `/api/v1/auth/me` | Fetch active user profile & coins balance |
| **Dashboard**| `GET` | `/api/v1/dashboard` | Aggregated dashboard state (hitlist, status, vibe, classes) |
| **Tasks** | `GET` | `/api/v1/tasks` | Query user tasks with date, status & type filters |
| | `POST` | `/api/v1/tasks` | Create custom manual task |
| | `POST` | `/api/v1/tasks/:id/complete` | Complete task (awards coins & streak) |
| | `POST` | `/api/v1/tasks/:id/rate` | Rate task (triggers 4 spaced revisions) |
| | `POST` | `/api/v1/tasks/:id/unrate` | Revert rating (refunds coins & deletes 4 pending revisions) |
| | `DELETE` | `/api/v1/tasks/:id` | Delete individual task |
| **Plans** | `GET` | `/api/v1/plans/topics` | Dynamic topic list & problem count per source |
| | `POST` | `/api/v1/plans/preview` | Preview plan schedule without committing |
| | `POST` | `/api/v1/plans/commit` | Commit generated plan into database |
| | `GET` | `/api/v1/plans/active` | Get active plan & scheduled timeline |
| | `POST` | `/api/v1/plans/:id/archive` | Archive an active plan |
| | `POST` | `/api/v1/plans/:id/restore` | Restore an archived plan |
| | `DELETE` | `/api/v1/plans/:id` | Delete plan (deletes pending, keeps solved history) |
| | `POST` | `/api/v1/plans/ai-parse` | Natural language prompt to plan settings parser |
| | `POST` | `/api/v1/plans/ai-chat` | Interactive Gemini AI plan builder chat |
| **POTD** | `GET` | `/api/v1/potd/today` | Fetch today's LeetCode POTD |
| | `POST` | `/api/v1/potd/solve` | Complete POTD and update POTD streak |
| | `POST` | `/api/v1/potd/dismiss` | Dismiss POTD banner for today |
| **Classes** | `GET` | `/api/v1/classes` | Fetch semester timetable |
| | `POST` | `/api/v1/classes` | Create or update semester timetable |
| **Progress** | `GET` | `/api/v1/progress/heatmap` | Fetch 365-day solved matrix |
| | `GET` | `/api/v1/progress/topics` | Fetch topic completion percentages & difficulty stats |
| | `GET` | `/api/v1/progress/activity` | Fetch recent activity log |
| **Notes** | `GET` | `/api/v1/notes/:taskId` | Fetch notes attached to task |
| | `POST` | `/api/v1/notes/:taskId` | Create or update task note |

---

## 📚 7. Curated Question Banks Data

The backend includes 3 curated JSON sheets in `backend/src/data/`:

1. **`striverSheet.json`**:
   - **435 problems** across 20 topics (*Basics, Math, Recursion, Hashing, Sorting & Searching, Arrays, Binary Search, Strings, Linked List, Backtracking, Bit Manipulation, Stack, Sliding Window, Heap, Greedy, Binary Tree, BST, Graph, Dynamic Programming, Trie*).
2. **`coderArmySheet.json`**:
   - **715 problems** across 17 topics.
3. **`neetcodeSample.json`**:
   - **20 essential pattern problems**.

Each question entry schema:
```json
{
  "id": "striver-001",
  "title": "Two Sum",
  "topic": "Arrays",
  "difficulty": "easy",
  "url": "https://leetcode.com/problems/two-sum",
  "order": 1,
  "tags": ["leetcode"]
}
```

---

## 🚀 8. Build, Execution & Deployment Instructions

### Local Development Commands:

```bash
# Install all workspace dependencies
npm install

# Run backend development server (Port 5000)
npm --prefix backend run dev

# Run frontend development server (Port 5173)
npm --prefix frontend run dev

# Production Build
npm --prefix backend run build
npm --prefix frontend run build
```

### Environment Setup (`backend/.env`):
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:password@localhost:5432/daily_tracker?schema=public"
JWT_SECRET="your_secure_jwt_secret"
GEMINI_API_KEY="your_optional_gemini_api_key"
```

### Database Migration:
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

---

> **Summary for AI Agent**: This project is completely production-ready with robust architecture, full type safety across monorepo packages, strict error handling, database-backed state persistence, and AI-driven personalized scheduling. You can safely inspect, modify, or extend any part of this codebase following the patterns outlined above.
