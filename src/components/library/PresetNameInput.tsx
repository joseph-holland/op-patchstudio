import React, { useState, useEffect } from 'react';
import { TextInput } from '@carbon/react';
import { isValidPresetName, getInvalidPresetNameChars } from '../../utils/audio';

interface PresetNameInputProps {
  id: string;
  labelText: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  invalidText?: string;
  className?: string;
}

export function PresetNameInput({
  id,
  labelText,
  value,
  onChange,
  placeholder = 'enter preset name',
  disabled = false,
  invalid = false,
  invalidText,
  className
}: PresetNameInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [validationError, setValidationError] = useState<string>('');

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Check for invalid characters
    if (newValue && !isValidPresetName(newValue)) {
      const invalidChars = getInvalidPresetNameChars(newValue);
      setValidationError(`invalid characters: ${invalidChars.join(', ')}`);
      return;
    }

    // Clear validation error if valid
    setValidationError('');
    
    // Only call onChange if the value is valid or empty
    if (isValidPresetName(newValue)) {
      onChange(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent invalid characters from being typed
    const invalidChars = /[^a-zA-Z0-9 #\-().]/;
    if (invalidChars.test(e.key)) {
      e.preventDefault();
    }
  };

  const isInvalid = invalid || !!validationError;
  const errorText = validationError || invalidText;

  return (
    <>
      <TextInput
        id={id}
        labelText={labelText}
        value={localValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        invalid={isInvalid}
        invalidText={errorText}
        className={className ? `${className} preset-name-input-leftalign` : 'preset-name-input-leftalign'}
      />
      <style>{`
        .preset-name-input-leftalign .cds--label {
          text-align: left !important;
          justify-content: flex-start !important;
        }
        .preset-name-input-leftalign input.cds--text-input {
          text-align: left !important;
        }
      `}</style>
    </>
  );
} 