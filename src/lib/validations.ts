import { z } from 'zod';

// ==================== AUTH SCHEMAS ====================

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email é obrigatório')
  .email('Email inválido')
  .max(255, 'Email deve ter no máximo 255 caracteres');

export const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .max(128, 'Senha deve ter no máximo 128 caracteres')
  .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial (!@#$%^&*)');

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Nome deve ter no mínimo 2 caracteres')
  .max(100, 'Nome deve ter no máximo 100 caracteres')
  .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras');

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória'),
});

// ==================== TRANSACTION SCHEMAS ====================

// Category lists for validation
export const EXPENSE_CATEGORIES = ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Lazer", "Compras", "Assinaturas", "Outros"];
export const INCOME_CATEGORIES = ["Salário", "Freelance", "Investimentos", "Vendas", "Outros"];

// Date range constants
const MAX_FUTURE_DAYS = 365; // 1 year in the future
const MAX_PAST_YEARS = 5;    // 5 years in the past

export const transactionTitleSchema = z
  .string()
  .trim()
  .min(1, 'Título é obrigatório')
  .max(100, 'Título deve ter no máximo 100 caracteres');

export const transactionAmountSchema = z
  .number()
  .positive('Valor deve ser maior que zero')
  .max(999999999, 'Valor máximo: R$ 999.999.999');

export const transactionTypeSchema = z.enum(['income', 'expense'], {
  errorMap: () => ({ message: 'Tipo deve ser "income" ou "expense"' }),
});

export const transactionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
  .refine((date) => {
    const d = new Date(date + 'T12:00:00');
    const now = new Date();
    const maxFuture = new Date();
    maxFuture.setDate(maxFuture.getDate() + MAX_FUTURE_DAYS);
    const minPast = new Date();
    minPast.setFullYear(minPast.getFullYear() - MAX_PAST_YEARS);
    return d <= maxFuture && d >= minPast;
  }, 'Data deve estar entre 5 anos no passado e 1 ano no futuro');

export const transactionCategorySchema = z
  .string()
  .trim()
  .min(1, 'Categoria é obrigatória')
  .max(50, 'Categoria deve ter no máximo 50 caracteres');

// Helper to validate category based on transaction type
export const validateTransactionCategory = (category: string, type: 'income' | 'expense'): boolean => {
  const allowedCategories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  return allowedCategories.includes(category);
};

export const transactionSchema = z.object({
  title: transactionTitleSchema,
  amount: transactionAmountSchema,
  type: transactionTypeSchema,
  category: transactionCategorySchema,
  is_fixed: z.boolean().default(false),
  is_installment: z.boolean().default(false),
  total_installments: z.number().int().min(2).max(72).optional().nullable(),
  payment_method: z.string().max(50).optional(),
  account_id: z.string().uuid().optional().nullable(),
  transaction_date: transactionDateSchema,
}).refine((data) => {
  return validateTransactionCategory(data.category, data.type);
}, {
  message: 'Categoria inválida para o tipo de transação',
  path: ['category'],
});

// ==================== ACCOUNT SCHEMAS ====================

export const accountNameSchema = z
  .string()
  .trim()
  .min(1, 'Nome é obrigatório')
  .max(50, 'Nome deve ter no máximo 50 caracteres');

export const accountBalanceSchema = z
  .number()
  .min(-999999999, 'Valor mínimo: R$ -999.999.999')
  .max(999999999, 'Valor máximo: R$ 999.999.999');

export const accountSchema = z.object({
  name: accountNameSchema,
  balance: accountBalanceSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida'),
  icon: z.string().max(4),
});

// ==================== HABIT SCHEMAS ====================

export const habitTitleSchema = z
  .string()
  .trim()
  .min(1, 'Título é obrigatório')
  .max(100, 'Título deve ter no máximo 100 caracteres');

export const habitFrequencySchema = z.enum(['daily', 'weekly'], {
  errorMap: () => ({ message: 'Frequência deve ser "daily" ou "weekly"' }),
});

export const habitSchema = z.object({
  title: habitTitleSchema,
  description: z.string().max(500, 'Descrição deve ter no máximo 500 caracteres').optional(),
  frequency: habitFrequencySchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida'),
});

// ==================== HELPER FUNCTIONS ====================

export const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  if (score <= 2) return { score, label: 'Fraca', color: 'destructive' };
  if (score <= 4) return { score, label: 'Média', color: 'warning' };
  return { score, label: 'Forte', color: 'success' };
};

export const formatValidationErrors = (errors: z.ZodError): string[] => {
  return errors.errors.map(err => err.message);
};
