import { useMemo } from 'react';

interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: string;
  transaction_date: string;
}

interface DuplicateGroup {
  key: string;
  transactions: Transaction[];
}

export function useDuplicateDetection(transactions: Transaction[]) {
  const duplicates = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    
    transactions.forEach(tx => {
      // Criar chave baseada em título normalizado + valor + data (normalizada para YYYY-MM-DD)
      const normalizedTitle = tx.title.toLowerCase().trim();
      const normalizedDate = tx.transaction_date.substring(0, 10); // Garante formato YYYY-MM-DD
      const key = `${normalizedTitle}|${tx.amount}|${tx.type}|${normalizedDate}`;
      
      const existing = groups.get(key) || [];
      existing.push(tx);
      groups.set(key, existing);
    });
    
    // Filtrar apenas grupos com mais de 1 transação
    const duplicateGroups: DuplicateGroup[] = [];
    groups.forEach((txs, key) => {
      if (txs.length > 1) {
        duplicateGroups.push({ key, transactions: txs });
      }
    });
    
    return duplicateGroups;
  }, [transactions]);

  const hasDuplicates = duplicates.length > 0;
  const duplicateCount = duplicates.reduce((acc, g) => acc + g.transactions.length, 0);
  
  const isDuplicate = (transactionId: string) => {
    return duplicates.some(g => g.transactions.some(tx => tx.id === transactionId));
  };

  return {
    duplicates,
    hasDuplicates,
    duplicateCount,
    isDuplicate,
  };
}
