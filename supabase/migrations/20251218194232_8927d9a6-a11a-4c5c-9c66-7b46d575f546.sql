-- Create performance indices for better query performance at scale

-- Index for accounts lookup by user
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- Index for habits lookup by user
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);

-- Composite index for tasks (common query pattern: user + status)
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);

-- Composite index for projects (common query pattern: user + status)
CREATE INDEX IF NOT EXISTS idx_projects_user_status ON projects(user_id, status);

-- Composite index for messages (user + created_at for chat history pagination)
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at DESC);

-- Composite index for reminders (user + remind_at for upcoming reminders)
CREATE INDEX IF NOT EXISTS idx_reminders_user_remind ON reminders(user_id, remind_at);

-- Index for habit_logs by habit_id (for streak calculations)
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habit_id);

-- Index for project_tasks by project_id
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);

-- Composite index for transactions (common filter: user + reference_month)
CREATE INDEX IF NOT EXISTS idx_transactions_user_reference ON transactions(user_id, reference_month);

-- Index for transactions parent lookup (for recurring transactions)
CREATE INDEX IF NOT EXISTS idx_transactions_parent ON transactions(parent_transaction_id) WHERE parent_transaction_id IS NOT NULL;