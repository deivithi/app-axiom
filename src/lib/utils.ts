import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  const parts = absValue.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formattedValue = `${formattedInteger},${decimalPart}`;
  
  return isNegative ? `R$ -${formattedValue}` : `R$ ${formattedValue}`;
}
