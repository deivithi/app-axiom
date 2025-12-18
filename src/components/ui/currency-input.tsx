import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number | string;
  onChange: (value: number) => void;
  currency?: string;
}

const formatCurrency = (value: number, currency: string = "BRL"): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const parseCurrencyInput = (input: string): number => {
  // Remove tudo exceto números
  const raw = input.replace(/\D/g, "");
  if (!raw) return 0;
  // Converte centavos para reais
  return parseInt(raw, 10) / 100;
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, currency = "BRL", ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => {
      const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
      return formatCurrency(numValue, currency);
    });

    // Sync display when external value changes
    React.useEffect(() => {
      const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
      setDisplayValue(formatCurrency(numValue, currency));
    }, [value, currency]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const numericValue = parseCurrencyInput(inputValue);
      
      setDisplayValue(formatCurrency(numericValue, currency));
      onChange(numericValue);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Seleciona todo o texto ao focar
      e.target.select();
      props.onFocus?.(e);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        className={cn("text-right", className)}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
