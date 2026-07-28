import * as React from "react"
import { Input } from "./input"

export function formatNumberWithSpaces(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "") return "";
  const str = String(value).replace(/\s/g, "");
  if (isNaN(Number(str))) return str;
  const parts = str.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.join(".");
}

export function parseFormattedNumber(value: string): number | "" {
  const clean = value.replace(/\s/g, "");
  if (clean === "") return "";
  const num = Number(clean);
  return isNaN(num) ? "" : num;
}

interface NumericInputProps extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "defaultValue"> {
  value?: number | string;
  defaultValue?: number | string;
  onChange?: (val: number | "") => void;
}

export function NumericInput({ value, defaultValue, onChange, ...props }: NumericInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() => {
    const targetValue = value !== undefined ? value : (defaultValue !== undefined ? defaultValue : "");
    return formatNumberWithSpaces(targetValue);
  });

  const targetValue = value !== undefined ? value : (defaultValue !== undefined ? defaultValue : "");
  const formatted = formatNumberWithSpaces(targetValue);
  if (parseFormattedNumber(formatted) !== parseFormattedNumber(displayValue)) {
    setDisplayValue(formatted);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputVal = e.target.value;
    
    // Replace commas with dots
    inputVal = inputVal.replace(/,/g, ".");
    
    // Remove characters that are not digits, spaces, or dots
    inputVal = inputVal.replace(/[^\d\s.]/g, "");
    
    // Ensure only one dot
    const parts = inputVal.split(".");
    if (parts.length > 2) {
      inputVal = parts[0] + "." + parts.slice(1).join("");
    }

    // Format the integer part
    let formatted = "";
    if (parts[0] !== undefined) {
      const intPart = parts[0].replace(/\s/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      formatted = intPart;
      if (parts.length > 1) {
        formatted += "." + parts[1];
      }
    } else {
      formatted = inputVal;
    }

    setDisplayValue(formatted);

    const cleanNum = formatted.replace(/\s/g, "");
    const num = cleanNum === "" ? "" : Number(cleanNum);
    if (onChange) {
      onChange(num === "" || isNaN(num) ? "" : num);
    }
  };

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      {...props}
    />
  )
}
