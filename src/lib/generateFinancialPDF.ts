import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizePortugueseText } from './robotoFont';

interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  transaction_date: string;
  is_fixed: boolean;
  is_installment: boolean;
  current_installment?: number;
  total_installments?: number;
  payment_method?: string;
  is_paid: boolean;
}

interface Account {
  id: string;
  name: string;
  balance: number;
  color: string;
  icon: string;
}

interface PDFData {
  month: Date;
  transactions: Transaction[];
  accounts: Account[];
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  pendingExpenses: number;
  expensesByCategory: { name: string; value: number }[];
}

// Helper to safely render text with Portuguese characters
const safeText = (text: string): string => normalizePortugueseText(text);

export function generateFinancialPDF(data: PDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 0;

  const monthName = format(data.month, "MMMM yyyy", { locale: ptBR });
  const capitalizedMonth = safeText(monthName.charAt(0).toUpperCase() + monthName.slice(1));

  // Colors
  const primaryColor: [number, number, number] = [99, 102, 241]; // Indigo
  const greenColor: [number, number, number] = [16, 185, 129];
  const redColor: [number, number, number] = [239, 68, 68];
  const grayColor: [number, number, number] = [107, 114, 128];
  const darkColor: [number, number, number] = [17, 24, 39];

  // ============ PAGE 1: EXECUTIVE SUMMARY ============
  
  // Header background
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Logo text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('AXIOM', margin, 25);

  // Subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Personal AI Governance', margin, 35);

  // Report title
  doc.setFontSize(14);
  doc.text(`Relatório Financeiro - ${capitalizedMonth}`, pageWidth - margin, 30, { align: 'right' });

  yPos = 60;

  // Summary Cards Section Title
  doc.setTextColor(...darkColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo do Mês', margin, yPos);
  yPos += 15;

  // Summary Cards
  const cardWidth = (pageWidth - margin * 2 - 15) / 4;
  const cardHeight = 35;
  
  const summaryCards = [
    { label: 'Receitas', value: data.totalIncome, color: greenColor, emoji: '💰' },
    { label: 'Despesas', value: data.totalExpenses, color: redColor, emoji: '💸' },
    { label: 'Pendente', value: data.pendingExpenses, color: [245, 158, 11] as [number, number, number], emoji: '🕐' },
    { label: 'Saldo', value: data.balance, color: data.balance >= 0 ? greenColor : redColor, emoji: '🎯' }
  ];

  summaryCards.forEach((card, index) => {
    const x = margin + index * (cardWidth + 5);
    
    // Card border
    doc.setDrawColor(...card.color);
    doc.setLineWidth(1);
    doc.roundedRect(x, yPos, cardWidth, cardHeight, 3, 3, 'S');
    
    // Card content
    doc.setFontSize(10);
    doc.setTextColor(...grayColor);
    doc.text(card.label, x + 5, yPos + 12);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...card.color);
    const valueText = `R$ ${card.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    doc.text(valueText, x + 5, yPos + 26);
  });

  yPos += cardHeight + 20;

  // Expenses by Category Section
  if (data.expensesByCategory.length > 0) {
    doc.setTextColor(...darkColor);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Despesas por Categoria', margin, yPos);
    yPos += 12;

    const categoryColors: [number, number, number][] = [
      [139, 92, 246], [236, 72, 153], [245, 158, 11], [16, 185, 129],
      [59, 130, 246], [239, 68, 68], [99, 102, 241], [132, 204, 22], [20, 184, 166]
    ];

    const sortedCategories = [...data.expensesByCategory].sort((a, b) => b.value - a.value);
    const totalCategoryExpenses = sortedCategories.reduce((sum, c) => sum + c.value, 0);

    sortedCategories.forEach((category, index) => {
      const percentage = totalCategoryExpenses > 0 ? (category.value / totalCategoryExpenses * 100) : 0;
      const barWidth = (pageWidth - margin * 2 - 100) * (percentage / 100);
      const color = categoryColors[index % categoryColors.length];

      // Category name
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkColor);
      doc.text(category.name, margin, yPos + 4);

      // Progress bar background
      doc.setFillColor(229, 231, 235);
      doc.roundedRect(margin + 70, yPos - 2, pageWidth - margin * 2 - 130, 8, 2, 2, 'F');

      // Progress bar fill
      if (barWidth > 0) {
        doc.setFillColor(...color);
        doc.roundedRect(margin + 70, yPos - 2, Math.max(barWidth, 4), 8, 2, 2, 'F');
      }

      // Value and percentage
      doc.setTextColor(...grayColor);
      doc.setFontSize(9);
      const valueStr = `R$ ${category.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${percentage.toFixed(1)}%)`;
      doc.text(valueStr, pageWidth - margin, yPos + 4, { align: 'right' });

      yPos += 14;
    });
  }

  yPos += 10;

  // Income vs Expenses Comparison
  doc.setTextColor(...darkColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Comparativo Receitas vs Despesas', margin, yPos);
  yPos += 15;

  const maxValue = Math.max(data.totalIncome, data.totalExpenses);
  const barMaxWidth = pageWidth - margin * 2 - 80;

  // Income bar
  doc.setFontSize(11);
  doc.setTextColor(...darkColor);
  doc.text('Receitas', margin, yPos + 5);
  
  const incomeBarWidth = maxValue > 0 ? (data.totalIncome / maxValue) * barMaxWidth : 0;
  doc.setFillColor(...greenColor);
  doc.roundedRect(margin + 55, yPos - 2, Math.max(incomeBarWidth, 4), 12, 3, 3, 'F');
  
  doc.setTextColor(...greenColor);
  doc.text(`R$ ${data.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin, yPos + 5, { align: 'right' });

  yPos += 20;

  // Expense bar
  doc.setTextColor(...darkColor);
  doc.text('Despesas', margin, yPos + 5);
  
  const expenseBarWidth = maxValue > 0 ? (data.totalExpenses / maxValue) * barMaxWidth : 0;
  doc.setFillColor(...redColor);
  doc.roundedRect(margin + 55, yPos - 2, Math.max(expenseBarWidth, 4), 12, 3, 3, 'F');
  
  doc.setTextColor(...redColor);
  doc.text(`R$ ${data.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin, yPos + 5, { align: 'right' });

  // ============ PAGE 2: TRANSACTIONS ============
  doc.addPage();
  yPos = margin;

  // Page 2 Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Transações - ${capitalizedMonth}`, margin, 16);

  yPos = 40;

  // Table Header
  const colWidths = { date: 20, title: 55, category: 35, method: 25, amount: 30, status: 20 };
  
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, yPos - 5, pageWidth - margin * 2, 12, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  
  let xPos = margin + 3;
  doc.text('Data', xPos, yPos + 2);
  xPos += colWidths.date;
  doc.text('Título', xPos, yPos + 2);
  xPos += colWidths.title;
  doc.text('Categoria', xPos, yPos + 2);
  xPos += colWidths.category;
  doc.text('Método', xPos, yPos + 2);
  xPos += colWidths.method;
  doc.text('Valor', xPos, yPos + 2);
  xPos += colWidths.amount;
  doc.text('Status', xPos, yPos + 2);

  yPos += 15;

  // Sort transactions by date
  const sortedTransactions = [...data.transactions].sort((a, b) => 
    new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );

  // Transaction rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  sortedTransactions.forEach((tx, index) => {
    // Check if we need a new page
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = margin;
      
      // Repeat header on new page
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, yPos - 5, pageWidth - margin * 2, 12, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkColor);
      
      xPos = margin + 3;
      doc.text('Data', xPos, yPos + 2);
      xPos += colWidths.date;
      doc.text('Título', xPos, yPos + 2);
      xPos += colWidths.title;
      doc.text('Categoria', xPos, yPos + 2);
      xPos += colWidths.category;
      doc.text('Método', xPos, yPos + 2);
      xPos += colWidths.method;
      doc.text('Valor', xPos, yPos + 2);
      xPos += colWidths.amount;
      doc.text('Status', xPos, yPos + 2);
      
      yPos += 15;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    // Alternate row background
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, yPos - 4, pageWidth - margin * 2, 10, 'F');
    }

    xPos = margin + 3;
    doc.setTextColor(...darkColor);
    
    // Date
    const txDate = format(new Date(tx.transaction_date), 'dd/MM');
    doc.text(txDate, xPos, yPos + 2);
    xPos += colWidths.date;

    // Title (truncate if too long)
    let title = tx.title;
    if (tx.is_installment && tx.current_installment && tx.total_installments) {
      title += ` (${tx.current_installment}/${tx.total_installments})`;
    }
    if (title.length > 25) title = title.substring(0, 22) + '...';
    doc.text(title, xPos, yPos + 2);
    xPos += colWidths.title;

    // Category
    const category = tx.category.length > 12 ? tx.category.substring(0, 10) + '...' : tx.category;
    doc.text(category, xPos, yPos + 2);
    xPos += colWidths.category;

    // Payment method
    doc.text(tx.payment_method || '-', xPos, yPos + 2);
    xPos += colWidths.method;

    // Amount
    const amountColor = tx.type === 'income' ? greenColor : redColor;
    doc.setTextColor(...amountColor);
    const prefix = tx.type === 'income' ? '+' : '-';
    doc.text(`${prefix} R$ ${tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, xPos, yPos + 2);
    xPos += colWidths.amount;

    // Status
    doc.setTextColor(...(tx.is_paid ? greenColor : [245, 158, 11] as [number, number, number]));
    doc.text(tx.is_paid ? 'Pago' : 'Pendente', xPos, yPos + 2);

    yPos += 10;
  });

  // ============ PAGE 3: ACCOUNTS (if any) ============
  if (data.accounts.length > 0) {
    doc.addPage();
    yPos = margin;

    // Page 3 Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Contas Bancárias', margin, 16);

    yPos = 45;

    // Total balance card
    const totalBalance = data.accounts.reduce((sum, acc) => sum + acc.balance, 0);
    
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 30, 5, 5, 'F');
    
    doc.setTextColor(...grayColor);
    doc.setFontSize(12);
    doc.text('Saldo Total Consolidado', margin + 10, yPos + 12);
    
    doc.setTextColor(...(totalBalance >= 0 ? greenColor : redColor));
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 10, yPos + 24);

    yPos += 45;

    // Individual accounts
    doc.setTextColor(...darkColor);
    doc.setFontSize(14);
    doc.text('Detalhamento por Conta', margin, yPos);
    yPos += 15;

    data.accounts.forEach((account) => {
      // Account card
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 25, 3, 3, 'S');

      // Account icon and name
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkColor);
      doc.text(`${account.icon} ${account.name}`, margin + 8, yPos + 10);

      // Account balance
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...(account.balance >= 0 ? greenColor : redColor));
      doc.setFontSize(12);
      doc.text(`R$ ${account.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 8, yPos + 20);

      yPos += 30;
    });
  }

  // ============ FOOTER ON ALL PAGES ============
  const totalPages = doc.getNumberOfPages();
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Footer line
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    
    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text('Gerado por Axiom - Personal AI Governance', margin, pageHeight - 8);
    doc.text(format(new Date(), "dd/MM/yyyy 'às' HH:mm"), pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  // Save the PDF
  const fileName = `axiom-financeiro-${format(data.month, 'yyyy-MM')}.pdf`;
  doc.save(fileName);
  
  return fileName;
}
