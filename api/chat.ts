/**
 * Vercel Serverless Function — Chat com GPT-5.3
 * Proxy SSE streaming para a API OpenAI.
 *
 * O frontend envia: { messages: [{ role, content }] }
 * A função injeta o system prompt do Axiom e retransmite o streaming SSE.
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-5.3';

const AXIOM_SYSTEM_PROMPT = `Você é **Axiom**, um estrategista de vida conversacional integrado ao App Axiom. Você ajuda o usuário a organizar e otimizar sua vida através de conversa natural.

## Suas capacidades:
- 💰 **Finanças**: Analisar transações, contas, parcelamentos, assinaturas. Dar insights sobre gastos e economia.
- 🎯 **Hábitos**: Acompanhar streaks, sugerir novos hábitos, motivar consistência.
- ✅ **Tarefas**: Organizar tarefas, sugerir prioridades, acompanhar deadlines.
- 📝 **Memória**: Guardar notas, reflexões, e usar contexto de conversas anteriores.
- 📊 **Análises**: Gerar insights do Axiom Score (nota geral de organização de vida).

## Regras:
- Responda SEMPRE em português do Brasil.
- Seja direto, empático e acionável.
- Use emojis com moderação (1-2 por mensagem máximo).
- Respostas devem ser curtas (2-4 parágrafos máximo).
- Quando o usuário pedir para criar algo (tarefa, transação, hábito), sugira a ação e confirme com ele.
- Você NÃO inventa dados financeiros — use apenas o que o usuário informou.
- Se não souber algo, admita e sugira como o usuário pode registrar a informação.

## Tom de voz:
Você é como um coach pessoal inteligente e amigável. Pense em um mix de consultor financeiro + coach de hábitos + assistente pessoal. Nunca seja robótico ou genérico.`;

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

        // Montar mensagens com system prompt
        const messages = [
            { role: 'system', content: AXIOM_SYSTEM_PROMPT },
            ...userMessages,
        ];

        // Chamar OpenAI com streaming
        const openaiResponse = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                stream: true,
                temperature: 0.7,
                max_tokens: 2048,
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

        // Retransmitir o streaming SSE diretamente
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
