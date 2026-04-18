import React from 'react';
import { Input } from '@/components/ui/input';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';

/**
 * NumberInput — text input that formats its value with space thousand
 * separators (e.g. `30 000 000`) while exposing a clean numeric string to
 * callers via onChange.
 *
 * Props:
 *   value:      string | number       raw numeric value (no formatting)
 *   onChange:   (rawString) => void   called with stripped numeric string
 *   allowDecimal?: boolean            allow a decimal point (default: true)
 *   ...rest:    forwarded to <Input>
 */
const NumberInput = React.forwardRef(function NumberInput(
  { value, onChange, allowDecimal = true, inputMode, ...rest },
  ref
) {
  const displayValue =
    value === '' || value === null || value === undefined
      ? ''
      : formatPriceInput(String(value));

  const handleChange = (e) => {
    let raw = parsePriceInput(e.target.value);
    if (!allowDecimal) {
      raw = raw.replace(/\./g, '');
    }
    onChange?.(raw);
  };

  return (
    <Input
      ref={ref}
      type="text"
      inputMode={inputMode || (allowDecimal ? 'decimal' : 'numeric')}
      value={displayValue}
      onChange={handleChange}
      {...rest}
    />
  );
});

export { NumberInput };
export default NumberInput;
