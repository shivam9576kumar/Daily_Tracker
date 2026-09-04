# 🚀 DSA Tracker & Study Planner

> A full-stack, AI-powered Data Structures & Algorithms study planner, automated revision scheduler, semester timetable tracker, and gamified progress dashboard for computer science students.

---

## 💡 Overview

Preparing for technical interviews and mastering Data Structures & Algorithms requires consistency, structured pacing, and spaced repetition.

**DSA Tracker & Study Planner** solves the common challenges of study burnout, forgotten revisions, and chaotic schedules by offering:
1. **Weighted AI Pacing Engine**: Converts question banks into balanced daily schedules based on your available study hours, upcoming exams, and target focus topics.
2. **Spaced Repetition Engine (4-Stage Revisions)**: Automatically schedules revisions (+1, +3, +7, and +14 days) after you rate problem difficulty.
3. **Semester Timetable Tracker ("My Classes")**: Manages daily academic classes with a zero-backend 1-tap "Hide for Today" feature.
4. **Gamified Progress Tracking**: Earn coins, maintain daily streaks, view your 365-day GitHub-style contribution heatmap, and monitor topic mastery percentages.

---

## ✨ Key Features

### 🧠 1. AI Study Plan Generator & Pacing Engine
- **Supported Question Banks**:
  - 🚀 **NeetCode 150 Sample** (20 essential pattern problems).
  - ⚔️ **Coder Army Sheet** (715 comprehensive DSA problems across 17 modules).
- **Flexible Pacing**: Select **Relaxed** (1.5–2.5 load/day), **Moderate** (2.0–3.0 load/day), or **Intensive** (3.0–4.5 load/day).
- **Strict Topic Filtering**: Focus on specific topics (e.g. *Stack, Queue, Heap*) to generate topic-focused sub-plans.
- **Exam & Busy Day Load Reduction**: Specify exam dates or heavy days to automatically scale down scheduled study load.
- **AI Prompt Assist**: Type prompts like *"30 days plan from Coder Army Sheet focusing on Stack, Queue, and Heap"* and let Gemini AI configure the settings.

### 🔄 2. Solve $\rightarrow$ Rate Toggle & 4-Stage Revisions
- **Solve Checkbox**: Mark a problem as solved (`status: completed`). Earns +10 base coins and updates streak.
- **Difficulty Rating (Easy / Medium / Hard)**:
  - Rating a problem automatically creates **4 Revision Tasks** scheduled at **+1, +3, +7, and +14 days**.
  - Awards bonus coins (+5 for Medium, +10 for Hard).
- **Un-Rate Action (Tap Pill Again)**:
  - Reverts the task back to `pending`.
  - Refunds awarded coins and **immediately deletes all 4 pending revision tasks** from your Roadmap and Hitlist.

### 🗺️ 3. Interactive Roadmap & Plan Lifecycle
- **Unified Timeline**: Shows your active plan's parent problems alongside purple `Rev #N` revision tags.
- **Archive & Restore**: Archive active plans without losing progress. Restore them anytime.
- **Delete Plan with History Preservation**: Deleting a plan deletes pending tasks, but **preserves all completed solved history** and earned coins.

### 📚 4. "My Classes" Semester Timetable Tracker
- Enter your fixed semester timetable once (day, subject, start/end time, room).
- **Live Status Dot**: Dashboard displays today's classes with live badges (`DONE` / `LIVE` / `UPCOMING`).
- **1-Tap Cancel ("Hide for Today")**: Cancelling a class hides it in `localStorage` for today only. Zero backend calls required; automatically reappears tomorrow.

### 📊 5. Progress Analytics & 365-Day Solved Heatmap
- **GitHub-Style Heatmap**: Visual 365-day grid tracking daily solved problems.
- **Topic Mastery Breakdown**: Completion bars and statistics for Arrays, DP, Graphs, Trees, Heaps, Backtracking, etc.
- **Difficulty Distribution**: Visual breakdown of Easy, Medium, and Hard problems solved.
- **Detailed Activity Log**: History of every solved and revised problem with exact timestamps.

### 🪙 6. Gamification & Daily Vibe Engine
- **Coin System**: Earn coins for solving and rating tasks; spend or accumulate balance.
- **Streak Counter**: Maintains current and best daily streaks.
- **Daily Vibe Engine**: Dynamic motivational messages based on your daily hitlist completion rate.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Vanilla CSS (Dark Theme Design System), React Router DOM v6, Zustand |
| **Backend** | Node.js, Express.js, TypeScript, Winston Logger |
| **Database & ORM** | PostgreSQL, Prisma ORM |
| **AI Integration** | Google Gemini API (with local heuristic parser fallback) |

---

## 📁 Repository Directory Structure

```text
Daily_Tracker/
├── 📄 PROJECT_COMPLETE_MAP.md       # Full architecture blueprint & file-by-file specification
├── 📄 README.md                     # Main project guide (this file)
│
├── 📁 backend/                      # Express API Server
│   ├── 📁 prisma/
│   │   └── 📄 schema.prisma         # PostgreSQL database schema & models
│   └── 📁 src/
│       ├── 📄 server.ts             # Express server entry point
│       ├── 📄 app.ts                # Express app configuration & middleware
│       ├── 📁 controllers/          # Request handlers (tasks, plans, classes, progress)
│       ├── 📁 repositories/         # Prisma database access layer
│       ├── 📁 services/             # Core business logic & weighted scheduling engine
│       └── 📁 data/                 # neetcodeSample.json & coderArmySheet.json (715 problems)
│
└── 📁 frontend/                     # React Single Page Application
    └── 📁 src/
        ├── 📄 App.tsx               # Main router & layout shell
        ├── 📁 pages/                # Dashboard, Roadmap, MyClasses, Progress, PlanWizard
        ├── 📁 components/           # Reusable UI components (TaskCard, SolveRateToggle, etc.)
        ├── 📁 services/             # Axios API client modules
        └── 📁 types/                # Shared TypeScript interfaces
```

---

## ⚡ Quick Start & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: Local instance or cloud database (e.g. Supabase / Neon / Render)

---

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/shivam9576kumar/Daily_Tracker.git
cd Daily_Tracker

# Install Backend Dependencies
cd backend
npm install

# Install Frontend Dependencies
cd ../frontend
npm install
```

---

### 2. Configure Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
# backend/.env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:password@localhost:5432/daily_tracker?schema=public"

# Optional: Google Gemini API Key for natural language plan prompt assist
GEMINI_API_KEY="your_gemini_api_key_here"
```

---

### 3. Setup Database Schema (Prisma)

```bash
cd backend

# Run database migrations to create tables
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate
```

---

### 4. Run Locally (Development Servers)

Open two terminal windows:

**Terminal 1 (Backend Server):**
```bash
cd backend
npm run dev
# 🚀 Server running on http://localhost:5000
```

**Terminal 2 (Frontend Client):**
```bash
cd frontend
npm run dev
# 🚀 App running on http://localhost:5173
```

---

## 🌐 API Reference Overview

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **Dashboard** | `GET` | `/api/dashboard` | Aggregated dashboard data (status, vibe, hitlist, classes) |
| **Tasks** | `POST` | `/api/tasks` | Create manual task |
| | `POST` | `/api/tasks/:id/complete` | Complete task (awards coins & streak) |
| | `POST` | `/api/tasks/:id/unrate` | Un-rate task (refunds coins & deletes 4 pending revisions) |
| | `DELETE` | `/api/tasks/:id` | Delete task |
| **Plans** | `POST` | `/api/plans/preview` | Generate schedule preview without saving |
| | `POST` | `/api/plans/commit` | Create new plan + batch tasks transaction |
| | `GET` | `/api/plans/active` | Get current active plan & scheduled tasks |
| | `POST` | `/api/plans/:id/archive` | Archive an active plan |
| | `POST` | `/api/plans/:id/restore` | Restore an archived plan |
| | `DELETE` | `/api/plans/:id` | Delete plan (deletes pending, keeps solved history) |
| **Classes** | `GET` | `/api/classes` | Get semester weekly timetable |
| | `POST` | `/api/classes` | Update semester class timetable |
| **Progress** | `GET` | `/api/progress/heatmap` | Get 365-day solved heatmap data |
| | `GET` | `/api/progress/topics` | Get topic progress percentages & difficulty stats |
| | `GET` | `/api/progress/activity` | Get recent activity log |

---

## 📖 Complete Documentation

For detailed file-by-file descriptions, state machine rules, and technical architecture, refer to:
👉 **[`PROJECT_COMPLETE_MAP.md`](file:///c:/Users/shiva/Daily_Tracker/PROJECT_COMPLETE_MAP.md)**

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
