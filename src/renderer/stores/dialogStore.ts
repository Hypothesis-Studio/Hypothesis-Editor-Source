/**
 * Dialog Store - Global themed dialog to replace native alert/confirm.
 */
import { create } from 'zustand';

interface DialogButton {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface DialogState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm' | 'about';
  buttons: DialogButton[];
  _resolve: ((value: number) => void) | null;
  _activeResolve: ((value: number) => void) | null;
  showDialog: (opts: { title: string; message: string; type?: 'alert' | 'confirm' | 'about'; buttons?: DialogButton[] }) => Promise<number>;
  resolveDialog: (index: number) => void;
  cancelDialog: () => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  isOpen: false,
  title: '',
  message: '',
  type: 'alert',
  buttons: [],
  _resolve: null,
  _activeResolve: null,

  showDialog: (opts) => {
    return new Promise<number>((resolve) => {
      const buttons = opts.buttons || (
        opts.type === 'confirm'
          ? [
              { label: 'Cancel', variant: 'secondary' as const },
              { label: 'OK', variant: 'danger' as const },
            ]
          : [{ label: 'OK', variant: 'primary' as const }]
      );
      set({
        isOpen: true,
        title: opts.title,
        message: opts.message,
        type: opts.type || 'alert',
        buttons,
        _resolve: resolve,
        _activeResolve: resolve,
      });
    });
  },

  resolveDialog: (index: number) => {
    const { _activeResolve } = get();
    set({ isOpen: false, _activeResolve: null });
    if (_activeResolve) _activeResolve(index);
  },

  cancelDialog: () => {
    const { _activeResolve } = get();
    set({ isOpen: false, _activeResolve: null });
    if (_activeResolve) _activeResolve(0);
  },
}));

// Convenience functions
export const showAlert = (message: string, title = 'Hypothesis') =>
  useDialogStore.getState().showDialog({ title, message, type: 'alert' }).then(() => {});

export const showConfirm = (message: string, title = 'Confirm'): Promise<boolean> =>
  useDialogStore.getState().showDialog({ title, message, type: 'confirm' }).then((i) => i === 1);

export const showAbout = (message: string) =>
  useDialogStore.getState().showDialog({ title: 'About Hypothesis', message, type: 'about' }).then(() => {});
