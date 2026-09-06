# 🚀 DSA Tracker & Study Planner

> A full-stack, AI-powered Data Structures & Algorithms study planner, automated 4-stage revision scheduler, LeetCode Problem of the Day (POTD) auto-sync, semester timetable tracker, and gamified progress dashboard for computer science students.

---

## 💡 Overview

Mastering Data Structures & Algorithms for technical interviews requires consistency, structured pacing, and spaced repetition. 

**DSA Tracker & Study Planner** solves study burnout, forgotten revisions, and chaotic schedules by offering:
1. **Weighted AI Pacing & Scheduling Engine**: Converts curated question sheets (*Striver A2Z, Coder Army, NeetCode*) into balanced or sequential daily schedules tailored to your available study hours, upcoming exams, and target focus topics.
2. **Spaced Repetition Engine (4-Stage Revisions)**: Automatically schedules revisions (+1, +3, +7, and +14 days) after you rate problem difficulty (*Easy, Medium, Hard*).
3. **Exams & Busy Days Load Reduction**: Automatically scales down daily problem loads on exam or busy days (Light 30%, Half 50%, Exam Day 60%, Heavy 80%, No Study 100%).
4. **LeetCode Problem of the Day (POTD) Auto-Sync**: Automated daily cron fetching of official LeetCode POTDs with dedicated POTD streak tracking and reward coins.
5. **Semester Timetable Tracker ("My Classes")**: Manages daily academic classes with a zero-backend 1-tap "Hide for Today" feature.
6. **Gamified Progress Tracking**: Earn coins, maintain daily streaks, view your 365-day GitHub-style contribution heatmap, and monitor topic completion percentages.

---

## ✨ Key Features

### 🧠 1. AI Study Plan Generator & Pacing Engine
- **Curated Question Sheets**:
  - ⚡ **Striver's A2Z DSA Sheet** (435 structured problems across 20 topics from Basics to DP, Graphs & Tries).
  - ⚔️ **Coder Army Sheet** (715 comprehensive DSA problems across 17 modules).
  - 🚀 **NeetCode 150 Sample** (20 essential pattern problems).
- **Dual Scheduling Modes**:
  - 🔄 **Balanced Mode (Default)**: Rotates and interleaves topics across days for optimal revision spread.
  - 🎯 **Sequential Mode**: Schedules topics in a strict user-defined priority order (e.g., *Finish ALL Stack $\rightarrow$ then ALL Queue $\rightarrow$ then ALL Heap*) without topic rotation.
- **Exams & Busy Days Manager**:
  - Add exams, quizzes, or travel days to auto-reduce problem load.
  - Preset chips (*Light 30%, Half 50%, Exam Day 60%, Heavy 80%, No Study 100%*) and quick date selectors (*Today, Tomorrow, +3 Days, +7 Days*).
- **Dynamic Question Bank Source of Truth (`/api/v1/plans/topics`)**: Focus/Avoid chips and topic counts are fetched directly from the backend question bank endpoint, guaranteeing exact string matching with live problem counts.
- **Topic Normalization & Alias Safety Net**: Canonical `topicKey()` maps free-text AI prompt inputs (*"trees", "heaps", "dp"*) to exact canonical names (*"Binary Tree", "Heap", "Dynamic Programming"*).
- **Flexible Pacing & Duration**: Select preset pace (*Relaxed, Moderate, Intensive*) or custom duration (1 to 365 days) with custom start date picker and buffer day options.
- **AI Prompt Assist**: Type prompts like *"30 days plan from Striver Sheet with exam on Sept 15"* and let Gemini AI configure your settings.

### 🧩 2. LeetCode Problem of the Day (POTD) Auto-Sync
- Automated daily background cron job fetches the official LeetCode POTD.
- Dedicated dashboard POTD card with single-click solve integration.
- Separate **POTD Streak Counter** and streak statistics.

### 🔄 3. Solve $\rightarrow$ Rate Toggle & 4-Stage Revisions
- **Solve Checkbox**: Mark a problem as solved (`status: completed`). Earns +10 base coins and updates streak.
- **Difficulty Rating (Easy / Medium / Hard)**:
  - Rating a problem automatically creates **4 Revision Tasks** scheduled at **+1, +3, +7, and +14 days**.
  - Awards bonus coins (+5 for Medium, +10 for Hard).
- **Un-Rate Action (Tap Pill Again)**:
  - Reverts the task back to `pending`.
  - Refunds awarded coins and **immediately deletes all 4 pending revision tasks** from your Roadmap and Hitlist.

### 🗺️ 4. Interactive Roadmap & Plan Lifecycle
- **Unified Timeline**: Shows your active plan's parent problems alongside purple `Rev #N` revision tags.
- **Archive & Restore**: Archive active plans without losing progress. Restore them anytime.
- **Delete Plan with History Preservation**: Deleting a plan deletes pending tasks, but **preserves all completed solved history** and earned coins.

### 📚 5. "My Classes" Semester Timetable Tracker
- Enter your fixed semester timetable once (day, subject, start/end time, room).
- **Live Status Badges**: Dashboard displays today's classes with live badges (`DONE` / `LIVE` / `UPCOMING`).
- **1-Tap Cancel ("Hide for Today")**: Hides cancelled classes in `localStorage` for today only without backend calls; automatically reappears tomorrow.

### 📊 6. Progress Analytics & 365-Day Solved Heatmap
- **GitHub-Style Heatmap**: Visual 365-day grid tracking daily solved problems.
- **Topic Mastery Breakdown**: Completion bars and statistics for Arrays, DP, Graphs, Trees, Heaps, Backtracking, etc.
- **Difficulty Distribution**: Visual breakdown of Easy, Medium, and Hard problems solved.
- **Detailed Activity Log**: History of every solved and revised problem with exact timestamps.

### 🪙 7. Gamification & Daily Vibe Engine
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
| **Monorepo Structure** | npm workspaces (`frontend`, `backend`, `shared`) |

---

## 📁 Repository Directory Structure

```text
Daily_Tracker/
├── shared/                              # ─── SHARED LAYER (TypeScript Package)
│   └── src/
│       ├── constants/                   # Revision rules & topic constants
│       ├── enums/                       # Difficulty, Platform, Rating, TaskStatus, TaskType
│       └── types/                       # Plan, Task, User, Progress, Note, Assignment interfaces
│
├── backend/                             # ─── BACKEND LAYER (Express + Prisma)
│   ├── prisma/
│   │   └── schema.prisma                # PostgreSQL schema & models
│   └── src/
│       ├── server.ts                    # Express server entry point
│       ├── controllers/                 # Express request handlers
│       ├── cron/                        # Backlog, Expiry & POTD background jobs
│       ├── data/                        # striverSheet.json, coderArmySheet.json, neetcodeSample.json
│       ├── middleware/                  # Auth JWT, Timezone, and Error middleware
│       ├── repositories/                # Prisma data access layer
│       ├── routes/                      # API router endpoints (/api/v1/*)
│       ├── services/                    # Business logic & weighted scheduling engine
│       └── utils/                       # DateKeys, Logger, Gemini client, Topic normalizer
│
└── frontend/                            # ─── FRONTEND LAYER (React + Vite + TS)
    └── src/
        ├── main.tsx                     # Application entry point
        ├── App.tsx                      # Layout & Router shell
        ├── pages/                       # Dashboard, GeneratePlan, Roadmap, Progress, StudySlots
        ├── components/                  # Modular UI components (Plan, Progress, Task, etc.)
        ├── services/                    # Client API modules
        ├── store/                       # Zustand global state stores
        └── utils/                       # Platform icons, labels, plan draft helpers
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

# Install dependencies for root, backend, frontend, and shared
npm install
```

---

### 2. Configure Environment Variables

Create a `.env` file inside `backend/`:

```env
# backend/.env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:password@localhost:5432/daily_tracker?schema=public"
JWT_SECRET="your_jwt_secret_key_here"

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

From the root directory:

**Terminal 1 (Backend Server):**
```bash
npm --prefix backend run dev
# 🚀 Server running on http://localhost:5000
```

**Terminal 2 (Frontend Client):**
```bash
npm --prefix frontend run dev
# 🚀 App running on http://localhost:5173
```

---

## 🌐 API Reference Overview

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **Dashboard** | `GET` | `/api/v1/dashboard` | Aggregated dashboard metrics, vibe, hitlist, classes |
| **Tasks** | `POST` | `/api/v1/tasks` | Create manual task |
| | `POST` | `/api/v1/tasks/:id/complete` | Complete task (awards coins & streak) |
| | `POST` | `/api/v1/tasks/:id/unrate` | Un-rate task (refunds coins & deletes 4 pending revisions) |
| | `DELETE` | `/api/v1/tasks/:id` | Delete task |
| **Plans** | `GET` | `/api/v1/plans/topics` | Fetch dynamic topic list & problem counts per sheet source |
| | `POST` | `/api/v1/plans/preview` | Generate schedule preview without saving |
| | `POST` | `/api/v1/plans/commit` | Commit new plan + batch task creation transaction |
| | `GET` | `/api/v1/plans/active` | Get current active plan & scheduled tasks |
| | `POST` | `/api/v1/plans/:id/archive` | Archive active plan |
| | `POST` | `/api/v1/plans/:id/restore` | Restore archived plan |
| | `DELETE` | `/api/v1/plans/:id` | Delete plan (deletes pending, preserves solved history) |
| **POTD** | `GET` | `/api/v1/potd/today` | Fetch today's LeetCode POTD |
| | `POST` | `/api/v1/potd/solve` | Complete POTD and update POTD streak |
| **Classes** | `GET` | `/api/v1/classes` | Get semester weekly timetable |
| | `POST` | `/api/v1/classes` | Update semester class timetable |
| **Progress** | `GET` | `/api/v1/progress/heatmap` | Get 365-day solved contribution heatmap data |
| | `GET` | `/api/v1/progress/topics` | Get topic progress percentages & difficulty stats |
| | `GET` | `/api/v1/progress/activity` | Get recent activity log |

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
