import { HUB_URL } from "./constants";

type MessageHandler = (event: string, data: unknown) => void;

let socket: WebSocket | null = null;
let handlers: MessageHandler[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let subscribedTid: string | null = null;

function getWsUrl(): string {
  // Convert http://localhost:4000 → ws://localhost:4000/v1/ws
  return HUB_URL.replace(/^http/, "ws") + "/v1/ws";
}

function connect() {
  if (socket?.readyState === WebSocket.OPEN) return;

  try {
    socket = new WebSocket(getWsUrl());

    socket.onopen = () => {
      // Re-subscribe to TID if we had one
      if (subscribedTid && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ subscribe: subscribedTid }));
      }
    };

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
 * Subscribe to real-time events from the indexer.
 * Returns an unsubscribe function.
 *
 * Events received:
 *   - "new_tweet"     — a new tweet was indexed
 *   - "new_follow"    — a follow event was processed
 *   - "notification"  — a notification for the subscribed TID
 *   - "connected"     — initial connection confirmation
 */
export function onFeedUpdate(handler: MessageHandler): () => void {
  handlers.push(handler);
  connect();

  return () => {
    handlers = handlers.filter((h) => h !== handler);
    if (handlers.length === 0 && socket) {
      socket.close();
      socket = null;
    }
  };
}

/**
 * Subscribe to notifications for a specific TID.
 * The server will push "notification" events for this TID.
 */
export function subscribeTid(tid: string): void {
  subscribedTid = tid;
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ subscribe: tid }));
  } else {
    connect();
  }
}
