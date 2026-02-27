import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizePortugueseText } from './robotoFont';
import { formatCurrency } from './utils';

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

  const monthName = format(data.month, "MMMM yyyy", { locale: ptBR });
  const capitalizedMonth = safeText(monthName.charAt(0).toUpperCase() + monthName.slice(1));

  // Axiom Premium Color Palette
  const colors = {
    primary: [79, 70, 229] as [number, number, number],      // Indigo 600
    primaryLight: [238, 242, 255] as [number, number, number],// Indigo 50
    secondary: [17, 24, 39] as [number, number, number],    // Gray 900
    gray: [107, 114, 128] as [number, number, number],      // Gray 500
    lightGray: [243, 244, 246] as [number, number, number], // Gray 100
    green: [16, 185, 129] as [number, number, number],      // Emerald 500
    red: [239, 68, 68] as [number, number, number],         // Red 500
    orange: [245, 158, 11] as [number, number, number],     // Amber 500
    white: [255, 255, 255] as [number, number, number],
  };

  // Helper for drawing cards
  const drawCard = (doc: jsPDF, x: number, y: number, w: number, h: number, fillColor: [number, number, number], borderColor?: [number, number, number]) => {
    doc.setFillColor(...fillColor);
    doc.roundedRect(x, y, w, h, 3, 3, borderColor ? 'FD' : 'F');
    if (borderColor) {
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, w, h, 3, 3, 'S');
    }
  };

  // ==========================================
  // PAGE 1: EXECUTIVE DASHBOARD
  // ==========================================

  // 1. HEADER (Gradient-like Top Bar)
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 50, 'F');

  doc.setTextColor(...colors.white);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text('AXIOM', margin, 28);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Personal AI Governance', margin, 38);

  doc.setFontSize(14);
  doc.text(`Financial Report`, pageWidth - margin, 26, { align: 'right' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(capitalizedMonth, pageWidth - margin, 38, { align: 'right' });

  let startY = 65;

  // 2. FINANCIAL SUMMARY (Metrics Cards)
  doc.setTextColor(...colors.secondary);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(safeText('Resumo do Mês'), margin, startY);

  const cardY = startY + 8;
  const cardH = 32;
  const spacing = 5;
  const cardW = (pageWidth - (margin * 2) - (spacing * 3)) / 4;

  const metrics = [
    { title: 'Receitas', value: data.totalIncome, valColor: colors.green },
    { title: 'Despesas', value: data.totalExpenses, valColor: colors.red },
    { title: 'Pendente', value: data.pendingExpenses, valColor: colors.orange },
    { title: 'Saldo Final', value: data.balance, valColor: data.balance >= 0 ? colors.green : colors.red }
  ];

  metrics.forEach((m, i) => {
    const cx = margin + i * (cardW + spacing);
    // Draw subtle card background
    drawCard(doc, cx, cardY, cardW, cardH, colors.white, colors.lightGray);

    // Title
    doc.setFontSize(9);
    doc.setTextColor(...colors.gray);
    doc.setFont('helvetica', 'bold');
    doc.text(safeText(m.title.toUpperCase()), cx + 5, cardY + 10);

    // Value
    doc.setFontSize(12);
    doc.setTextColor(...m.valColor);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(m.value), cx + 5, cardY + 24);
  });

  startY = cardY + cardH + 20;

  // 3. COMPARATIVE CHART (Visual Bar)
  doc.setTextColor(...colors.secondary);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Fluxo de Caixa', margin, startY);

  const chartY = startY + 8;
  const chartH = 45;
  drawCard(doc, margin, chartY, pageWidth - margin * 2, chartH, colors.white, colors.lightGray);

  const maxValue = Math.max(data.totalIncome, data.totalExpenses);
  const barMaxW = pageWidth - margin * 2 - 100;

  // Income Bar
  doc.setFontSize(10);
  doc.setTextColor(...colors.secondary);
  doc.setFont('helvetica', 'normal');
  doc.text('Entradas', margin + 10, chartY + 18);

  const inW = maxValue > 0 ? (data.totalIncome / maxValue) * barMaxW : 0;
  doc.setFillColor(...colors.green);
  doc.roundedRect(margin + 35, chartY + 11, Math.max(inW, 2), 10, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.totalIncome), pageWidth - margin - 10, chartY + 18, { align: 'right' });

  // Expense Bar
  doc.setFont('helvetica', 'normal');
  doc.text('Saídas', margin + 10, chartY + 33);

  const outW = maxValue > 0 ? (data.totalExpenses / maxValue) * barMaxW : 0;
  doc.setFillColor(...colors.red);
  doc.roundedRect(margin + 35, chartY + 26, Math.max(outW, 2), 10, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.totalExpenses), pageWidth - margin - 10, chartY + 33, { align: 'right' });

  startY = chartY + chartH + 20;

  // 4. EXPENSES BY CATEGORY
  if (data.expensesByCategory.length > 0) {
    doc.setTextColor(...colors.secondary);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Despesas por Categoria', margin, startY);

    const sortedCats = [...data.expensesByCategory].sort((a, b) => b.value - a.value);

    // Prepare data for autotable
    const catData = sortedCats.map(c => [
      safeText(c.name),
      formatCurrency(c.value),
      `${((c.value / data.totalExpenses) * 100).toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: startY + 8,
      head: [['Categoria', 'Valor (R$)', 'Representatividade']],
      body: catData,
      theme: 'grid',
      headStyles: {
        fillColor: colors.primaryLight,
        textColor: colors.primary,
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 40 },
        2: { halign: 'right', cellWidth: 40 }
      },
      styles: {
        font: 'helvetica',
        fontSize: 10,
        textColor: colors.secondary,
        lineColor: colors.lightGray,
        lineWidth: 0.1,
        cellPadding: 5
      },
      alternateRowStyles: {
        fillColor: [252, 252, 252]
      },
      margin: { left: margin, right: margin }
    });
  }

  // ==========================================
  // PAGE 2: TRANSACTIONS DETAILS
  // ==========================================
  doc.addPage();

  // Minimalist Header for subsequent pages
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 15, 'F');

  doc.setFontSize(18);
  doc.setTextColor(...colors.secondary);
  doc.setFont('helvetica', 'bold');
  doc.text(safeText('Detalhamento de Transações'), margin, 35);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.gray);
  doc.text(safeText(`Relatório completo de movimentos em ${capitalizedMonth}`), margin, 42);

  // Sorting
  const sortedTransactions = [...data.transactions].sort((a, b) =>
    new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );

  // Table Data mapping
  const txData = sortedTransactions.map(tx => {
    let title = safeText(tx.title);
    if (tx.is_installment && tx.current_installment && tx.total_installments) {
      title += ` (${tx.current_installment}/${tx.total_installments})`;
    }

    const formattedDate = format(new Date(tx.transaction_date), 'dd/MM/yyyy');
    const amountStr = `${tx.type === 'income' ? '+' : '-'} R$ ${tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const status = tx.is_paid ? 'Pago' : 'Pendente';

    return [
      formattedDate,
      title,
      safeText(tx.category),
      amountStr,
      status
    ];
  });

  autoTable(doc, {
    startY: 50,
    head: [['Data', 'Descrição', 'Categoria', 'Valor', 'Status']],
    body: txData,
    theme: 'grid',
    headStyles: {
      fillColor: colors.secondary, // Dark header
      textColor: colors.white,
      fontStyle: 'bold'
    },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: colors.secondary,
      lineColor: colors.lightGray,
      lineWidth: 0.1,
      cellPadding: 4,
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 25 }, // Date
      1: { cellWidth: 'auto' }, // Desc
      2: { cellWidth: 40 }, // Cat
      3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }, // Amount
      4: { cellWidth: 25, halign: 'center' } // Status
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251] // bg-gray-50
    },
    didParseCell: function (param: any) {
      // Custom styling for explicit cells
      if (param.section === 'body') {
        // Amount color formatting
        if (param.column.index === 3) {
          const val = param.cell.raw as string;
          param.cell.styles.textColor = val.startsWith('+') ? colors.green : colors.red;
        }
        // Status color formatting
        if (param.column.index === 4) {
          const val = param.cell.raw as string;
          if (val === 'Pago') {
            param.cell.styles.textColor = colors.green;
            param.cell.styles.fontStyle = 'bold';
          } else {
            param.cell.styles.textColor = colors.orange;
          }
        }
      }
    },
    margin: { left: margin, right: margin, bottom: 25 }
  });

  // ==========================================
  // PAGE 3: ACCOUNTS LISTING (Optional)
  // ==========================================
  if (data.accounts.length > 0) {
    const yAfterTx = (doc as any).lastAutoTable.finalY + 20;

    // Create new page if not enough space
    if (yAfterTx > pageHeight - 80) {
      doc.addPage();
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageWidth, 15, 'F');
      startY = 35;
    } else {
      startY = yAfterTx;
    }

    doc.setFontSize(16);
    doc.setTextColor(...colors.secondary);
    doc.setFont('helvetica', 'bold');
    doc.text(safeText('Saldos e Contas'), margin, startY);

    const accountsData = data.accounts.map(acc => [
      safeText(acc.name),
      formatCurrency(acc.balance)
    ]);

    autoTable(doc, {
      startY: startY + 8,
      head: [['Conta', 'Saldo Base']],
      body: accountsData,
      theme: 'grid',
      headStyles: {
        fillColor: colors.primaryLight,
        textColor: colors.primary,
        fontStyle: 'bold'
      },
      styles: {
        font: 'helvetica',
        fontSize: 10,
        textColor: colors.secondary,
        lineColor: colors.lightGray,
        lineWidth: 0.1,
        cellPadding: 6
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: function (param: any) {
        if (param.section === 'body' && param.column.index === 1) {
          const rawRaw = param.row.raw[1] as string;
          param.cell.styles.textColor = rawRaw.includes('-') ? colors.red : colors.green;
        }
      },
      margin: { left: margin, right: margin }
    });
  }

  // ==========================================
  // GLOBAL FOOTERS
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  const generationDate = format(new Date(), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR });

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(...colors.lightGray);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(...colors.gray);
    doc.text('Axiom AI - Relatório Oficial', margin, pageHeight - 8);
    doc.text(safeText(`Gerado em ${generationDate}`), pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  // Save the PDF
  const fileName = `Axiom_Relatorio_${format(data.month, 'yyyy_MM')}.pdf`;
  doc.save(fileName);

  return fileName;
}
