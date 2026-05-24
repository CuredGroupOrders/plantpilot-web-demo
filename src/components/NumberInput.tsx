import { useEffect, useRef, useState } from "react";

type NumberInputProps = {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number | string;
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  ariaLabel?: string;
  /** Optional: snap displayed value to N decimals when re-syncing from prop changes. */
  precision?: number;
};

/**
 * NumberInput
 *
 * A controlled numeric input that buffers the raw string locally so users can type
 * partial / in-progress values like "1.", ".5", "0", "-", "1e", and trailing decimals
 * without React reformatting the value mid-edit.
 *
 * - Commits Number(...) to `onChange` as soon as the buffer parses cleanly.
 * - Empty buffer commits `undefined` so the parent can distinguish "not set".
 * - Syncs incoming prop changes only when the input is not focused, so prop-driven
 *   re-renders never clobber an in-progress edit.
 * - Mobile-friendly: inputMode="decimal" + numeric pattern.
 */
export default function NumberInput({
  value,
  onChange,
  step = "0.01",
  min,
  max,
  placeholder,
  disabled,
  style,
  className,
  ariaLabel,
  precision,
}: NumberInputProps) {
  const formatPropValue = (n: number | undefined): string => {
    if (n === undefined || n === null || Number.isNaN(n)) return "";
    if (typeof precision === "number" && Number.isFinite(precision)) {
      return Number(n).toFixed(precision);
    }
    return String(n);
  };

  const [buf, setBuf] = useState<string>(() => formatPropValue(value));
  const focusedRef = useRef(false);

  // Re-sync from props ONLY when the input is not currently being edited.
  useEffect(() => {
    if (focusedRef.current) return;
    const next = formatPropValue(value);
    setBuf((prev) => (prev === next ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const tryCommit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      if (value !== undefined) onChange(undefined);
      return;
    }
    // Allow in-progress strings without committing: trailing dot, lone minus, exponent in progress
    if (trimmed === "-" || trimmed === "." || trimmed === "-." || /[eE][+-]?$/.test(trimmed) || /\.$/.test(trimmed)) {
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return;
    if (n !== value) onChange(n);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    // Restrict to characters valid for numeric entry (digits, dot, leading minus, exponent)
    if (next !== "" && !/^-?\d*\.?\d*(?:[eE][+-]?\d*)?$/.test(next)) return;
    setBuf(next);
    tryCommit(next);
  };

  const handleBlur = () => {
    focusedRef.current = false;
    const trimmed = buf.trim();
    if (trimmed === "") {
      onChange(undefined);
      setBuf("");
      return;
    }
    // Final attempt to parse and snap the displayed value.
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      // revert to last committed prop value
      setBuf(formatPropValue(value));
      return;
    }
    if (n !== value) onChange(n);
    setBuf(formatPropValue(n));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.]?[0-9]*"
      value={buf}
      onChange={handleChange}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={handleBlur}
      step={step as any}
      min={min as any}
      max={max as any}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
