import { useCallback } from 'react';

interface MessageInputProps {
  sendText: string;
  setSendText: (text: string) => void;
  handleSend: (e: React.FormEvent) => void;
}

export const useMessageInputBehavior = ({ 
  sendText, 
  setSendText, 
  handleSend 
}: MessageInputProps) => {
  // Function to detect if the user is on a mobile device
  const isMobileDevice = useCallback((): boolean => {
    return 'ontouchstart' in window || 
           navigator.maxTouchPoints > 0 || 
           window.matchMedia('(pointer: coarse)').matches;
  }, []);

  // Handle key down events for the message input
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = isMobileDevice();
    
    if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey || e.altKey || isMobile)) {
      // Insert line break when Shift/Ctrl/Alt + Enter is pressed
      // Also insert line break on Enter alone in mobile browsers
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = sendText.substring(0, start) + '\n' + sendText.substring(end);
      setSendText(newValue);
      
      // Restore cursor position after newline insertion
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      }, 0);
    } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !isMobile) {
      // Submit form when only Enter is pressed without modifiers on non-mobile devices
      e.preventDefault();
      handleSend(e);
    }
  }, [sendText, setSendText, handleSend, isMobileDevice]);

  return {
    handleKeyDown,
    isMobileDevice
  };
};