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
  /** Set false to reject a decimal point entirely (e.g. a "Dona"/piece quantity) — defaults to true everywhere else (money, weights, etc). */
  allowDecimals?: boolean;
}

export function NumericInput({ value, defaultValue, onChange, allowDecimals = true, onFocus, onBlur, ...props }: NumericInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() => {
    const targetValue = value !== undefined ? value : (defaultValue !== undefined ? defaultValue : "");
    return formatNumberWithSpaces(targetValue);
  });
  const [isFocused, setIsFocused] = React.useState(false);

  const targetValue = value !== undefined ? value : (defaultValue !== undefined ? defaultValue : "");
  const formatted = formatNumberWithSpaces(targetValue);
  // Never overwrite what is being typed. Half of a number is not the number:
  // reaching 0.5 goes through "0" and "0.", and both parse to 0 — so a value
  // the parent normalised (0 rendered as an empty box, say) used to be pushed
  // back into the field mid-keystroke and the decimal could never be reached.
  // While the field has focus the draft belongs to the field; on blur the
  // parent's value takes over again.
  if (!isFocused && parseFormattedNumber(formatted) !== parseFormattedNumber(displayValue)) {
    setDisplayValue(formatted);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputVal = e.target.value;

    // Replace commas with dots
    inputVal = inputVal.replace(/,/g, ".");

    // Remove characters that are not digits, spaces, or dots (or dots
    // entirely, when this quantity has to stay a whole number)
    inputVal = inputVal.replace(allowDecimals ? /[^\d\s.]/g : /[^\d\s]/g, "");
    
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
      onFocus={(e) => {
        setIsFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        // Re-sync to whatever the parent settled on — it may have clamped or
        // rounded what was typed.
        setDisplayValue(formatNumberWithSpaces(value !== undefined ? value : ""));
        onBlur?.(e);
      }}
      {...props}
    />
  )
}
