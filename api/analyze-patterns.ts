/**
 * Vercel Serverless Function — Análise de Padrões (Stub)
 * Fase futura: analisar dados do usuário e gerar perguntas proativas.
 *
 * Por enquanto, retorna resposta vazia para evitar erros no frontend.
 */

export const config = {
    runtime: 'edge',
};

export default async function handler(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Stub — retorna sem perguntas por enquanto
    return new Response(
        JSON.stringify({
            success: true,
            question: null,
            message: 'Análise de padrões será implementada em fase futura',
        }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}
