/**
 * Dialog Components - Modal dialogs for the application.
 */
import React, { useEffect, useRef } from 'react';
import { useClickOutside } from '../../hooks';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from '../../../shared/utils/appMeta';

// ============================================================================
// Modal Base
// ============================================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  closeOnEscape = true,
  closeOnOutsideClick = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={closeOnOutsideClick ? onClose : undefined} />
      
      {/* Modal content */}
      <div
        ref={modalRef}
        className={`relative rounded-lg shadow-2xl ${className}`}
          style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-light)' }}
      >
        {children}
      </div>
    </div>
  );
};

// ============================================================================
// Confirm Dialog
// ============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="w-[400px]">
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--theme-border-light)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-fg)' }}>{title}</h3>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        <p className="text-sm" style={{ color: 'var(--theme-fg)' }}>{message}</p>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--theme-border-light)' }}>
        <button
          onClick={onClose}
          className="btn btn-secondary text-xs"
        >
          {cancelLabel}
        </button>
        <button
          onClick={handleConfirm}
          className={`btn text-xs ${
            variant === 'danger' ? '' : 'btn-primary'
          }`}
          style={variant === 'danger' ? { background: 'var(--theme-error)', color: '#ffffff', border: 'none' } : {}}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

// ============================================================================
// Input Dialog
// ============================================================================

interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
}

export const InputDialog: React.FC<InputDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  label,
  placeholder = '',
  defaultValue = '',
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
}) => {
  const [value, setValue] = React.useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="w-[400px]">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--theme-border-light)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-fg)' }}>{title}</h3>
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          {label && <label className="block text-xs mb-2" style={{ color: 'var(--theme-fg-muted)' }}>{label}</label>}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="input w-full"
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--theme-border-light)' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary text-xs">
            {cancelLabel}
          </button>
          <button type="submit" className="btn btn-primary text-xs">
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// GoToLine Dialog
// ============================================================================

interface GoToLineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGo: (line: number) => void;
  maxLine: number;
}

export const GoToLineDialog: React.FC<GoToLineDialogProps> = ({
  isOpen,
  onClose,
  onGo,
  maxLine,
}) => {
  const [value, setValue] = React.useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const line = parseInt(value, 10);
    if (!isNaN(line) && line >= 1 && line <= maxLine) {
      onGo(line);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="w-[300px]">
      <form onSubmit={handleSubmit}>
        <div className="px-4 py-3">
          <label className="block text-xs mb-2" style={{ color: 'var(--theme-fg-muted)' }}>
            Go to Line (1 - {maxLine})
          </label>
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={maxLine}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Line number"
            className="input w-full"
          />
        </div>
        <div className="px-4 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--theme-border-light)' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary text-xs">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary text-xs">
            Go
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// About Dialog
// ============================================================================

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose, version }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="w-[400px]">
      <div className="px-6 py-6 text-center">
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--theme-fg)' }}>{APP_NAME}</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--theme-fg-muted)' }}>{APP_DESCRIPTION}</p>
        <p className="text-xs mb-4" style={{ color: 'var(--theme-fg-muted)' }}>Version {APP_VERSION}</p>
        <div className="text-xs space-y-1" style={{ color: 'var(--theme-fg-dim)' }}>
          <p>Electron: {process.versions?.electron || 'N/A'}</p>
          <p>Node.js: {process.versions?.node || 'N/A'}</p>
          <p>Chromium: {process.versions?.chrome || 'N/A'}</p>
        </div>
        <div className="mt-6">
          <button onClick={onClose} className="btn btn-primary text-xs">
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
};
