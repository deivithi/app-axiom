import { supabase } from "@/integrations/supabase/client";

interface ExportData {
  profile: unknown;
  transactions: unknown[];
  accounts: unknown[];
  habits: unknown[];
  habit_logs: unknown[];
  tasks: unknown[];
  projects: unknown[];
  project_tasks: unknown[];
  reminders: unknown[];
  notes: unknown[];
  journal_entries: unknown[];
  memories: unknown[];
  conversations: unknown[];
  messages: unknown[];
  financial_goals: unknown[];
  saved_sites: unknown[];
  prompt_library: unknown[];
  axiom_score_history: unknown[];
  exportedAt: string;
}

export async function exportUserData(userId: string): Promise<ExportData> {
  const results: Record<string, unknown[]> = {};

  // Fetch profile separately (different filter)
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId);
  results.profiles = profileData || [];

  // All tables with user_id filter
  const userTables = [
    'transactions', 'accounts', 'habits', 'habit_logs', 'tasks', 'projects',
    'project_tasks', 'reminders', 'notes', 'journal_entries', 'memories',
    'conversations', 'messages', 'financial_goals', 'saved_sites', 
    'prompt_library', 'axiom_score_history'
  ] as const;

  for (const table of userTables) {
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId);
    results[table] = data || [];
  }

  return {
    profile: (results.profiles as unknown[])?.[0] || null,
    transactions: results.transactions as unknown[],
    accounts: results.accounts as unknown[],
    habits: results.habits as unknown[],
    habit_logs: results.habit_logs as unknown[],
    tasks: results.tasks as unknown[],
    projects: results.projects as unknown[],
    project_tasks: results.project_tasks as unknown[],
    reminders: results.reminders as unknown[],
    notes: results.notes as unknown[],
    journal_entries: results.journal_entries as unknown[],
    memories: results.memories as unknown[],
    conversations: results.conversations as unknown[],
    messages: results.messages as unknown[],
    financial_goals: results.financial_goals as unknown[],
    saved_sites: results.saved_sites as unknown[],
    prompt_library: results.prompt_library as unknown[],
    axiom_score_history: results.axiom_score_history as unknown[],
    exportedAt: new Date().toISOString(),
  };
}

export function downloadUserData(data: ExportData, filename: string = 'meus-dados-axiom.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
