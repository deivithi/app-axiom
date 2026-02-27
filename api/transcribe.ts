/**
 * Vercel Serverless Function — Transcrição de Áudio
 * Proxy para a API Whisper da OpenAI.
 *
 * O frontend envia: FormData com campo 'audio' (Blob webm)
 * A função retorna: { text: "transcrição" }
 */

const OPENAI_WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: 'OPENAI_API_KEY não configurada no servidor' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio');

        if (!audioFile || !(audioFile instanceof Blob)) {
            return new Response(
                JSON.stringify({ error: 'Arquivo de áudio não encontrado' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Montar FormData para a API Whisper
        const whisperFormData = new FormData();
        whisperFormData.append('file', audioFile, 'audio.webm');
        whisperFormData.append('model', 'whisper-1');
        whisperFormData.append('language', 'pt');
        whisperFormData.append('response_format', 'json');

        const whisperResponse = await fetch(OPENAI_WHISPER_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
            body: whisperFormData,
        });

        if (!whisperResponse.ok) {
            const errorText = await whisperResponse.text();
            console.error('Whisper API error:', whisperResponse.status, errorText);
            return new Response(
                JSON.stringify({ error: `Erro na transcrição: ${whisperResponse.status}` }),
                { status: whisperResponse.status, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const result = await whisperResponse.json();

        return new Response(JSON.stringify({ text: result.text }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Transcribe handler error:', error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Erro na transcrição',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
