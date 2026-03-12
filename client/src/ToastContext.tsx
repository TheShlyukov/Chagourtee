import React, { createContext, useContext, useState, ReactNode } from 'react';
import Toast from './components/Toast';

interface ToastContextType {
  showToast: (message: string, type: 'success' | 'error', duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error';
  duration?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: 'success' | 'error', duration?: number) => {
    const id = Date.now();
    setToasts((prev) => [
      ...prev,
      { id, message, type, duration }
    ]);

    // Auto-remove toast after its duration plus animation time
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, (duration || 5000) + 300); // 300ms for exit animation
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};