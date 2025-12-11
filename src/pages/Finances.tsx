import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, TrendingUp, TrendingDown, Wallet, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  transaction_date: string;
  is_fixed: boolean;
  is_installment: boolean;
  total_installments: number | null;
  current_installment: number | null;
}

const categories = {
  income: ['Salário', 'Freelance', 'Investimentos', 'Outros'],
  expense: ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Outros'],
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Finances() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [newTransaction, setNewTransaction] = useState({
    title: '',
    amount: '',
    type: 'expense' as const,
    category: '',
    is_fixed: false,
    is_installment: false,
    total_installments: '',
  });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) loadTransactions();
  }, [user, currentMonth]);

  const loadTransactions = async () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('transaction_date', format(start, 'yyyy-MM-dd'))
      .lte('transaction_date', format(end, 'yyyy-MM-dd'))
      .order('transaction_date', { ascending: false });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar transações', variant: 'destructive' });
    } else {
      setTransactions((data || []) as Transaction[]);
    }
    setLoading(false);
  };

  const createTransaction = async () => {
    if (!newTransaction.title.trim() || !newTransaction.amount || !newTransaction.category) return;

    const { error } = await supabase.from('transactions').insert({
      user_id: user?.id,
      title: newTransaction.title,
      amount: parseFloat(newTransaction.amount),
      type: newTransaction.type,
      category: newTransaction.category,
      is_fixed: newTransaction.is_fixed,
      is_installment: newTransaction.is_installment,
      total_installments: newTransaction.is_installment ? parseInt(newTransaction.total_installments) : null,
      current_installment: newTransaction.is_installment ? 1 : null,
    });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao criar transação', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Transação registrada!' });
      setNewTransaction({
        title: '',
        amount: '',
        type: 'expense',
        category: '',
        is_fixed: false,
        is_installment: false,
        total_installments: '',
      });
      setDialogOpen(false);
      loadTransactions();
    }
  };

  const deleteTransaction = async (id: string) => {
    await supabase.from('transactions').delete().eq('id', id);
    loadTransactions();
  };

  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = income - expenses;

  const expensesByCategory = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

  const chartData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Finanças</h1>
            <p className="text-muted-foreground">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Transação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={newTransaction.type}
                    onValueChange={(v) =>
                      setNewTransaction({ ...newTransaction, type: v, category: '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={newTransaction.title}
                    onChange={(e) => setNewTransaction({ ...newTransaction, title: e.target.value })}
                    placeholder="Ex: Supermercado"
                  />
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={newTransaction.category}
                    onValueChange={(v) => setNewTransaction({ ...newTransaction, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories[newTransaction.type].map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Despesa fixa</Label>
                  <Switch
                    checked={newTransaction.is_fixed}
                    onCheckedChange={(checked) =>
                      setNewTransaction({ ...newTransaction, is_fixed: checked, is_installment: false })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Parcelado</Label>
                  <Switch
                    checked={newTransaction.is_installment}
                    onCheckedChange={(checked) =>
                      setNewTransaction({ ...newTransaction, is_installment: checked, is_fixed: false })
                    }
                  />
                </div>
                {newTransaction.is_installment && (
                  <div>
                    <Label>Número de parcelas</Label>
                    <Input
                      type="number"
                      value={newTransaction.total_installments}
                      onChange={(e) =>
                        setNewTransaction({ ...newTransaction, total_installments: e.target.value })
                      }
                      placeholder="12"
                    />
                  </div>
                )}
                <Button onClick={createTransaction} className="w-full">
                  Registrar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Receitas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-emerald-500">
                    R$ {income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    Despesas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-destructive">
                    R$ {expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Saldo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={cn('text-2xl font-bold', balance >= 0 ? 'text-emerald-500' : 'text-destructive')}>
                    R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Despesas por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Últimas Transações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {transactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhuma transação neste mês
                    </p>
                  ) : (
                    transactions.slice(0, 10).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{t.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.category}
                            {t.is_fixed && ' • Fixa'}
                            {t.is_installment && ` • ${t.current_installment}/${t.total_installments}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'font-semibold',
                              t.type === 'income' ? 'text-emerald-500' : 'text-destructive'
                            )}
                          >
                            {t.type === 'income' ? '+' : '-'} R${' '}
                            {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteTransaction(t.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
