import { logger } from './utils/logger'; // Import our logger

// Global WebSocket instance to ensure only one connection exists
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let sharedWebSocket: WebSocket | null = null;
let messageHandlers: ((data: any) => void)[] = [];
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

/**
 * Initializes a WebSocket connection if one doesn't already exist
 */
export const initializeWebSocket = (): WebSocket | null => {
  if (sharedWebSocket) {
    // If there's already a connection, return it
    if (sharedWebSocket.readyState === WebSocket.OPEN) {
      return sharedWebSocket;
    } else {
      // If the connection exists but is not open, close it before creating a new one
      closeWebSocket();
    }
  }

  // Use the same protocol and host as the current page for Vite proxy to work correctly
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Use the same host as the current page so Vite proxy handles the WebSocket connection
  const wsUrl = `${protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}/ws`;
  logger.debug(`Initializing WebSocket connection to: ${wsUrl}`);

  try {
    sharedWebSocket = new WebSocket(wsUrl);

    sharedWebSocket.onopen = () => {
      logger.debug('WebSocket connected');
      reconnectAttempts = 0; // Reset attempts on successful connection
      
      // Start heartbeat interval to keep connection alive
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      heartbeatInterval = setInterval(() => {
        if (sharedWebSocket?.readyState === WebSocket.OPEN) {
          sharedWebSocket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // Send ping every 30 seconds
    };

    sharedWebSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Special handling for pong messages (keep-alive response)
        if (data.type === 'pong') {
          return; // Don't broadcast pong messages to handlers
        }
        
        // Broadcast message to all registered handlers
        messageHandlers.forEach(handler => handler(data));
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    sharedWebSocket.onerror = (error) => {
      logger.error('WebSocket error:', error);
    };

    sharedWebSocket.onclose = (event) => {
      logger.debug('WebSocket connection closed:', event.code, event.reason);
      
      // Clear heartbeat interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      
      // If the close was not initiated by us (code 1000), try to reconnect
      if (event.code !== 1000) {
        // Implement exponential backoff to prevent overwhelming the server
        reconnectAttempts++;
        if (reconnectAttempts <= maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Max 30 seconds
          logger.debug(`Attempting to reconnect to WebSocket in ${delay}ms... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
          setTimeout(() => {
            // Reinitialize the connection
            initializeWebSocket();
          }, delay);
        } else {
          logger.error('Max reconnection attempts reached. Please reload the page.');
        }
      }
    };
  } catch (error) {
    logger.error('Failed to create WebSocket connection:', error);
    return null;
  }

  return sharedWebSocket;
};

/**
 * Closes the WebSocket connection if it exists
 */
export const closeWebSocket = () => {
  if (sharedWebSocket) {
    // Clear the heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    
    // Close the WebSocket with a normal closure code
    sharedWebSocket.close(1000, "Client closing WebSocket");
    sharedWebSocket = null;
  }
};

/**
 * Adds a message handler to receive WebSocket messages
 */
export const addMessageHandler = (handler: (data: any) => void) => {
  if (!messageHandlers.includes(handler)) {
    messageHandlers.push(handler);
  }
};

/**
 * Removes a message handler
 */
export const removeMessageHandler = (handler: (data: any) => void) => {
  const index = messageHandlers.indexOf(handler);
  if (index !== -1) {
    messageHandlers.splice(index, 1);
  }
};

/**
 * Gets the current WebSocket instance
 */
export const getWebSocket = () => sharedWebSocket;

/**
 * Checks if WebSocket is connected
 */
export const isWebSocketConnected = () => {
  return sharedWebSocket && sharedWebSocket.readyState === WebSocket.OPEN;
};