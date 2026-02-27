/**
 * Vercel Serverless Function — Chat com GPT-5.2
 * Proxy SSE streaming para a API OpenAI.
 *
 * O frontend envia: { messages, context }
 * A função monta um system prompt DINÂMICO com os dados reais do usuário
 * e retransmite o streaming SSE.
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-5.2';

// ─── System Prompt Base ─────────────────────────────────────────────
const AXIOM_BASE_PROMPT = `Você é **Axiom**, um estrategista de vida conversacional integrado ao App Axiom.

## Suas capacidades:
- 💰 **Finanças**: Analisar transações, contas, parcelamentos, assinaturas reais do usuário.
- 🎯 **Hábitos**: Acompanhar streaks, sugerir novos hábitos, motivar consistência.
- ✅ **Tarefas**: Organizar tarefas, sugerir prioridades, acompanhar deadlines.
- 📁 **Projetos**: Acompanhar progresso de projetos e sub-tarefas.
- 📝 **Memória**: Usar notas, diário e memórias salvas como contexto.
- 📊 **Análises**: Gerar insights do Axiom Score (nota geral de organização de vida).

## Regras:
- Responda SEMPRE em português do Brasil.
- Seja direto, empático e acionável.
- Use emojis com moderação (1-2 por mensagem máximo).
- Respostas devem ser curtas (2-4 parágrafos máximo).
- Quando o usuário pedir para criar algo (tarefa, transação, hábito), sugira a ação e confirme com ele.
- Você TEM ACESSO aos dados reais do usuário — use-os para dar respostas precisas.
- Nunca invente dados que não foram fornecidos no contexto abaixo.
- Se algum dado não estiver disponível no contexto, informe que aquele dado específico não foi encontrado.`;

// ─── Modos de Personalidade ─────────────────────────────────────────
const PERSONALITY_MODES: Record<string, string> = {
    direto: `\n\n## Tom de voz — MODO DIRETO 🎯
Seja brutalmente honesto, sem rodeios. Vá direto ao ponto. Não enrole, não suavize, diga a verdade doa a quem doer. Tipo: "Você gastou demais este mês. Simples assim."`,
    sabio: `\n\n## Tom de voz — MODO SÁBIO 🧘
Seja reflexivo e filosófico. Guie com perguntas poderosas. Ajude o usuário a encontrar as respostas dentro de si. Tipo: "O que seus gastos dizem sobre suas prioridades?"`,
    parceiro: `\n\n## Tom de voz — MODO PARCEIRO 🤝
Seja empático, caloroso e prático. Dê apoio genuíno e sugira próximos passos concretos. Celebre vitórias, por menores que sejam. Tipo: "Que bom que você registrou! Vamos ver juntos como melhorar?"`
};

// ─── Helper: formata moeda BR ────────────────────────────────────────
function formatBRL(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// ─── Monta o system prompt dinâmico com dados reais ──────────────────
function buildSystemPrompt(context: any): string {
    let prompt = AXIOM_BASE_PROMPT;

    if (!context) return prompt + PERSONALITY_MODES['direto'];

    // 1. Contexto pessoal (definido nas Configurações)
    const profile = context.profile;
    if (profile) {
        prompt += `\n\n## Sobre o Usuário`;
        if (profile.full_name) prompt += `\n- **Nome**: ${profile.full_name}`;
        if (profile.user_context) {
            prompt += `\n- **Contexto pessoal** (definido pelo próprio usuário nas configurações):\n${profile.user_context}`;
        }
        // Personalidade
        const mode = profile.personality_mode || 'direto';
        prompt += PERSONALITY_MODES[mode] || PERSONALITY_MODES['direto'];
    } else {
        prompt += PERSONALITY_MODES['direto'];
    }

    // 2. Memórias salvas (coisas que a IA "aprendeu" sobre o usuário)
    if (context.memories && context.memories.length > 0) {
        prompt += `\n\n## 🧠 Memórias Salvas (coisas que você sabe sobre o usuário)`;
        const grouped: Record<string, string[]> = {};
        context.memories.forEach((m: any) => {
            if (!grouped[m.type]) grouped[m.type] = [];
            grouped[m.type].push(m.content);
        });
        const typeLabels: Record<string, string> = {
            personality: 'Personalidade',
            routine: 'Rotina',
            goal: 'Objetivos',
            pattern: 'Padrões',
            preference: 'Preferências',
            fact: 'Fatos',
            insight: 'Insights'
        };
        for (const [type, items] of Object.entries(grouped)) {
            prompt += `\n### ${typeLabels[type] || type}`;
            items.forEach(item => { prompt += `\n- ${item}`; });
        }
    }

    // 3. Resumo Financeiro
    if (context.finance) {
        const f = context.finance;
        prompt += `\n\n## 💰 Finanças — ${f.monthLabel}`;
        prompt += `\n- Receita total: ${formatBRL(f.totalIncome)}`;
        prompt += `\n- Despesa total: ${formatBRL(f.totalExpenses)}`;
        prompt += `\n- Saldo do mês: ${formatBRL(f.balance)}`;

        if (f.accounts && f.accounts.length > 0) {
            prompt += `\n### Contas:`;
            f.accounts.forEach((a: any) => {
                prompt += `\n- ${a.name}: ${formatBRL(a.balance)}`;
            });
        }

        if (f.recentTransactions && f.recentTransactions.length > 0) {
            prompt += `\n### Últimas transações:`;
            f.recentTransactions.forEach((t: any) => {
                const icon = t.type === 'income' ? '📈' : '📉';
                const status = t.paid ? '✅' : '⏳';
                prompt += `\n- ${icon} ${t.title}: ${formatBRL(t.amount)} (${t.category}) ${status} — ${t.date}`;
            });
        }
    }

    // 4. Hábitos
    if (context.habits && context.habits.length > 0) {
        prompt += `\n\n## 🎯 Hábitos Ativos`;
        context.habits.forEach((h: any) => {
            prompt += `\n- ${h.title}: streak ${h.streak} dias (recorde: ${h.bestStreak}) — ${h.frequency}`;
        });
    }

    // 5. Tarefas pendentes
    if (context.tasks && context.tasks.length > 0) {
        prompt += `\n\n## ✅ Tarefas Pendentes`;
        context.tasks.forEach((t: any) => {
            const priorityIcon = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
            prompt += `\n- ${priorityIcon} ${t.title} (${t.status})${t.dueDate ? ` — prazo: ${t.dueDate}` : ''}`;
        });
    }

    // 6. Projetos
    if (context.projects && context.projects.length > 0) {
        prompt += `\n\n## 📁 Projetos Ativos`;
        context.projects.forEach((p: any) => {
            prompt += `\n- ${p.title}: ${p.progress}% (${p.status})${p.dueDate ? ` — prazo: ${p.dueDate}` : ''}`;
        });
    }

    // 7. Axiom Score
    if (context.score) {
        const s = context.score;
        prompt += `\n\n## 📊 Axiom Score (último cálculo: ${s.calculated_at?.split('T')[0] || 'N/A'})`;
        prompt += `\n- **Score Total**: ${s.total_score}/100`;
        prompt += `\n- Financeiro: ${s.financial_score} | Hábitos: ${s.habits_score} | Execução: ${s.execution_score} | Clareza: ${s.clarity_score} | Projetos: ${s.projects_score}`;
    }

    // 8. Notas recentes
    if (context.notes && context.notes.length > 0) {
        prompt += `\n\n## 📝 Notas Recentes`;
        context.notes.forEach((n: any) => {
            prompt += `\n- **${n.title || 'Sem título'}**: ${n.content || '(vazia)'}`;
        });
    }

    return prompt;
}

// ─── Handler ─────────────────────────────────────────────────────────
export const config = {
    runtime: 'edge',
};

export default async function handler(request: Request): Promise<Response> {
    // Apenas POST
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: 'OPENAI_API_KEY não configurada no servidor' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        const body = await request.json();
        const userMessages = body.messages || [];
        const context = body.context || null;

        // Montar system prompt DINÂMICO com dados reais
        const systemPrompt = buildSystemPrompt(context);

        // Montar mensagens com system prompt
        const messages = [
            { role: 'system', content: systemPrompt },
            ...userMessages,
        ];

        const streamMode = body.stream !== false; // default: stream

        // Chamar OpenAI
        const openaiResponse = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                stream: streamMode,
                temperature: 0.7,
                max_completion_tokens: 2048,
            }),
        });

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error('OpenAI API error:', openaiResponse.status, errorText);
            return new Response(
                JSON.stringify({
                    error: `Erro na API OpenAI: ${openaiResponse.status}`,
                    details: errorText,
                }),
                { status: openaiResponse.status, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Modo não-streaming: retornar JSON completo
        if (!streamMode) {
            const data = await openaiResponse.json();
            const content = data.choices?.[0]?.message?.content || '';
            return new Response(
                JSON.stringify({ content }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Modo streaming: retransmitir SSE diretamente
        return new Response(openaiResponse.body, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        });
    } catch (error) {
        console.error('Chat handler error:', error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Erro interno do servidor',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
