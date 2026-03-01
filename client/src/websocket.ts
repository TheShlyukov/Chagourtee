import { logger } from './utils/logger';

// Use the global Timeout type instead of NodeJS.Timeout
let heartbeatInterval: number | null = null;
let reconnectTimeout: number | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000; // 3 seconds

// Handlers for messages and connection events
const messageHandlers: Set<(data: any) => void> = new Set();
const openHandlers: Set<() => void> = new Set();

// Track rooms we've joined so we can rejoin on reconnect
const joinedRooms: Set<number> = new Set();

/**
 * Initialize WebSocket connection
 */
export function initializeWebSocket() {
  if (sharedWebSocket && sharedWebSocket.readyState !== WebSocket.CLOSED) {
    logger.debug('WebSocket already exists with readyState:', sharedWebSocket.readyState);
    return sharedWebSocket;
  }

  try {
    logger.debug('Initializing WebSocket connection');
    sharedWebSocket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:${location.port || '3000'}/ws`);

    sharedWebSocket.onopen = () => {
      logger.info('WebSocket connected');
      reconnectAttempts = 0; // Reset attempts on successful connection
      
      // Send any pending join requests
      joinedRooms.forEach(roomId => {
        if (sharedWebSocket?.readyState === WebSocket.OPEN) {
          sharedWebSocket.send(JSON.stringify({ type: 'join', roomId }));
          logger.debug(`Re-sent join request for room ${roomId}`);
        }
      });
      
      // Run all registered open handlers
      openHandlers.forEach(handler => handler());
    };

    sharedWebSocket.onclose = (event) => {
      logger.warn('WebSocket disconnected:', event.code, event.reason);
      cleanupConnection();
      
      // Attempt to reconnect unless closed was intentional
      if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
        logger.info(`Attempting to reconnect... (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
        reconnectTimeout = window.setTimeout(() => {
          reconnectAttempts++;
          initializeWebSocket();
        }, reconnectDelay);
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        logger.error('Max reconnection attempts reached. Please refresh the page.');
        // Optionally show a notification to the user
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Соединение с сервером потеряно', {
            body: 'Превышено максимальное количество попыток восстановления соединения. Пожалуйста, обновите страницу.'
          });
        }
      }
    };

    sharedWebSocket.onerror = (error) => {
      logger.error('WebSocket error:', error);
    };

    sharedWebSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Process heartbeat responses
        if (data.type === 'pong') {
          logger.debug('Received pong response');
        }
        
        // Call all registered message handlers
        messageHandlers.forEach(handler => handler(data));
      } catch (e) {
        logger.error('Error parsing WebSocket message:', e);
      }
    };

    // Start heartbeat/ping mechanism
    startHeartbeat();

    return sharedWebSocket;
  } catch (error) {
    logger.error('Failed to initialize WebSocket:', error);
    throw error;
  }
}

// Declare the sharedWebSocket variable separately to avoid initialization issues
let sharedWebSocket: WebSocket | null = null;

/**
 * Start the heartbeat mechanism to keep connection alive
 */
function startHeartbeat() {
  // Clear any existing interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  // Send ping every 30 seconds to keep connection alive
  heartbeatInterval = setInterval(() => {
    if (sharedWebSocket?.readyState === WebSocket.OPEN) {
      logger.debug('Sending ping...');
      sharedWebSocket.send(JSON.stringify({ type: 'ping' }));
    } else {
      logger.warn('WebSocket not open, stopping heartbeat');
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }
  }, 30000); // 30 seconds
}

/**
 * Cleanup connection and intervals
 */
function cleanupConnection() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  if (sharedWebSocket) {
    sharedWebSocket.close();
    sharedWebSocket = null;
  }
}

/**
 * Get the shared WebSocket instance
 */
export function getWebSocket(): WebSocket | null {
  return sharedWebSocket;
}

/**
 * Check if WebSocket is currently connected
 */
export function isWebSocketConnected(): boolean {
  return sharedWebSocket !== null && sharedWebSocket.readyState === WebSocket.OPEN;
}

/**
 * Add a message handler
 */
export function addMessageHandler(handler: (data: any) => void) {
  messageHandlers.add(handler);
}

/**
 * Remove a message handler
 */
export function removeMessageHandler(handler: (data: any) => void) {
  messageHandlers.delete(handler);
}

/**
 * Add an open handler
 */
export function addOpenHandler(handler: () => void) {
  openHandlers.add(handler);
}

/**
 * Remove an open handler
 */
export function removeOpenHandler(handler: () => void) {
  openHandlers.delete(handler);
}

/**
 * Join a room
 */
export function joinRoom(roomId: number) {
  if (sharedWebSocket?.readyState === WebSocket.OPEN) {
    sharedWebSocket.send(JSON.stringify({ type: 'join', roomId }));
    joinedRooms.add(roomId);
    logger.debug(`Joined room ${roomId}`);
  } else {
    logger.warn(`Cannot join room ${roomId}, WebSocket not ready. Will join when connected.`);
    // Store the room ID so we can join when connection is established
    joinedRooms.add(roomId);
  }
}

/**
 * Leave a room
 */
export function leaveRoom(roomId: number) {
  if (sharedWebSocket?.readyState === WebSocket.OPEN) {
    sharedWebSocket.send(JSON.stringify({ type: 'leave', roomId }));
    joinedRooms.delete(roomId);
    logger.debug(`Left room ${roomId}`);
  } else {
    logger.warn(`Cannot leave room ${roomId}, WebSocket not ready`);
  }
}

/**
 * Close the WebSocket connection
 */
export function closeWebSocket() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval as number);
    heartbeatInterval = null;
  }
  
  if (sharedWebSocket) {
    // Close with code 1000 (normal closure)
    sharedWebSocket.close(1000);
    sharedWebSocket = null;
  }
  
  // Clear all handlers
  messageHandlers.clear();
  openHandlers.clear();
}