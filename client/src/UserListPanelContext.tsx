import { createContext, useContext, useState, ReactNode } from 'react';

type UserListPanelContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const UserListPanelContext = createContext<UserListPanelContextValue | undefined>(
  undefined
);

export function UserListPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((prev) => !prev);

  return (
    <UserListPanelContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </UserListPanelContext.Provider>
  );
}

export function useUserListPanel(): UserListPanelContextValue {
  const ctx = useContext(UserListPanelContext);
  if (!ctx) {
    throw new Error('useUserListPanel must be used within a UserListPanelProvider');
  }
  return ctx;
}

