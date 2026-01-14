-- Adicionar coluna message_type para categorizar mensagens
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'chat';

-- Atualizar relatórios semanais existentes
UPDATE messages SET message_type = 'weekly_report' 
WHERE message_type = 'chat' AND (
  content ILIKE '%📊 Relatório da Semana%' 
  OR content ILIKE '%📊 Relatório Completo%'
  OR content ILIKE '%Seu relatório semanal está pronto%'
  OR content ILIKE '%Métricas da Semana%'
);

-- Atualizar análises pessoais existentes
UPDATE messages SET message_type = 'personal_analysis' 
WHERE message_type = 'chat' AND content ILIKE '%🧠 Análise Pessoal%';