-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "google_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "avatar_url" TEXT,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT,
    "potd_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cp31_enabled" BOOLEAN NOT NULL DEFAULT false,
    "cp31_band" INTEGER,
    "cp31_daily_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'custom',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "weekday_capacity" INTEGER NOT NULL DEFAULT 2,
    "weekend_capacity" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "parent_task_id" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "topic" TEXT NOT NULL DEFAULT 'General',
    "difficulty" TEXT DEFAULT 'medium',
    "platform" TEXT DEFAULT 'custom',
    "problem_url" TEXT,
    "source_url" TEXT,
    "task_type" TEXT NOT NULL DEFAULT 'new',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduled_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "scheduled_date_key" TEXT,
    "original_solve_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "rating" TEXT,
    "revision_number" INTEGER NOT NULL DEFAULT 0,
    "is_backlog" BOOLEAN NOT NULL DEFAULT false,
    "backlog_since" TIMESTAMP(3),
    "is_expired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "recurrence" TEXT,
    "due_time" TEXT,
    "duration_min" INTEGER,
    "potd_date_key" TEXT,
    "cp31_problem_id" TEXT,
    "is_skipped" BOOLEAN NOT NULL DEFAULT false,
    "skipped_at" TIMESTAMP(3),
    "question_bank_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisions" (
    "id" TEXT NOT NULL,
    "parent_task_id" TEXT NOT NULL,
    "revision_task_id" TEXT NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cron_runs" (
    "id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "run_date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "potd_cache" (
    "date_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_slug" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "topic_tags" TEXT[],
    "question_id" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "potd_cache_pkey" PRIMARY KEY ("date_key")
);

-- CreateTable
CREATE TABLE "potd_dismissals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "potd_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "tasks_user_id_scheduled_date_idx" ON "tasks"("user_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "tasks_user_id_scheduled_date_key_idx" ON "tasks"("user_id", "scheduled_date_key");

-- CreateIndex
CREATE INDEX "tasks_user_id_status_idx" ON "tasks"("user_id", "status");

-- CreateIndex
CREATE INDEX "tasks_parent_task_id_idx" ON "tasks"("parent_task_id");

-- CreateIndex
CREATE INDEX "tasks_question_bank_id_idx" ON "tasks"("question_bank_id");

-- CreateIndex
CREATE INDEX "tasks_user_id_is_backlog_is_expired_idx" ON "tasks"("user_id", "is_backlog", "is_expired");

-- CreateIndex
CREATE INDEX "tasks_parent_task_id_task_type_idx" ON "tasks"("parent_task_id", "task_type");

-- CreateIndex
CREATE INDEX "tasks_user_id_task_type_status_idx" ON "tasks"("user_id", "task_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_user_id_potd_date_key_key" ON "tasks"("user_id", "potd_date_key");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_user_id_cp31_problem_id_key" ON "tasks"("user_id", "cp31_problem_id");

-- CreateIndex
CREATE INDEX "revisions_parent_task_id_idx" ON "revisions"("parent_task_id");

-- CreateIndex
CREATE INDEX "revisions_revision_task_id_idx" ON "revisions"("revision_task_id");

-- CreateIndex
CREATE INDEX "assignments_user_id_deadline_idx" ON "assignments"("user_id", "deadline");

-- CreateIndex
CREATE INDEX "notes_task_id_idx" ON "notes"("task_id");

-- CreateIndex
CREATE INDEX "class_schedules_user_id_day_of_week_start_time_idx" ON "class_schedules"("user_id", "day_of_week", "start_time");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "cron_runs_job_name_run_date_idx" ON "cron_runs"("job_name", "run_date");

-- CreateIndex
CREATE UNIQUE INDEX "cron_runs_job_name_run_date_key" ON "cron_runs"("job_name", "run_date");

-- CreateIndex
CREATE UNIQUE INDEX "potd_dismissals_user_id_date_key_key" ON "potd_dismissals"("user_id", "date_key");

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_revision_task_id_fkey" FOREIGN KEY ("revision_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potd_dismissals" ADD CONSTRAINT "potd_dismissals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
