import { TWEET_SERVER_URL } from "./constants";

type MessageHandler = (event: string, data: unknown) => void;

let socket: WebSocket | null = null;
let handlers: MessageHandler[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getWsUrl(): string {
  // Convert http://localhost:3000 → ws://localhost:3000/v1/ws
  return TWEET_SERVER_URL.replace(/^http/, "ws") + "/v1/ws";
}

function connect() {
  if (socket?.readyState === WebSocket.OPEN) return;

  try {
    socket = new WebSocket(getWsUrl());

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        for (const handler of handlers) {
          handler(msg.event, msg.data);
        }
      } catch {
        // ignore malformed messages
      }
    };

    socket.onclose = () => {
      // Reconnect after 3 seconds
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 3000);
      }
    };

    socket.onerror = () => {
      socket?.close();
    };
  } catch {
    // WebSocket not available
  }
}

/**
 * Subscribe to real-time feed events.
 * Returns an unsubscribe function.
 */
export function onFeedUpdate(handler: MessageHandler): () => void {
  handlers.push(handler);
  connect(); // Ensure connection is open

  return () => {
    handlers = handlers.filter((h) => h !== handler);
    if (handlers.length === 0 && socket) {
      socket.close();
      socket = null;
    }
  };
}
