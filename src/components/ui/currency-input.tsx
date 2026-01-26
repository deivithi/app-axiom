import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number | string;
  onChange: (value: number) => void;
}

const formatCurrency = (value: number): string => {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const parts = absValue.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formattedValue = `${formattedInteger},${decimalPart}`;
  return isNegative ? `R$ -${formattedValue}` : `R$ ${formattedValue}`;
};

const parseCurrencyInput = (input: string): number => {
  // Remove tudo exceto números
  const raw = input.replace(/\D/g, "");
  if (!raw) return 0;
  // Converte centavos para reais com arredondamento garantido
  const value = parseInt(raw, 10) / 100;
  return Math.round(value * 100) / 100;
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => {
      const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
      return formatCurrency(numValue);
    });

    // Sync display when external value changes
    React.useEffect(() => {
      const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
      setDisplayValue(formatCurrency(numValue));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const numericValue = parseCurrencyInput(inputValue);
      
      setDisplayValue(formatCurrency(numericValue));
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
