import { supabase } from "@/integrations/supabase/client";

export interface ExportData {
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

export interface ImportResult {
  success: boolean;
  imported: Record<string, number>;
  errors: string[];
  total: number;
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

/**
 * Validates the structure of imported data
 */
function validateImportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') return false;
  
  const d = data as Record<string, unknown>;
  
  // Check required fields
  const requiredArrays = [
    'transactions', 'accounts', 'habits', 'habit_logs', 'tasks', 
    'projects', 'project_tasks', 'reminders', 'notes', 'journal_entries',
    'memories', 'conversations', 'messages', 'financial_goals', 
    'saved_sites', 'prompt_library', 'axiom_score_history'
  ];

  for (const field of requiredArrays) {
    if (!Array.isArray(d[field])) {
      console.warn(`[Import] Missing or invalid field: ${field}`);
      return false;
    }
  }

  return true;
}

/**
 * Import user data from a backup file
 * Uses upsert to handle existing records
 */
export async function importUserData(userId: string, data: ExportData): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    imported: {},
    errors: [],
    total: 0,
  };

  if (!validateImportData(data)) {
    result.errors.push('Arquivo de backup inválido ou corrompido');
    return result;
  }

  // Tables to import (order matters for foreign keys)
  const tablesToImport = [
    { name: 'accounts', data: data.accounts },
    { name: 'habits', data: data.habits },
    { name: 'projects', data: data.projects },
    { name: 'transactions', data: data.transactions },
    { name: 'habit_logs', data: data.habit_logs },
    { name: 'project_tasks', data: data.project_tasks },
    { name: 'tasks', data: data.tasks },
    { name: 'reminders', data: data.reminders },
    { name: 'notes', data: data.notes },
    { name: 'journal_entries', data: data.journal_entries },
    { name: 'memories', data: data.memories },
    { name: 'conversations', data: data.conversations },
    { name: 'messages', data: data.messages },
    { name: 'financial_goals', data: data.financial_goals },
    { name: 'saved_sites', data: data.saved_sites },
    { name: 'prompt_library', data: data.prompt_library },
    { name: 'axiom_score_history', data: data.axiom_score_history },
  ] as const;

  for (const { name, data: tableData } of tablesToImport) {
    if (!tableData || tableData.length === 0) {
      result.imported[name] = 0;
      continue;
    }

    try {
      // Prepare data: ensure user_id is correct and remove conflicting timestamps
      const preparedData = (tableData as Record<string, unknown>[]).map(item => ({
        ...item,
        user_id: userId,
      }));

      // Use upsert with onConflict to handle existing records
      const { error } = await supabase
        .from(name as any)
        .upsert(preparedData, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`[Import] Error importing ${name}:`, error);
        result.errors.push(`${name}: ${error.message}`);
        result.imported[name] = 0;
      } else {
        result.imported[name] = preparedData.length;
        result.total += preparedData.length;
      }
    } catch (error) {
      console.error(`[Import] Exception importing ${name}:`, error);
      result.errors.push(`${name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      result.imported[name] = 0;
    }
  }

  // Update profile context if exists
  if (data.profile && typeof data.profile === 'object') {
    try {
      const profileData = data.profile as Record<string, unknown>;
      await supabase
        .from('profiles')
        .update({ 
          user_context: profileData.user_context as string | null,
          personality_mode: profileData.personality_mode as string | null,
        })
        .eq('id', userId);
    } catch (error) {
      result.errors.push('Erro ao restaurar perfil');
    }
  }

  result.success = result.errors.length === 0;
  return result;
}
