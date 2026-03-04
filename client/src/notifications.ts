type MessageNotificationOptions = {
  roomName: string;
  preview: string;
  isMention: boolean;
};

export async function ensureNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      // ignore
    }
  }
}

export async function showMessageNotification({
  roomName,
  preview,
  isMention,
}: MessageNotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const title = isMention
      ? `Новое упоминание в #${roomName}`
      : `Новое сообщение в #${roomName}`;
    const body = preview || 'Новое сообщение';
    const notification = new Notification(title, { body });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // ignore errors from Notification API
  }
}

