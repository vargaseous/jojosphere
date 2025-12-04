import React, { useEffect, useMemo, useState } from 'react';

const completeNumber = /^-?\d+(?:\.\d+)?$/;

const clampValue = (value: number, min?: number, max?: number) => {
  let next = value;
  if (typeof min === 'number') next = Math.max(min, next);
  if (typeof max === 'number') next = Math.min(max, next);
  return next;
};

export const formatNumber = (value: number, decimals = 4) => {
  if (!Number.isFinite(value)) return '';
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.?0+$/, '');
};

type FreeNumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChangeValue: (value: number) => void;
  min?: number;
  max?: number;
  decimals?: number;
};

export const FreeNumberInput: React.FC<FreeNumberInputProps> = ({
  value,
  onChangeValue,
  min,
  max,
  decimals = 4,
  inputMode = 'decimal',
  className,
  ...rest
}) => {
  const format = useMemo(() => (val: number) => formatNumber(val, decimals), [decimals]);
  const [text, setText] = useState(() => format(value));

  useEffect(() => {
    const formatted = format(value);
    setText((prev) => (prev === formatted ? prev : formatted));
  }, [format, value]);

  const commit = (raw: string, force = false) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      if (force) setText(format(value));
      return;
    }
    const clamped = clampValue(parsed, min, max);
    onChangeValue(clamped);
    setText(format(clamped));
  };

  const handleBlur = () => commit(text, true);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(text, true);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setText(format(value));
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setText(next);
    if (completeNumber.test(next.trim())) commit(next);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={inputMode}
      className={className ? `numeric-input ${className}` : 'numeric-input'}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};
