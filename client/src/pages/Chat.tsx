import { useState, useEffect, useRef, useCallback} from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Room, Message, User } from '../api';
import { rooms as roomsApi, messages as messagesApi, auth as authApi, users } from '../api';
import { 
  getWebSocket, 
  addMessageHandler, 
  removeMessageHandler,
  initializeWebSocket,
  addOpenHandler,
  removeOpenHandler
} from '../websocket'; // Import WebSocket manager
import { logger } from '../utils/logger'; // Import our logger
// Import the custom hook
import { useMessageInputBehavior } from '../hooks/useMessageInputBehavior';
import MarkdownMessage from '../components/MarkdownMessage'; // Import MarkdownMessage component
import Marquee from '../components/Marquee'; // Import Marquee component

type TypingUser = {
  userId: number;
  login: string;
};

// Add a helper function to get user role by user ID
const getUserRoleById = (userId: number, allUsers: User[]) => {
  const user = allUsers.find(u => u.id === userId);
  return user?.role;
};

function formatTypingUsers(users: TypingUser[]): string | null {
  if (!users.length) return null;

  const names = users.map((u) => u.login);

  if (names.length === 1) {
    return names[0]!;
  }

  if (names.length === 2) {
    return `${names[0]} и ${names[1]}`;
  }

  if (names.length === 3) {
    return `${names[0]}, ${names[1]} и ${names[2]}`;
  }

  // 4 и более: показываем первых трёх и "и др."
  return `${names[0]}, ${names[1]}, ${names[2]} и др.`;
}

export default function Chat() {
  const { roomId: routeRoomId } = useParams();
  const roomId = routeRoomId ? Number(routeRoomId) : null;
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendText, setSendText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    message: Message | null;
  }>({ visible: false, x: 0, y: 0, message: null });
  const [selectedMessages, setSelectedMessages] = useState<number[]>([]);
  const [editingMessage, setEditingMessage] = useState<{id: number, body: string, originalBody: string} | null>(null);
  const typingIndicatorRef = useRef<HTMLDivElement>(null);
  const typingTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null); // Для обработки долгого нажатия
  const doubleClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // Таймер для отслеживания двойного клика
  const editMessageTextareaRef = useRef<HTMLTextAreaElement>(null); // Ref for the editing message textarea
  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref for scroll-to-bottom button
  const [showScrollButton, setShowScrollButton] = useState(false); // State to control visibility of scroll button
  const [allUsers, setAllUsers] = useState<User[]>([]); // Keep track of all users to get their roles
  
  // Track whether user wants to stay at bottom
  const shouldAutoScrollRef = useRef(true);
  
  // Store scroll position to preserve it between room switches
  const scrollPositions = useRef<Record<number, number>>({}); // Store scroll position per room

  // Load all users to get their roles
  useEffect(() => {
    const loadAllUsers = async () => {
      try {
        const response = await users.list();
        setAllUsers(response.users);
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    };
    
    loadAllUsers();
  }, []);


  // Handle clicks outside the context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0, message: null });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load current user info
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await authApi.me();
        setUser(userData);
      } catch (error) {
        console.error('Failed to load user info:', error);
      }
    };
    loadUser();
  }, []);

  const loadRooms = useCallback(async () => {
    const { rooms } = await roomsApi.list();
    setRoomList(rooms);
  }, []);

  // Function to update scroll button visibility based on scroll position
  const updateScrollButtonVisibility = useCallback(() => {
    const messagesContainer = document.querySelector('.chat-messages-wrap');
    if (messagesContainer) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer as HTMLElement;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      
      // Update auto-scroll ref to determine if we should auto-scroll
      shouldAutoScrollRef.current = distanceToBottom < 100; // Consider "near bottom" if within 100px
      
      // Show button only when:
      // 1. Distance to bottom is greater than 100px (user scrolled up significantly)
      // 2. Container is actually scrollable (content is taller than container)
      setShowScrollButton(distanceToBottom > 100 && scrollHeight > clientHeight);
    } else {
      // If there's no messages container (e.g. no room selected), hide the button
      setShowScrollButton(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const { messages: list } = await messagesApi.list(id);
      setMessages(list);
    } finally {
      setLoading(false);
      
      // Update scroll button visibility after messages are loaded and rendered
      setTimeout(updateScrollButtonVisibility, 0);
      
      // After loading messages, check if we should preserve scroll position or scroll to bottom
      setTimeout(() => {
        const messagesContainer = document.querySelector('.chat-messages-wrap');
        if (messagesContainer && roomId && scrollPositions.current[roomId] !== undefined) {
          // Restore the saved scroll position for this room
          messagesContainer.scrollTop = scrollPositions.current[roomId];
        }
      }, 0);
    }
  }, [updateScrollButtonVisibility, roomId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (roomId) {
      loadMessages(roomId);
    }
    else {
      setMessages([]);
      // When no room is selected, ensure scroll button is hidden and update visibility
      setTimeout(() => {
        setShowScrollButton(false);
        updateScrollButtonVisibility();
      }, 0);
    }
  }, [roomId, loadMessages, updateScrollButtonVisibility]);

  // Effect to restore scroll position after messages are rendered
  useEffect(() => {
    if (roomId && !loading && messages.length > 0) {
      // Wait a tick for the DOM to update
      setTimeout(() => {
        const messagesContainer = document.querySelector('.chat-messages-wrap');
        if (messagesContainer && roomId && scrollPositions.current[roomId] !== undefined) {
          // Restore the saved scroll position for this room
          messagesContainer.scrollTop = scrollPositions.current[roomId];
          
          // Update the scroll button visibility based on the restored position
          const { scrollTop, scrollHeight, clientHeight } = messagesContainer as HTMLElement;
          const distanceToBottom = scrollHeight - scrollTop - clientHeight;
          
          shouldAutoScrollRef.current = distanceToBottom < 100;
          setShowScrollButton(distanceToBottom > 100 && scrollHeight > clientHeight);
        } else if (messagesContainer) {
          // If no saved position, ensure we're at the bottom
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          shouldAutoScrollRef.current = true;
          setShowScrollButton(false);
        }
      }, 0);
    }
  }, [roomId, loading, messages]);

  // Handle WebSocket messages related to chat
  useEffect(() => {
    if (!roomId) return;

    logger.debug(`Chat component mounted for room ${roomId}`);

    const handleMessage = (data: any) => {
      logger.debug('Received WebSocket message:', data);
      
      switch(data.type) {
        case 'message':
          if (data.message?.room_id === roomId) {
            logger.debug('Processing new message:', data.message);
            setMessages(prev => {
              // Check if message already exists
              if (prev.some(m => m.id === data.message.id)) {
                logger.debug('Message already exists, skipping');
                return prev;
              }
              logger.debug('Adding new message to state');
              // Add the new message
              return [...prev, data.message];
            });
          }
          break;
          
        case 'message_updated':
          // Update the message in the list if it exists
          logger.debug('Processing message update:', data.message);
          // Only update if this is not from the current user (to avoid duplicate updates)
          setMessages(prev => 
            prev.map(msg => 
              msg.id === data.message.id ? data.message : msg
            )
          );
          break;
          
        case 'message_deleted':
          // Remove the message from the list
          logger.debug('Processing message deletion:', data.messageId);
          setMessages(prev => 
            prev.filter(msg => msg.id !== data.messageId)
          );
          
          // After deleting a message, update the scroll button visibility
          setTimeout(updateScrollButtonVisibility, 0);
          break;
          
        case 'messages_deleted':
          // Remove multiple messages from the list
          if (Array.isArray(data.messageIds)) {
            logger.debug('Processing multiple message deletion:', data.messageIds);
            setMessages(prev => 
              prev.filter(msg => !data.messageIds.includes(msg.id))
            );
            
            // After deleting messages, update the scroll button visibility
            setTimeout(updateScrollButtonVisibility, 0);
          }
          break;
          
        case 'typing':
          // Сообщение о наборе приходит уже только в нужную комнату,
          // поэтому roomId в payload не обязателен
          if (data.userId != null && user && data.userId !== user.id) { // Исключаем себя из отображения
            const userId = Number(data.userId);
            const login = data.login || String(data.userId);

            setTypingUsers((prev) => {
              const exists = prev.some((u) => u.userId === userId);
              if (exists) {
                return prev.map((u) =>
                  u.userId === userId ? { ...u, login } : u
                );
              }
              return [...prev, { userId, login }];
            });

            const timeouts = typingTimeoutsRef.current;
            const existingTimeout = timeouts.get(userId);
            if (existingTimeout) clearTimeout(existingTimeout);

            const timeoutId = setTimeout(() => {
              setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
              timeouts.delete(userId);
            }, 3000);

            timeouts.set(userId, timeoutId);
          }
          break;
          
        case 'room_deleted':
          // Handle room deletion notification
          if (data.roomId === roomId) {
            // Navigate away from the deleted room
            window.location.hash = '#/chat';
            window.location.reload(); // Force refresh to update UI
          }
          break;
          
        case 'pong': // Response to heartbeat ping - handled internally
          // Connection is alive, do nothing
          break;
          
        default:
          // Handle any other message types
          break;
      }
    };

    // Add message handler when component mounts
    addMessageHandler(handleMessage);

    // Ensure WebSocket is initialized
    initializeWebSocket();

    // Function to join room with retry logic
    const joinRoomWithRetry = (attempts = 0) => {
      const ws = getWebSocket();
      logger.debug(`Attempting to join room ${roomId}. WebSocket readyState: ${ws?.readyState}, connecting: ${ws?.readyState === WebSocket.CONNECTING}`);
      
      if (!ws) {
        logger.debug('WebSocket not available, attempting to initialize');
        // Initialize WebSocket if not available
        initializeWebSocket();
        // Retry after a short delay
        setTimeout(() => joinRoomWithRetry(attempts + 1), 100);
        return;
      }

      if (ws.readyState === WebSocket.OPEN && roomId) {
        ws.send(JSON.stringify({ type: 'join', roomId }));
        logger.debug(`Sent join message for room ${roomId}`);
      } else if (ws.readyState === WebSocket.CONNECTING) {
        // Wait for connection to open before joining
        const onOpenHandler = () => {
          logger.debug(`WebSocket opened, joining room ${roomId}`);
          if (roomId) {
            ws.send(JSON.stringify({ type: 'join', roomId }));
            logger.debug(`Sent join message for room ${roomId}`);
          }
          // Clean up this temporary handler
          ws.removeEventListener('open', onOpenHandler);
        };
        ws.addEventListener('open', onOpenHandler);
      } else {
        // If WebSocket is closed or closing, try to reinitialize
        if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          logger.debug('WebSocket is closed, reinitializing...');
          initializeWebSocket();
        }
        
        // Retry after a delay if we haven't exceeded max attempts
        if (attempts < 5) {
          setTimeout(() => joinRoomWithRetry(attempts + 1), 500);
        } else {
          logger.debug('Max attempts reached trying to join room');
        }
      }
    };

    // Try to join room immediately
    joinRoomWithRetry();

    // Global open handler to (re)join room on every WebSocket (re)connection
    const handleOpen = () => {
      logger.debug('Global WebSocket open handler triggered in Chat');
      if (!roomId) return;
      const ws = getWebSocket();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'join', roomId }));
        logger.debug(`Sent join message for room ${roomId} from global open handler`);
      }
    };
    addOpenHandler(handleOpen);

    // Cleanup function
    return () => {
      logger.debug(`Chat component unmounting for room ${roomId}`);
      // Remove message handler when component unmounts
      removeMessageHandler(handleMessage);
      // Remove open handler
      removeOpenHandler(handleOpen);
      // Clear typing timeouts
      const timeouts = typingTimeoutsRef.current;
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, [roomId, user]); // Re-run when room or user changes so "typing" handler sees fresh user


  function handleTyping() {
    const ws = getWebSocket();
    if (ws?.readyState === WebSocket.OPEN && roomId) {
      // Проверяем, что пользователь действительно присоединен к комнате
      // Если нет, пробуем присоединиться снова
      if (!(ws as any).currentRoomId || (ws as any).currentRoomId !== roomId) {
        ws.send(JSON.stringify({ type: 'join', roomId }));
        // Update the currentRoomId on the WebSocket instance
        (ws as any).currentRoomId = roomId;
      }
      ws.send(JSON.stringify({ type: 'typing', roomId }));
    }
  }

  // Handle scroll events to show/hide scroll-to-bottom button
  useEffect(() => {
    const messagesContainer = document.querySelector('.chat-messages-wrap');
    
    if (!messagesContainer) {
      // If no container exists (no room selected), hide the button
      setShowScrollButton(false);
      return;
    }

    const handleScroll = () => {
      // Check if user is near the bottom of the chat
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer as HTMLElement;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      
      // Update auto-scroll ref to determine if we should auto-scroll
      shouldAutoScrollRef.current = distanceToBottom < 100; // Consider "near bottom" if within 100px
      
      // Show button only when:
      // 1. Distance to bottom is greater than 100px (user scrolled up significantly)
      // 2. Container is actually scrollable (content is taller than container)
      setShowScrollButton(distanceToBottom > 100 && scrollHeight > clientHeight);
      
      // Store the current scroll position for the room
      if (roomId) {
        scrollPositions.current[roomId] = scrollTop;
      }
    };

    messagesContainer.addEventListener('scroll', handleScroll);
    
    // Restore scroll position if we have one for this room
    // Delay slightly to ensure DOM has rendered
    setTimeout(() => {
      if (roomId && scrollPositions.current[roomId] !== undefined) {
        messagesContainer.scrollTop = scrollPositions.current[roomId];
        
        // Update the auto scroll ref and button visibility based on restored position
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer as HTMLElement;
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;
        shouldAutoScrollRef.current = distanceToBottom < 100;
        setShowScrollButton(distanceToBottom > 100 && scrollHeight > clientHeight);
      } else {
        // If no saved position, ensure we're at the bottom and update accordingly
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer as HTMLElement;
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;
        shouldAutoScrollRef.current = distanceToBottom < 100;
        setShowScrollButton(distanceToBottom > 100 && scrollHeight > clientHeight);
      }
    }, 0);
    
    return () => {
      messagesContainer.removeEventListener('scroll', handleScroll);
    };
  }, [roomId]); // Add roomId as a dependency so the effect re-runs when room changes

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Reset auto-scroll behavior when user manually scrolls to bottom
    shouldAutoScrollRef.current = true;
    setShowScrollButton(false);
  };

  // Scroll to bottom when messages change, only if user was already at the bottom and there's a room selected
  useEffect(() => {
    // Only scroll to bottom if we're supposed to auto-scroll AND it's an addition of new messages
    // Skip scrolling if we just loaded/reloaded the message list (indicated by loading state)
    if (roomId && shouldAutoScrollRef.current && !loading) {
      // Check if the last message is new (not just loaded)
      const messagesContainer = document.querySelector('.chat-messages-wrap');
      if (messagesContainer) {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer as HTMLElement;
        const isAlreadyNearBottom = (scrollHeight - scrollTop - clientHeight) < 100;
        
        // Only scroll to bottom if we were already near bottom before the messages changed
        if (isAlreadyNearBottom) {
          scrollToBottom();
        }
      }
    }
  }, [messages, roomId, loading]);

  // Scroll to typing indicator when someone is typing, but only if user was at the bottom
  useEffect(() => {
    if (typingUsers.length > 0 && typingIndicatorRef.current && shouldAutoScrollRef.current) {
      typingIndicatorRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [typingUsers]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId || !sendText.trim()) return;
    const text = sendText.trim();
    setSendText('');
    try {
      const newMessage = await messagesApi.send(roomId, text);
      // Optimistically add the new message so the author sees it immediately
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
    } catch (err) {
      setSendText(text);
      alert(err instanceof Error ? err.message : 'Не удалось отправить');
    }
  }

  // Using the custom hook for message input behavior
  const { handleKeyDown } = useMessageInputBehavior({
    sendText,
    setSendText,
    handleSend
  });

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      // Store the current style to restore later
      const currentStyle = {
        height: textareaRef.current.style.height,
        overflowY: textareaRef.current.style.overflowY,
        borderBottom: textareaRef.current.style.borderBottom
      };
      
      try {
        // Temporarily make the textarea invisible but measurable
        textareaRef.current.style.borderBottom = 'none';
        textareaRef.current.style.height = 'auto';
        
        // Calculate the height based on content, but limit to 10 lines
        const lineHeight = 24; // Approximate line height in pixels
        const maxHeight = lineHeight * 10; // 10 lines max
        
        // Calculate scroll height and apply the limit
        const scrollHeight = Math.min(textareaRef.current.scrollHeight, maxHeight);
        
        // Apply the calculated height
        textareaRef.current.style.height = `${scrollHeight}px`;
        
        // Show scrollbar when content exceeds max height
        textareaRef.current.style.overflowY = scrollHeight >= maxHeight ? 'auto' : 'hidden';
        
        // Restore the border after resizing
        textareaRef.current.style.borderBottom = '';
      } catch (error) {
        // If there's an error, restore the original styles
        textareaRef.current.style.height = currentStyle.height;
        textareaRef.current.style.overflowY = currentStyle.overflowY;
        textareaRef.current.style.borderBottom = currentStyle.borderBottom;
      }
    }
  }, []);

  // Effect to adjust textarea height when sendText changes
  useEffect(() => {
    // Use a timeout to ensure the DOM has updated
    const timeoutId = setTimeout(adjustTextareaHeight, 0);
    return () => clearTimeout(timeoutId);
  }, [sendText, adjustTextareaHeight]);

  // Check if user can edit a message (only own messages)
  const canEditMessage = (message: Message) => {
    if (!user) return false;
    return message.user_id === user.id;
  };

  // Check if user can delete a message (own + owner/moderator)
  const canDeleteMessage = (message: Message) => {
    if (!user) return false;
    // Owner or moderator can delete any message
    if (user.role === 'owner' || user.role === 'moderator') return true;
    // Author can delete their own message
    return message.user_id === user.id;
  };

  // Toggle message selection - now respecting user permissions
  const toggleMessageSelection = (id: number) => {
    // Find the message by ID to check permissions
    const message = messages.find(msg => msg.id === id);
    
    // Allow selection only if user can delete the message
    if (message && canDeleteMessage(message)) {
      setSelectedMessages(prev => {
        if (prev.includes(id)) {
          return prev.filter(msgId => msgId !== id);
        } else {
          return [...prev, id];
        }
      });
    }
  };

  // Clear all selections
  const clearSelections = () => {
    setSelectedMessages([]);
  };

  // Determine if we're currently in selection mode
  const isSelecting = selectedMessages.length > 0;

  // Show context menu on right-click or long press
  const showContextMenu = (x: number, y: number, message: Message) => {
    if (isSelecting) return; // Don't show context menu during selection
    
    // Calculate position to prevent menu from going off-screen
    let adjustedX = x;
    let adjustedY = y;
    
    // We'll use the max dimensions defined in CSS
    const maxWidth = 300; // max-width from CSS
    const maxHeight = 300; // max-height from CSS
    
    // Adjust X coordinate to stay within screen bounds
    if (adjustedX + maxWidth > window.innerWidth) {
      adjustedX = window.innerWidth - maxWidth - 5; // 5px padding from edge
    }
    
    // Adjust Y coordinate to stay within screen bounds
    if (adjustedY + maxHeight > window.innerHeight) {
      adjustedY = window.innerHeight - maxHeight - 5; // 5px padding from edge
    }
    
    // Ensure the menu doesn't go off the left/top edges
    adjustedX = Math.max(adjustedX, 5);
    adjustedY = Math.max(adjustedY, 5);
    
    setContextMenu({
      visible: true,
      x: adjustedX,
      y: adjustedY,
      message
    });
  };

  // Handle long press for mobile devices
  const handleTouchStart = (e: React.TouchEvent, message: Message) => {
    // Clear any existing timeout
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
    }
    
    // Set a new timeout for long press (500ms is standard)
    longPressTimeout.current = setTimeout(() => {
      const touch = e.touches[0];
      if (touch) {
        // Get the coordinates relative to the viewport
        showContextMenu(touch.clientX, touch.clientY, message);
      }
    }, 500);
  };

  // Handle double click for desktop and mobile
  const handleDoubleClick = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, message);
  };

  // Handle single click with debounce for double click detection
  const handleSingleClick = (message: Message) => {
    // If we're in selection mode, just toggle the message selection
    if (isSelecting) {
      toggleMessageSelection(message.id);
      return;
    }

    // If there's already a timer (meaning this is the second click), clear it
    if (doubleClickTimer.current) {
      clearTimeout(doubleClickTimer.current);
      doubleClickTimer.current = null;
      return;
    }

    // Otherwise, set a timer to handle the single click
    doubleClickTimer.current = setTimeout(() => {
      // For single click outside of selection mode, we don't do anything
      // (previously this would toggle selection, but now we have double click for context menu)
      doubleClickTimer.current = null;
    }, 300); // 300ms is the typical double click delay
  };

  // Clear timeout when touch ends
  const handleTouchEnd = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  };

  // Hide context menu
  const hideContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, message: null });
  };

  // Select all messages that the user has permission to delete
  const selectAllMessages = () => {
    // Filter messages to only include those the user can edit/delete
    const selectableMessageIds = messages
      .filter(message => canDeleteMessage(message))
      .map(m => m.id);
    
    // Select all selectable message IDs that aren't already selected
    const unselectedIds = selectableMessageIds.filter(id => !selectedMessages.includes(id));
    
    setSelectedMessages(prev => [...prev, ...unselectedIds]);
  };

  // Delete selected messages - now delete one by one instead of batch
  const deleteSelectedMessages = async () => {
    if (selectedMessages.length === 0) return;
    
    if (confirm(`Вы уверены, что хотите удалить ${selectedMessages.length} сообщений?`)) {
      try {
        // Delete messages one by one - all selected messages should already be ones the user has permission to delete
        const deletePromises = selectedMessages.map(msgId =>
          messagesApi.delete(msgId, roomId!)
        );
        
        await Promise.all(deletePromises);
        // Optimistically remove deleted messages locally
        setMessages((prev) => prev.filter((msg) => !selectedMessages.includes(msg.id)));
        clearSelections(); // Clear selections after successful deletion
        
        // After deleting messages, update the scroll button visibility
        setTimeout(updateScrollButtonVisibility, 0);
      } catch (error) {
        console.error('Error deleting messages:', error);
        alert('Ошибка при удалении сообщений');
      }
    }
  };

  // Create a function that only clears selected messages but doesn't exit selection mode
  const clearSelectedMessagesOnly = () => {
    // Since we now only select messages the user has permission to interact with,
    // we can simply clear all selections
    setSelectedMessages([]);
  };

  // Handle editing message
  const startEditingMessage = (message: Message | null) => {
    if (!message) return;
    setEditingMessage({ id: message.id, body: message.body, originalBody: message.body });
    setContextMenu({ visible: false, x: 0, y: 0, message: null });
    
    // Adjust the height of the editing textarea after setting the value
    setTimeout(() => {
      if (editMessageTextareaRef.current) {
        editMessageTextareaRef.current.style.height = 'auto';
        
        const lineHeight = 24;
        const maxHeight = lineHeight * 10; // 10 lines max like the main input
        
        const scrollHeight = Math.min(editMessageTextareaRef.current.scrollHeight, maxHeight);
        editMessageTextareaRef.current.style.height = `${scrollHeight}px`;
        
        editMessageTextareaRef.current.style.overflowY = editMessageTextareaRef.current.scrollHeight > maxHeight ? 'auto' : 'hidden';
      }
    }, 0);
  };

  // Save edited message
  const saveEditedMessage = async () => {
    if (!editingMessage || !editingMessage.body.trim() || !roomId) return;
    
    // Проверяем, изменилось ли сообщение по сравнению с исходным
    if (editingMessage.body.trim() === editingMessage.originalBody.trim()) {
      // Если сообщение не изменилось, просто отменяем редактирование
      setEditingMessage(null);
      return;
    }
    
    try {
      const updated = await messagesApi.edit(editingMessage.id, roomId, editingMessage.body);
      // Optimistically update the message locally
      setMessages((prev) =>
        prev.map((msg) => (msg.id === updated.id ? updated : msg))
      );
      setEditingMessage(null);
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Ошибка при редактировании сообщения');
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingMessage(null);
    
    // Return focus to the main input field
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Update the height of the editing textarea when the editing message changes
  useEffect(() => {
    if (editingMessage && editMessageTextareaRef.current) {
      // Trigger height adjustment after setting the value
      setTimeout(() => {
        if (editMessageTextareaRef.current) {
          editMessageTextareaRef.current.style.height = 'auto';
          
          const lineHeight = 24;
          const maxHeight = lineHeight * 10; // 10 lines max like the main input
          
          const scrollHeight = Math.min(editMessageTextareaRef.current.scrollHeight, maxHeight);
          editMessageTextareaRef.current.style.height = `${scrollHeight}px`;
          
          editMessageTextareaRef.current.style.overflowY = editMessageTextareaRef.current.scrollHeight > maxHeight ? 'auto' : 'hidden';
        }
      }, 0);
    }
  }, [editingMessage]);

  // Handle deleting a single message
  const deleteSingleMessage = async (messageId: number) => {
    if (confirm('Вы уверены, что хотите удалить это сообщение?')) {
      try {
        await messagesApi.delete(messageId, roomId!);
        // Optimistically remove the message locally
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        setContextMenu({ visible: false, x: 0, y: 0, message: null });
        
        // After deleting a message, update the scroll button visibility
        setTimeout(updateScrollButtonVisibility, 0);
      } catch (error) {
        console.error('Error deleting message:', error);
        alert('Ошибка при удалении сообщения');
      }
    }
  };

  // Clear selections when room changes
  useEffect(() => {
    clearSelections();
  }, [roomId]);

  if (roomList.length === 0 && !loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>
        Нет комнат. Создайте комнату в разделе «Админка».
      </div>
    );
  }

  return (
    <div className={`chat-page${roomId ? ' has-room' : ''}`}>
      <div className="chat-rooms">
        <div className="chat-rooms-list">
          {roomList.map((r) => (
            <Link
              key={r.id}
              to={`/chat/${r.id}`}
              className={`chat-room-link${roomId === r.id ? ' active' : ''}`}
              onClick={() => {
                // Reload rooms when changing rooms to ensure latest state
                loadRooms();
              }}
            >
              {r.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="chat-main">
        <div className="chat-main-content">
          {roomId ? (
            <>
              <div className="chat-header-desktop">
                {roomList.find((r) => r.id === roomId)?.name ?? 'Чат'}
              </div>
              <div className="chat-messages-wrap">
                {loading ? (
                  <div style={{ color: 'var(--text-muted)' }}>Загрузка…</div>
                ) : (
                  messages.map((m, idx) => {
                    // Check if the current message is from the same user as the previous one
                    // and sent within a minute (60,000 ms)
                    const prevMessage = messages[idx - 1];
                    const shouldHideAuthor = idx > 0 && 
                      prevMessage && 
                      prevMessage.user_id === m.user_id &&
                      prevMessage.created_at && 
                      m.created_at &&
                      (new Date(m.created_at).getTime() - new Date(prevMessage.created_at).getTime()) < 60000;
                    
                    const isSelected = selectedMessages.includes(m.id);
                    const isEditable = editingMessage && editingMessage.id === m.id;
                    
                    return (
                      <div
                        key={m.id} 
                        className={`chat-message ${shouldHideAuthor ? 'grouped-message' : 'has-author'} ${isSelected ? 'selected' : ''} ${(canEditMessage(m) || canDeleteMessage(m)) ? 'editable' : ''}`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          showContextMenu(e.clientX, e.clientY, m);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSingleClick(m);
                        }}
                        onDoubleClick={(e) => handleDoubleClick(e, m)}
                        // Добавляем touch-события для поддержки долгого нажатия на мобильных устройствах
                        onTouchStart={(e) => handleTouchStart(e, m)}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={handleTouchEnd}
                        onMouseDown={handleTouchEnd} // Также очищаем таймер при клике мышью
                      >
                        {isEditable ? (
                          <div className="edit-message-form">
                            <textarea
                              ref={editMessageTextareaRef}
                              value={editingMessage.body}
                              onChange={(e) => {
                                setEditingMessage({...editingMessage, body: e.target.value});
                                
                                // Adjust height of the editing textarea
                                if (editMessageTextareaRef.current) {
                                  editMessageTextareaRef.current.style.height = 'auto';
                                  
                                  const lineHeight = 24;
                                  const maxHeight = lineHeight * 10; // 10 lines max like the main input
                                  
                                  const scrollHeight = Math.min(editMessageTextareaRef.current.scrollHeight, maxHeight);
                                  editMessageTextareaRef.current.style.height = `${scrollHeight}px`;
                                  
                                  editMessageTextareaRef.current.style.overflowY = editMessageTextareaRef.current.scrollHeight > maxHeight ? 'auto' : 'hidden';
                                }
                              }}
                              onInput={() => {
                                // Adjust height when content changes
                                if (editMessageTextareaRef.current) {
                                  editMessageTextareaRef.current.style.height = 'auto';
                                  
                                  const lineHeight = 24;
                                  const maxHeight = lineHeight * 10; // 10 lines max like the main input
                                  
                                  const scrollHeight = Math.min(editMessageTextareaRef.current.scrollHeight, maxHeight);
                                  editMessageTextareaRef.current.style.height = `${scrollHeight}px`;
                                  
                                  editMessageTextareaRef.current.style.overflowY = editMessageTextareaRef.current.scrollHeight > maxHeight ? 'auto' : 'hidden';
                                }
                              }}
                              onPaste={() => {
                                // Adjust height after paste event
                                setTimeout(() => {
                                  if (editMessageTextareaRef.current) {
                                    editMessageTextareaRef.current.style.height = 'auto';
                                    
                                    const lineHeight = 24;
                                    const maxHeight = lineHeight * 10; // 10 lines max like the main input
                                    
                                    const scrollHeight = Math.min(editMessageTextareaRef.current.scrollHeight, maxHeight);
                                    editMessageTextareaRef.current.style.height = `${scrollHeight}px`;
                                    
                                    editMessageTextareaRef.current.style.overflowY = editMessageTextareaRef.current.scrollHeight > maxHeight ? 'auto' : 'hidden';
                                  }
                                }, 10);
                              }}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  saveEditedMessage();
                                } else if (e.key === 'Escape') {
                                  cancelEditing();
                                }
                              }}
                              style={{
                                minHeight: '54px',
                                maxHeight: '240px', // 10 lines * 24px per line
                                resize: 'none',
                                overflowY: 'hidden'
                              }}
                            />
                            <div className="edit-message-actions">
                              <button onClick={saveEditedMessage}>✓ Сохранить</button>
                              <button onClick={cancelEditing}>✗ Отмена</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {!shouldHideAuthor && (
                              <div className="chat-message-header">
                                <Marquee className="chat-message-author" animationDuration={8}>{m.login}</Marquee>
                                <span className="chat-message-time">
                                  {new Date(m.created_at).toLocaleString()}
                                  {m.updated_at && m.updated_at !== m.created_at && (
                                    <span title="Редактировалось"> ✎</span>
                                  )}
                                  {/* Display role label if user is moderator or owner and it's not the current user */}
                                  {user && allUsers.length > 0 && (() => {
                                    const userRole = getUserRoleById(m.user_id, allUsers);
                                    const isCurrentUser = user.id === m.user_id;
                                    
                                    if ((userRole === 'moderator' || userRole === 'owner') && !isCurrentUser) {
                                      return (
                                        <span className="user-role-label" style={{ fontStyle: 'italic', marginLeft: '8px' }}>
                                          {userRole === 'moderator' ? 'Модератор' : 'Владелец'}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </span>
                              </div>
                            )}
                            {shouldHideAuthor && (
                              <div className="chat-message-time-alone">
                                {new Date(m.created_at).toLocaleString()}
                                {m.updated_at && m.updated_at !== m.created_at && (
                                  <span title="Редактировалось"> ✎</span>
                                )}
                              </div>
                            )}
                            <div className="chat-message-body">
                              <MarkdownMessage content={m.body} />
                            </div>
                            
                            {isSelected && (
                              <div className="message-selected-indicator">✓</div>
                            )}
                            {/* Add selection indicator for messages that can be selected */}
                            {isSelecting && !canDeleteMessage(m) && (
                              <div className="message-not-selectable-indicator">○</div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
                {formatTypingUsers(typingUsers) && (
                  <div 
                    ref={typingIndicatorRef}
                    style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}
                  >
                    {formatTypingUsers(typingUsers)} печатает…
                  </div>
                )}
                <div ref={messagesEndRef} />
                {/* Floating scroll to bottom button */}
                {showScrollButton && (
                  <button 
                    className="scroll-to-bottom-btn"
                    onClick={scrollToBottom}
                    aria-label="Прокрутить к последнему сообщению"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M12 5v14M19 12l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Context Menu */}
              {contextMenu.visible && contextMenu.message && (
                <div 
                  ref={contextMenuRef}
                  className="context-menu"
                  style={{
                    position: 'fixed',
                    left: contextMenu.x,
                    top: contextMenu.y,
                    zIndex: 1000
                  }}
                >
                  {/* Кнопка копирования сообщения */}
                  <button 
                    className="context-menu-item"
                    onClick={() => {
                      if (contextMenu.message) {
                        // Проверяем, что мы в безопасном контексте перед доступом к Clipboard API
                        if (navigator.clipboard && window.isSecureContext) {
                          navigator.clipboard.writeText(contextMenu.message.body);
                        } else {
                          // Резервный вариант для небезопасных контекстов
                          const textArea = document.createElement('textarea');
                          textArea.value = contextMenu.message.body;
                          document.body.appendChild(textArea);
                          textArea.focus();
                          textArea.select();
                          try {
                            document.execCommand('copy');
                          } catch (err) {
                            console.error('Failed to copy text: ', err);
                          }
                          document.body.removeChild(textArea);
                        }
                      }
                      hideContextMenu();
                    }}
                  >
                    Копировать
                  </button>
                  
                  {/* Редактировать можно только свои сообщения */}
                  {canEditMessage(contextMenu.message) && (
                    <button 
                      className="context-menu-item"
                      onClick={() => startEditingMessage(contextMenu.message)}
                    >
                      Редактировать
                    </button>
                  )}
                  
                  <button 
                    className="context-menu-item"
                    onClick={() => {
                      if (contextMenu.message && canDeleteMessage(contextMenu.message)) {
                        toggleMessageSelection(contextMenu.message.id);
                      }
                      hideContextMenu();
                    }}
                  >
                    {contextMenu.message && selectedMessages.includes(contextMenu.message.id) ? 'Снять выделение' : 'Выделить'}
                  </button>
                  
                  {/* Удалять могут владелец/модератор или автор */}
                  {canDeleteMessage(contextMenu.message) && (
                    <button 
                      className="context-menu-item danger-text-only"
                      onClick={() => {
                        if (contextMenu.message) {
                          deleteSingleMessage(contextMenu.message.id);
                        }
                        hideContextMenu();
                      }}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              )}
              
              {/* Mobile Selection Controls */}
              {isSelecting && (
                <div className="mobile-selection-controls">
                  <div className="mobile-selection-actions">
                    <button onClick={selectAllMessages}>Выделить все</button>
                    <button onClick={clearSelectedMessagesOnly}>Снять выделение</button>
                    <button className="danger" onClick={deleteSelectedMessages}>
                      Удалить ({selectedMessages.length})
                    </button>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleSend} className="chat-form" style={{ display: isSelecting ? 'none' : 'flex' }}>
                <textarea
                  ref={textareaRef}
                  value={sendText}
                  onChange={(e) => {
                    setSendText(e.target.value);
                  }}
                  onInput={() => {
                    handleTyping();
                    adjustTextareaHeight();
                  }}
                  onPaste={() => {
                    // Adjust height after paste event (with slight delay to ensure content is processed)
                    setTimeout(adjustTextareaHeight, 10);
                  }}
                  placeholder="Сообщение…"
                  autoComplete="off"
                  autoFocus
                  rows={1}
                  onKeyDown={handleKeyDown}
                  style={{
                    minHeight: '54px',
                    maxHeight: '240px', // 10 lines * 24px per line
                    resize: 'none',
                    overflowY: 'hidden' // We control overflow in the function now
                  }}
                />
                <button type="submit" disabled={!roomId || !sendText.trim()}>
                  <span className="send-text">Отправить</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>
            </>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Выберите чат или создайте новый
            </div>
          )}
        </div>
      </div>
    </div>
  );
}