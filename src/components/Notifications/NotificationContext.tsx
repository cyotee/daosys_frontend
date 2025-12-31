'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

export interface Notification {
  id: string;
  message: string;
  severity: AlertColor;
  autoHideDuration?: number;
}

interface NotificationContextValue {
  notify: (message: string, severity?: AlertColor, autoHideDuration?: number) => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  notifyWarning: (message: string) => void;
  notifyInfo: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotification(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, severity: AlertColor = 'info', autoHideDuration: number = 6000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setNotifications((prev) => [...prev, { id, message, severity, autoHideDuration }]);
    },
    []
  );

  const notifySuccess = useCallback((message: string) => notify(message, 'success'), [notify]);
  const notifyError = useCallback((message: string) => notify(message, 'error', 10000), [notify]);
  const notifyWarning = useCallback((message: string) => notify(message, 'warning'), [notify]);
  const notifyInfo = useCallback((message: string) => notify(message, 'info'), [notify]);

  const currentNotification = notifications[0];

  return (
    <NotificationContext.Provider
      value={{ notify, notifySuccess, notifyError, notifyWarning, notifyInfo }}
    >
      {children}
      {currentNotification && (
        <Snackbar
          open={true}
          autoHideDuration={currentNotification.autoHideDuration}
          onClose={() => removeNotification(currentNotification.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => removeNotification(currentNotification.id)}
            severity={currentNotification.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {currentNotification.message}
          </Alert>
        </Snackbar>
      )}
    </NotificationContext.Provider>
  );
}
