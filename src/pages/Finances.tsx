import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Plus, Trash2, Loader2, ChevronLeft, ChevronRight, Pencil, Wallet, PiggyBank, Check, Clock, RefreshCw, FileText } from "lucide-react";
import { generateFinancialPDF } from "@/lib/generateFinancialPDF";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isAfter, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useAxiomSync } from "@/contexts/AxiomSyncContext";
import { useDuplicateDetection } from "@/hooks/useDuplicateDetection";
import { EmptyState } from "@/components/ui/empty-state";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

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
  parent_transaction_id?: string;
  reference_month?: string;
  account_id?: string;
}

const PAYMENT_METHODS = ["PIX", "Débito", "Crédito"];

interface Account {
  id: string;
  name: string;
  balance: number;
  color: string;
  icon: string;
}

const EXPENSE_CATEGORIES = ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Lazer", "Compras", "Assinaturas", "Outros"];
const INCOME_CATEGORIES = ["Salário", "Freelance", "Investimentos", "Vendas", "Outros"];
const COLORS = ["#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#6366F1", "#84CC16", "#14B8A6"];
const ACCOUNT_COLORS = ["#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444"];
const ACCOUNT_ICONS = ["💳", "🏦", "💰", "💵", "🪙", "💎"];

export default function Finances() {
  const { user } = useAuth();
  const { notifyAction } = useAxiomSync();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  const [newTransaction, setNewTransaction] = useState({
    title: "",
    amount: "",
    type: "expense" as "income" | "expense",
    category: "",
    is_fixed: false,
    is_installment: false,
    total_installments: "",
    payment_method: "PIX",
    account_id: ""
  });

  const [newAccount, setNewAccount] = useState({
    name: "",
    balance: "",
    color: ACCOUNT_COLORS[0],
    icon: ACCOUNT_ICONS[0]
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, selectedMonth]);

  // Realtime sync for transactions
  const handleTransactionInsert = useCallback((newTx: Transaction) => {
    setTransactions(prev => {
      if (prev.some(t => t.id === newTx.id)) return prev;
      return [...prev, newTx];
    });
  }, []);

  const handleTransactionUpdate = useCallback((updatedTx: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
  }, []);

  const handleTransactionDelete = useCallback(({ old }: { old: Transaction }) => {
    setTransactions(prev => prev.filter(t => t.id !== old.id));
  }, []);

  useRealtimeSync<Transaction>('transactions', user?.id, {
    onInsert: handleTransactionInsert,
    onUpdate: handleTransactionUpdate,
    onDelete: handleTransactionDelete,
  });

  // Realtime sync for accounts
  const handleAccountInsert = useCallback((newAcc: Account) => {
    setAccounts(prev => {
      if (prev.some(a => a.id === newAcc.id)) return prev;
      return [...prev, newAcc];
    });
  }, []);

  const handleAccountUpdate = useCallback((updatedAcc: Account) => {
    setAccounts(prev => prev.map(a => a.id === updatedAcc.id ? updatedAcc : a));
  }, []);

  const handleAccountDelete = useCallback(({ old }: { old: Account }) => {
    setAccounts(prev => prev.filter(a => a.id !== old.id));
  }, []);

  useRealtimeSync<Account>('accounts', user?.id, {
    onInsert: handleAccountInsert,
    onUpdate: handleAccountUpdate,
    onDelete: handleAccountDelete,
  });

  // Duplicate detection
  const { hasDuplicates, duplicateCount, isDuplicate } = useDuplicateDetection(transactions);

  const loadData = async () => {
    setLoading(true);
    await generateRecurringTransactions();
    await Promise.all([loadTransactions(), loadAccounts()]);
    setLoading(false);
  };

  const generateRecurringTransactions = async () => {
    const referenceMonth = format(selectedMonth, "yyyy-MM");
    
    // Get original fixed transactions (those without parent_transaction_id)
    const { data: fixedTransactions, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user?.id)
      .eq("is_fixed", true)
      .is("parent_transaction_id", null);

    if (fetchError || !fixedTransactions) return;

    for (const original of fixedTransactions) {
      const originalDate = new Date(original.transaction_date);
      
      // Only create for months after or equal to the original transaction month
      if (isAfter(startOfMonth(selectedMonth), startOfMonth(originalDate)) || 
          isSameMonth(selectedMonth, originalDate)) {
        
        // Check if instance already exists for this month
        const { data: existing } = await supabase
          .from("transactions")
          .select("id")
          .eq("parent_transaction_id", original.id)
          .eq("reference_month", referenceMonth)
          .maybeSingle();

        // Also check if the original IS the transaction for this month
        const originalMonth = format(originalDate, "yyyy-MM");
        
        if (!existing && originalMonth !== referenceMonth) {
          // Create recurring instance for this month
          await supabase.from("transactions").insert({
            user_id: user?.id,
            title: original.title,
            amount: original.amount,
            type: original.type,
            category: original.category,
            is_fixed: true,
            is_paid: false,
            is_installment: false,
            payment_method: original.payment_method,
            parent_transaction_id: original.id,
            reference_month: referenceMonth,
            transaction_date: format(startOfMonth(selectedMonth), "yyyy-MM-dd")
          });
        }
      }
    }
  };

  const loadTransactions = async () => {
    const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user?.id)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd)
      .order("transaction_date", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar transações");
      return;
    }
    setTransactions((data || []) as Transaction[]);
  };

  const loadAccounts = async () => {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar contas");
      return;
    }
    setAccounts((data || []) as Account[]);
  };

  const createTransaction = async () => {
    if (!newTransaction.title || !newTransaction.amount || !newTransaction.category) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const referenceMonth = format(selectedMonth, "yyyy-MM");

    const { error } = await supabase.from("transactions").insert({
      user_id: user?.id,
      title: newTransaction.title,
      amount: parseFloat(newTransaction.amount),
      type: newTransaction.type,
      category: newTransaction.category,
      is_fixed: newTransaction.is_fixed,
      is_installment: newTransaction.is_installment,
      current_installment: newTransaction.is_installment ? 1 : null,
      total_installments: newTransaction.is_installment ? parseInt(newTransaction.total_installments) : null,
      transaction_date: format(selectedMonth, "yyyy-MM-dd"),
      payment_method: newTransaction.payment_method,
      is_paid: false,
      reference_month: newTransaction.is_fixed ? referenceMonth : null,
      account_id: newTransaction.account_id || null
    });

    if (error) {
      toast.error("Erro ao criar transação");
      return;
    }

    toast.success("Transação criada com sucesso!");
    setIsDialogOpen(false);
    setNewTransaction({
      title: "",
      amount: "",
      type: "expense",
      category: "",
      is_fixed: false,
      is_installment: false,
      total_installments: "",
      payment_method: "PIX",
      account_id: ""
    });
    loadData();
  };

  const payTransaction = async (id: string, type: string) => {
    const transaction = transactions.find(t => t.id === id);
    
    const { error } = await supabase
      .from("transactions")
      .update({ is_paid: true })
      .eq("id", id);

    if (error) {
      toast.error(type === "income" ? "Erro ao marcar receita" : "Erro ao pagar transação");
      return;
    }

    // Sincronizar saldo da conta se vinculada - BUSCAR DO BANCO
    if (transaction?.account_id) {
      const { data: currentAccount } = await supabase
        .from("accounts")
        .select("balance")
        .eq("id", transaction.account_id)
        .single();
      
      if (currentAccount) {
        const newBalance = type === "income" 
          ? currentAccount.balance + transaction.amount  // Receita: +saldo
          : currentAccount.balance - transaction.amount; // Despesa: -saldo
        
        await supabase
          .from("accounts")
          .update({ balance: newBalance })
          .eq("id", transaction.account_id);
      }
    }

    toast.success(type === "income" ? "Receita marcada como recebida! 💰" : "Transação marcada como paga! ✅");
    loadData();
  };

  const unpayTransaction = async (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    
    const { error } = await supabase
      .from("transactions")
      .update({ is_paid: false })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao desfazer pagamento");
      return;
    }

    // Reverter saldo da conta se vinculada - BUSCAR DO BANCO
    if (transaction?.account_id) {
      const { data: currentAccount } = await supabase
        .from("accounts")
        .select("balance")
        .eq("id", transaction.account_id)
        .single();
      
      if (currentAccount) {
        const newBalance = transaction.type === "income"
          ? currentAccount.balance - transaction.amount  // Receita: -saldo (reverte)
          : currentAccount.balance + transaction.amount; // Despesa: +saldo (reverte)
        
        await supabase
          .from("accounts")
          .update({ balance: newBalance })
          .eq("id", transaction.account_id);
      }
    }

    toast.success("Pagamento desfeito");
    loadData();
  };

  const updateTransaction = async () => {
    if (!editingTransaction) return;

    // Buscar transação original para comparar mudanças
    const originalTransaction = transactions.find(t => t.id === editingTransaction.id);

    const { error } = await supabase
      .from("transactions")
      .update({
        title: editingTransaction.title,
        amount: editingTransaction.amount,
        type: editingTransaction.type,
        category: editingTransaction.category,
        is_fixed: editingTransaction.is_fixed,
        is_installment: editingTransaction.is_installment,
        current_installment: editingTransaction.is_installment ? editingTransaction.current_installment : null,
        total_installments: editingTransaction.is_installment ? editingTransaction.total_installments : null,
        payment_method: editingTransaction.payment_method,
        account_id: editingTransaction.account_id || null
      })
      .eq("id", editingTransaction.id);

    if (error) {
      toast.error("Erro ao atualizar transação");
      return;
    }

    // Sincronizar saldos se transação estava paga - BUSCAR DO BANCO
    if (originalTransaction?.is_paid) {
      const oldAccountId = originalTransaction.account_id;
      const newAccountId = editingTransaction.account_id;

      // Mudou de conta?
      if (oldAccountId !== newAccountId) {
        // Reverter na conta antiga - BUSCAR DO BANCO
        if (oldAccountId) {
          const { data: oldAccount } = await supabase
            .from("accounts")
            .select("balance")
            .eq("id", oldAccountId)
            .single();
          
          if (oldAccount) {
            const revertedBalance = originalTransaction.type === "income"
              ? oldAccount.balance - originalTransaction.amount
              : oldAccount.balance + originalTransaction.amount;
            await supabase.from("accounts").update({ balance: revertedBalance }).eq("id", oldAccountId);
          }
        }
        // Aplicar na conta nova - BUSCAR DO BANCO
        if (newAccountId) {
          const { data: newAccount } = await supabase
            .from("accounts")
            .select("balance")
            .eq("id", newAccountId)
            .single();
          
          if (newAccount) {
            const newBalance = editingTransaction.type === "income"
              ? newAccount.balance + editingTransaction.amount
              : newAccount.balance - editingTransaction.amount;
            await supabase.from("accounts").update({ balance: newBalance }).eq("id", newAccountId);
          }
        }
      }
      // Mesma conta mas mudou valor/tipo? - BUSCAR DO BANCO
      else if (newAccountId && (originalTransaction.amount !== editingTransaction.amount || originalTransaction.type !== editingTransaction.type)) {
        const { data: account } = await supabase
          .from("accounts")
          .select("balance")
          .eq("id", newAccountId)
          .single();
        
        if (account) {
          // Reverter valor antigo
          let balance = originalTransaction.type === "income"
            ? account.balance - originalTransaction.amount
            : account.balance + originalTransaction.amount;
          // Aplicar novo valor
          balance = editingTransaction.type === "income"
            ? balance + editingTransaction.amount
            : balance - editingTransaction.amount;
          await supabase.from("accounts").update({ balance }).eq("id", newAccountId);
        }
      }
    }

    toast.success("Transação atualizada!");
    setIsEditDialogOpen(false);
    setEditingTransaction(null);
    loadData();
  };

  const deleteTransaction = async (id: string) => {
    // Also delete all recurring instances if deleting an original fixed transaction
    const transaction = transactions.find(t => t.id === id);
    
    // Se estava paga e tinha conta vinculada, reverter saldo - BUSCAR DO BANCO
    if (transaction?.is_paid && transaction?.account_id) {
      const { data: currentAccount } = await supabase
        .from("accounts")
        .select("balance")
        .eq("id", transaction.account_id)
        .single();
      
      if (currentAccount) {
        const newBalance = transaction.type === "income"
          ? currentAccount.balance - transaction.amount
          : currentAccount.balance + transaction.amount;
        
        await supabase
          .from("accounts")
          .update({ balance: newBalance })
          .eq("id", transaction.account_id);
      }
    }
    
    if (transaction?.is_fixed && !transaction.parent_transaction_id) {
      // This is an original fixed transaction - delete all its instances too
      await supabase.from("transactions").delete().eq("parent_transaction_id", id);
    }

    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir transação");
      return;
    }

    toast.success("Transação excluída!");
    loadData();
  };

  // Recalcular saldo da conta baseado em TODAS as transações pagas vinculadas
  const recalculateAccountBalance = async (accountId: string) => {
    const { data: paidTransactions, error } = await supabase
      .from("transactions")
      .select("amount, type")
      .eq("account_id", accountId)
      .eq("is_paid", true)
      .eq("user_id", user?.id);
    
    if (error) {
      toast.error("Erro ao recalcular saldo");
      return;
    }

    const newBalance = (paidTransactions || []).reduce((acc, t) => {
      return t.type === "income" ? acc + Number(t.amount) : acc - Number(t.amount);
    }, 0);
    
    await supabase.from("accounts").update({ balance: newBalance }).eq("id", accountId);
    toast.success("Saldo recalculado! ✅");
    loadAccounts();
  };

  const createAccount = async () => {
    if (!newAccount.name || !newAccount.balance) {
      toast.error("Preencha nome e saldo");
      return;
    }

    const { error } = await supabase.from("accounts").insert({
      user_id: user?.id,
      name: newAccount.name,
      balance: parseFloat(newAccount.balance),
      color: newAccount.color,
      icon: newAccount.icon
    });

    if (error) {
      toast.error("Erro ao criar conta");
      return;
    }

    toast.success("Conta criada!");
    setIsAccountDialogOpen(false);
    setNewAccount({ name: "", balance: "", color: ACCOUNT_COLORS[0], icon: ACCOUNT_ICONS[0] });
    loadAccounts();
  };

  const totalIncome = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = totalIncome - totalExpenses;
  const totalAccountBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  
  // Calculate pending amounts
  const pendingExpenses = transactions
    .filter(t => t.type === "expense" && !t.is_paid)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expensesByCategory = EXPENSE_CATEGORIES.map(cat => ({
    name: cat,
    value: transactions.filter(t => t.type === "expense" && t.category === cat).reduce((sum, t) => sum + Number(t.amount), 0)
  })).filter(item => item.value > 0);

  const comparisonData = [
    { name: "Receitas", value: totalIncome, fill: "#10B981" },
    { name: "Despesas", value: totalExpenses, fill: "#EF4444" }
  ];

  const navigateMonth = (direction: "prev" | "next") => {
    setSelectedMonth(prev => direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 pl-16 md:pl-6 md:p-6 space-y-6">
        {/* Header com filtro de mês */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Finanças</h1>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-lg font-medium min-w-[160px] text-center capitalize">
              {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth("next")}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                generateFinancialPDF({
                  month: selectedMonth,
                  transactions,
                  accounts,
                  totalIncome,
                  totalExpenses,
                  balance,
                  pendingExpenses,
                  expensesByCategory
                });
                toast.success("PDF gerado com sucesso!");
              }}
            >
              <FileText className="h-4 w-4 mr-2" /> Exportar PDF
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Nova Transação</Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nova Transação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input 
                    value={newTransaction.title} 
                    onChange={e => setNewTransaction(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex: Supermercado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input 
                    type="number" 
                    value={newTransaction.amount}
                    onChange={e => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={newTransaction.type} onValueChange={(v: "income" | "expense") => setNewTransaction(prev => ({ ...prev, type: v, category: "" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Despesa</SelectItem>
                      <SelectItem value="income">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={newTransaction.category} onValueChange={v => setNewTransaction(prev => ({ ...prev, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(newTransaction.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={newTransaction.payment_method} onValueChange={v => setNewTransaction(prev => ({ ...prev, payment_method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(pm => (
                        <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Despesa Fixa (recorrente)</Label>
                  <Switch checked={newTransaction.is_fixed} onCheckedChange={v => setNewTransaction(prev => ({ ...prev, is_fixed: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Parcelado</Label>
                  <Switch checked={newTransaction.is_installment} onCheckedChange={v => setNewTransaction(prev => ({ ...prev, is_installment: v }))} />
                </div>
                {newTransaction.is_installment && (
                  <div className="space-y-2">
                    <Label>Número de Parcelas</Label>
                    <Input 
                      type="number" 
                      value={newTransaction.total_installments}
                      onChange={e => setNewTransaction(prev => ({ ...prev, total_installments: e.target.value }))}
                      placeholder="12"
                    />
                  </div>
                )}
                {accounts.length > 0 && (
                  <div className="space-y-2">
                    <Label>Conta (opcional)</Label>
                    <Select 
                      value={newTransaction.account_id} 
                      onValueChange={v => setNewTransaction(prev => ({ ...prev, account_id: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhuma</SelectItem>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.icon} {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={createTransaction}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Cards de Resumo com Emojis */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-emerald-500/10 border-emerald-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">💰</span>
                <div>
                  <p className="text-sm text-emerald-400 font-medium">Receitas</p>
                  <p className="text-2xl font-bold text-emerald-500">
                    R$ {totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">💸</span>
                <div>
                  <p className="text-sm text-red-400 font-medium">Despesas</p>
                  <p className="text-2xl font-bold text-red-500">
                    R$ {totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">⏳</span>
                <div>
                  <p className="text-sm text-yellow-400 font-medium">Pendente</p>
                  <p className="text-2xl font-bold text-yellow-500">
                    R$ {pendingExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${balance >= 0 ? "bg-violet-500/10 border-violet-500/30" : "bg-orange-500/10 border-orange-500/30"}`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🎯</span>
                <div>
                  <p className={`text-sm font-medium ${balance >= 0 ? "text-violet-400" : "text-orange-400"}`}>Saldo</p>
                  <p className={`text-2xl font-bold ${balance >= 0 ? "text-violet-500" : "text-orange-500"}`}>
                    R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contas Bancárias */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" /> Minhas Contas
            </CardTitle>
            <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Nova Conta</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Conta</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome da Conta</Label>
                    <Input 
                      value={newAccount.name}
                      onChange={e => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Nubank"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Saldo Atual (R$)</Label>
                    <Input 
                      type="number"
                      value={newAccount.balance}
                      onChange={e => setNewAccount(prev => ({ ...prev, balance: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ícone</Label>
                    <div className="flex gap-2">
                      {ACCOUNT_ICONS.map(icon => (
                        <button
                          key={icon}
                          onClick={() => setNewAccount(prev => ({ ...prev, icon }))}
                          className={`text-2xl p-2 rounded-lg ${newAccount.icon === icon ? "bg-primary/20 ring-2 ring-primary" : "bg-muted"}`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <div className="flex gap-2">
                      {ACCOUNT_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => setNewAccount(prev => ({ ...prev, color }))}
                          className={`w-8 h-8 rounded-full ${newAccount.color === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createAccount}>Criar Conta</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>Nenhuma conta cadastrada</p>
                <p className="text-sm">Adicione contas para controlar seus saldos</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {accounts.map(account => (
                    <div
                      key={account.id}
                      className="p-4 rounded-xl border"
                      style={{ borderColor: account.color + "50", backgroundColor: account.color + "10" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{account.icon}</span>
                          <span className="font-medium truncate">{account.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-60 hover:opacity-100"
                          onClick={() => recalculateAccountBalance(account.id)}
                          title="Recalcular saldo"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-lg font-bold" style={{ color: account.color }}>
                        R$ {Number(account.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <PiggyBank className="h-5 w-5 text-primary" />
                    <span className="font-medium">Saldo Total</span>
                  </div>
                  <span className="text-xl font-bold text-primary">
                    R$ {totalAccountBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Pizza - Despesas por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle>Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {expensesByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={expensesByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {expensesByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))", 
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))"
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-16">Sem despesas neste mês</p>
              )}
              {expensesByCategory.length > 0 && (
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {expensesByCategory.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-muted-foreground">{cat.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de Barras - Receitas x Despesas */}
          <Card>
            <CardHeader>
              <CardTitle>Receitas x Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={comparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number" 
                    tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={80}
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <Tooltip 
                    formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))", 
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))"
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="value" name="Valor" radius={[0, 8, 8, 0]}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Últimas Transações */}
        <Card>
          <CardHeader>
            <CardTitle>Transações do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            {hasDuplicates && (
              <Alert className="mb-4 border-amber-500/30 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-500">
                  Detectadas {duplicateCount} possíveis transações duplicadas (mesmo título, valor e data).
                </AlertDescription>
              </Alert>
            )}
            {transactions.length === 0 ? (
              <EmptyState
                icon={<Wallet className="h-8 w-8" />}
                title="Nenhuma transação neste mês"
                description="Registre suas receitas e despesas para ter controle total das suas finanças."
                action={{
                  label: 'Nova Transação',
                  onClick: () => setIsDialogOpen(true),
                }}
                secondaryAction={{
                  label: 'Pedir ao Axiom',
                  onClick: () => navigate('/'),
                }}
              />
            ) : (
              <div className="space-y-3">
                {transactions.map(transaction => (
                  <div 
                    key={transaction.id} 
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border transition-all",
                      isDuplicate(transaction.id) && "ring-2 ring-amber-500/50",
                      transaction.is_paid 
                        ? "bg-muted/20 border-border/30" 
                        : transaction.type === "income"
                          ? "bg-cyan-500/5 border-cyan-500/20"
                          : "bg-yellow-500/5 border-yellow-500/20"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`font-medium ${transaction.is_paid ? "text-muted-foreground" : ""}`}>
                          {transaction.title}
                        </p>
                        <span className="text-sm text-muted-foreground">
                          • {format(new Date(transaction.transaction_date), "dd/MM", { locale: ptBR })}
                        </span>
                        {transaction.is_fixed && (
                          <Badge variant="outline" className="text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Fixa
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {transaction.category}
                        {transaction.payment_method && ` • ${transaction.payment_method}`}
                        {transaction.account_id && ` • ${accounts.find(a => a.id === transaction.account_id)?.icon} ${accounts.find(a => a.id === transaction.account_id)?.name}`}
                        {transaction.is_installment && ` • ${transaction.current_installment}/${transaction.total_installments}`}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Status Badge */}
                      {transaction.is_paid ? (
                        <Badge 
                          variant="outline" 
                          className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20"
                          onClick={() => unpayTransaction(transaction.id)}
                          title="Clique para desfazer"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          {transaction.type === "income" ? "Recebido" : "Pago"}
                        </Badge>
                      ) : (
                        <Badge 
                          variant="outline" 
                          className={transaction.type === "income" 
                            ? "bg-cyan-500/10 text-cyan-500 border-cyan-500/30"
                            : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                          }
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                      
                      {/* Amount */}
                      <span className={`font-bold min-w-[100px] text-right ${
                        transaction.type === "income" 
                          ? "text-emerald-500" 
                          : transaction.is_paid 
                            ? "text-muted-foreground line-through" 
                            : "text-red-500"
                      }`}>
                        {transaction.type === "income" ? "+" : "-"}R$ {Number(transaction.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      
                      {/* Pay Button */}
                      {!transaction.is_paid && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => payTransaction(transaction.id, transaction.type)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          {transaction.type === "income" ? "Receber" : "Pagar"}
                        </Button>
                      )}
                      
                      {/* Edit Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingTransaction(transaction);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      
                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTransaction(transaction.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Edição */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Transação</DialogTitle>
            </DialogHeader>
            {editingTransaction && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input 
                    value={editingTransaction.title}
                    onChange={e => setEditingTransaction(prev => prev ? { ...prev, title: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input 
                    type="number"
                    value={editingTransaction.amount}
                    onChange={e => setEditingTransaction(prev => prev ? { ...prev, amount: parseFloat(e.target.value) || 0 } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={editingTransaction.type} 
                    onValueChange={(v: "income" | "expense") => setEditingTransaction(prev => prev ? { ...prev, type: v } : null)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Despesa</SelectItem>
                      <SelectItem value="income">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select 
                    value={editingTransaction.category} 
                    onValueChange={v => setEditingTransaction(prev => prev ? { ...prev, category: v } : null)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(editingTransaction.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select 
                    value={editingTransaction.payment_method || "PIX"} 
                    onValueChange={v => setEditingTransaction(prev => prev ? { ...prev, payment_method: v } : null)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(pm => (
                        <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conta Vinculada</Label>
                  <Select 
                    value={editingTransaction.account_id || "none"} 
                    onValueChange={v => setEditingTransaction(prev => 
                      prev ? { ...prev, account_id: v === "none" ? undefined : v } : null
                    )}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.icon} {acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Despesa Fixa</Label>
                  <Switch 
                    checked={editingTransaction.is_fixed} 
                    onCheckedChange={v => setEditingTransaction(prev => prev ? { ...prev, is_fixed: v } : null)} 
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button onClick={updateTransaction}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
