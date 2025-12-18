import React from 'react';

/**
 * Formata texto de mensagem em parágrafos <p>
 * - Quebra por linha dupla (\n\n) = novo parágrafo
 * - Linha simples (\n) = <br /> dentro do parágrafo
 */
export function formatMessageContent(text: string): React.ReactNode {
  if (!text) return null;
  
  // Divide por linha dupla (parágrafos)
  const paragraphs = text.split(/\n\n+/);
  
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
