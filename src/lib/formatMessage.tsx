import React from 'react';

/**
 * Formata texto de mensagem em parágrafos <p>
 * - Quebra por linha dupla (\n\n) = novo parágrafo
 * - Linha simples (\n) = <br /> dentro do parágrafo
 */
export function formatMessageContent(text: string): React.ReactNode {
  if (!text) return null;
  
  // Sanitizar markdown residual que o modelo pode gerar
  let cleanText = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')     // Remove **negrito**
    .replace(/\*([^*]+)\*/g, '$1')          // Remove *itálico*
    .replace(/`([^`]+)`/g, '$1')            // Remove `código`
    .replace(/^#{1,6}\s+/gm, '')            // Remove ### headers
    .replace(/^\s*-\s+/gm, '→ ')            // - bullet → arrow
    .replace(/^\s*\*\s+(?=[A-Za-zÀ-ÿ])/gm, '→ ')  // * bullet → arrow (só se seguido de letra)
    .replace(/^\s*\d+\.\s+/gm, '→ ');       // 1. → arrow
  
  // Divide por linha dupla (parágrafos)
  const paragraphs = cleanText.split(/\n\n+/);
  
  return paragraphs.map((paragraph, index) => {
    // Dentro de cada parágrafo, converte \n em <br />
    const lines = paragraph.trim().split('\n');
    
    return (
      <p key={index}>
        {lines.map((line, lineIndex) => (
          <React.Fragment key={lineIndex}>
            {line}
            {lineIndex < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  });
}
