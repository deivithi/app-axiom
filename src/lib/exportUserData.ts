import { supabase } from "@/integrations/supabase/client";

const EXPORT_VERSION = '2.0.0';

export interface ExportData {
  version: string;
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
  push_subscriptions: unknown[];
  proactive_questions: unknown[];
  exportedAt: string;
}

export interface ImportResult {
  success: boolean;
  imported: Record<string, number>;
  errors: string[];
  total: number;
}

/**
 * Fetch all rows from a table with pagination to bypass 1000 row limit
 */
async function fetchAllRows(
  table: string, 
  userId: string, 
  userIdColumn: string = 'user_id'
): Promise<unknown[]> {
  const allData: unknown[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table as any)
      .select('*')
      .eq(userIdColumn, userId)
      .range(offset, offset + limit - 1);

    if (error) {
      console.error(`[Export] Error fetching ${table}:`, error);
      break;
    }

    if (!data || data.length === 0) break;
    
    allData.push(...data);
    
    if (data.length < limit) break;
    offset += limit;
  }

  return allData;
}

export async function exportUserData(userId: string): Promise<ExportData> {
  // Fetch profile separately (uses 'id' instead of 'user_id')
  const profileData = await fetchAllRows('profiles', userId, 'id');

  // All tables with user_id filter
  const userTables = [
    'transactions', 'accounts', 'habits', 'habit_logs', 'tasks', 'projects',
    'project_tasks', 'reminders', 'notes', 'journal_entries', 'memories',
    'conversations', 'messages', 'financial_goals', 'saved_sites', 
    'prompt_library', 'axiom_score_history', 'push_subscriptions', 'proactive_questions'
  ] as const;

  // Fetch all tables in parallel for better performance
  const tablePromises = userTables.map(table => 
    fetchAllRows(table, userId).then(data => ({ table, data }))
  );

  const results = await Promise.all(tablePromises);
  
  const tableData: Record<string, unknown[]> = {};
  for (const { table, data } of results) {
    tableData[table] = data;
  }

  return {
    version: EXPORT_VERSION,
    profile: profileData[0] || null,
    transactions: tableData.transactions,
    accounts: tableData.accounts,
    habits: tableData.habits,
    habit_logs: tableData.habit_logs,
    tasks: tableData.tasks,
    projects: tableData.projects,
    project_tasks: tableData.project_tasks,
    reminders: tableData.reminders,
    notes: tableData.notes,
    journal_entries: tableData.journal_entries,
    memories: tableData.memories,
    conversations: tableData.conversations,
    messages: tableData.messages,
    financial_goals: tableData.financial_goals,
    saved_sites: tableData.saved_sites,
    prompt_library: tableData.prompt_library,
    axiom_score_history: tableData.axiom_score_history,
    push_subscriptions: tableData.push_subscriptions,
    proactive_questions: tableData.proactive_questions,
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
 * Validates the structure of imported data (backwards compatible)
 */
function validateImportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') return false;
  
  const d = data as Record<string, unknown>;
  
  // Required arrays (must exist in all versions)
  const requiredArrays = [
    'transactions', 'accounts', 'habits', 'habit_logs', 'tasks', 
    'projects', 'project_tasks', 'reminders', 'notes', 'journal_entries',
    'memories', 'conversations', 'messages', 'financial_goals', 
    'saved_sites', 'prompt_library', 'axiom_score_history'
  ];

  // Optional arrays (added in v2.0.0, may not exist in older exports)
  const optionalArrays = ['push_subscriptions', 'proactive_questions'];

  for (const field of requiredArrays) {
    if (!Array.isArray(d[field])) {
      console.warn(`[Import] Missing or invalid required field: ${field}`);
      return false;
    }
  }

  // Initialize optional arrays if missing (backwards compatibility)
  for (const field of optionalArrays) {
    if (!Array.isArray(d[field])) {
      (d as Record<string, unknown[]>)[field] = [];
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

  // Log version info
  const version = (data as any).version || '1.0.0';
  console.log(`[Import] Importing backup version ${version}`);

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
    { name: 'push_subscriptions', data: data.push_subscriptions || [] },
    { name: 'proactive_questions', data: data.proactive_questions || [] },
  ] as const;

  for (const { name, data: tableData } of tablesToImport) {
    if (!tableData || tableData.length === 0) {
      result.imported[name] = 0;
      continue;
    }

    try {
      // Prepare data: ensure user_id is correct
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
