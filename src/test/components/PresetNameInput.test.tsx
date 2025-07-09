import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PresetNameInput } from '../../components/library/PresetNameInput';

// Mock the audio utils
vi.mock('../../utils/audio', () => ({
  isValidPresetName: vi.fn(),
  getInvalidPresetNameChars: vi.fn()
}));

import { isValidPresetName, getInvalidPresetNameChars } from '../../utils/audio';

const mockIsValidPresetName = vi.mocked(isValidPresetName);
const mockGetInvalidPresetNameChars = vi.mocked(getInvalidPresetNameChars);

describe('PresetNameInput', () => {
  const defaultProps = {
    id: 'test-input',
    labelText: 'preset name',
    value: '',
    onChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to valid names
    mockIsValidPresetName.mockReturnValue(true);
    mockGetInvalidPresetNameChars.mockReturnValue([]);
  });

  it('should render with default props', () => {
    render(<PresetNameInput {...defaultProps} />);
    
    expect(screen.getByLabelText('preset name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('enter preset name')).toBeInTheDocument();
  });

  it('should call onChange when valid input is entered', () => {
    render(<PresetNameInput {...defaultProps} />);
    
    const input = screen.getByLabelText('preset name');
    fireEvent.change(input, { target: { value: 'Test Preset' } });
    
    expect(defaultProps.onChange).toHaveBeenCalledWith('Test Preset');
  });

  it('should show validation error for invalid characters', () => {
    mockIsValidPresetName.mockReturnValue(false);
    mockGetInvalidPresetNameChars.mockReturnValue(['@', '/']);
    
    render(<PresetNameInput {...defaultProps} />);
    
    const input = screen.getByLabelText('preset name');
    fireEvent.change(input, { target: { value: 'Test@Preset' } });
    
    expect(screen.getByText('invalid characters: @, /')).toBeInTheDocument();
  });

  it('should not call onChange when invalid characters are entered', () => {
    mockIsValidPresetName.mockReturnValue(false);
    
    render(<PresetNameInput {...defaultProps} />);
    
    const input = screen.getByLabelText('preset name');
    fireEvent.change(input, { target: { value: 'Test@Preset' } });
    
    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  it('should prevent invalid characters from being typed', () => {
    render(<PresetNameInput {...defaultProps} />);
    
    const input = screen.getByLabelText('preset name');
    
    // Try to type invalid characters
    fireEvent.keyDown(input, { key: '@' });
    fireEvent.keyDown(input, { key: '/' });
    fireEvent.keyDown(input, { key: '\\' });
    
    // These should be prevented
    expect(input).toHaveValue('');
  });

  it('should allow valid characters to be typed', () => {
    render(<PresetNameInput {...defaultProps} />);
    
    const input = screen.getByLabelText('preset name');
    
    // Type valid characters
    fireEvent.change(input, { target: { value: 'Test Preset' } });
    
    expect(input).toHaveValue('Test Preset');
    expect(defaultProps.onChange).toHaveBeenCalledWith('Test Preset');
  });

  it('should clear validation error when input becomes valid', async () => {
    // Start with invalid input
    mockIsValidPresetName.mockReturnValueOnce(false);
    mockGetInvalidPresetNameChars.mockReturnValueOnce(['@']);
    
    render(<PresetNameInput {...defaultProps} />);
    
    const input = screen.getByLabelText('preset name');
    fireEvent.change(input, { target: { value: 'Test@Preset' } });
    
    expect(screen.getByText('invalid characters: @')).toBeInTheDocument();
    
    // Change to valid input
    mockIsValidPresetName.mockReturnValue(true);
    mockGetInvalidPresetNameChars.mockReturnValue([]);
    
    fireEvent.change(input, { target: { value: 'Test Preset' } });
    
    await waitFor(() => {
      expect(screen.queryByText('invalid characters: @')).not.toBeInTheDocument();
    });
  });

  it('should handle external invalid prop', () => {
    render(
      <PresetNameInput 
        {...defaultProps} 
        invalid={true} 
        invalidText="external error"
      />
    );
    
    expect(screen.getByText('external error')).toBeInTheDocument();
  });

  it('should handle disabled state', () => {
    render(<PresetNameInput {...defaultProps} disabled={true} />);
    
    const input = screen.getByLabelText('preset name');
    expect(input).toBeDisabled();
  });

  it('should update local value when prop changes', () => {
    const { rerender } = render(<PresetNameInput {...defaultProps} value="initial" />);
    
    expect(screen.getByLabelText('preset name')).toHaveValue('initial');
    
    rerender(<PresetNameInput {...defaultProps} value="updated" />);
    
    expect(screen.getByLabelText('preset name')).toHaveValue('updated');
  });
}); 