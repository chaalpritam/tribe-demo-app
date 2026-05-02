import { getHubBaseUrl } from "./failover";

type MessageHandler = (event: string, data: unknown) => void;

let socket: WebSocket | null = null;
let handlers: MessageHandler[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let subscribedTid: string | null = null;

function getWsUrl(): string {
  // Resolves to the currently healthy hub, converting http → ws
  return getHubBaseUrl().replace(/^http/, "ws") + "/v1/ws";
}

function connect() {
  if (
    socket?.readyState === WebSocket.OPEN ||
    socket?.readyState === WebSocket.CONNECTING
  ) {
    return;
  }

  try {
    socket = new WebSocket(getWsUrl());

    socket.onopen = () => {
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
      // Reconnect with jitter (1-5s) to prevent thundering herd
      if (!reconnectTimer) {
        const jitter = 1000 + Math.random() * 4000;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, jitter);
      }
    };

    // Intentionally no onerror: onclose fires on its own and schedules
    // reconnect. Calling close() here while still CONNECTING produces a
    // noisy "WebSocket is closed before the connection is established".
  } catch {
    // WebSocket not available
  }
}

/**
 * Subscribe to real-time events from the hub.
 * Returns an unsubscribe function.
 */
export function onFeedUpdate(handler: MessageHandler): () => void {
  handlers.push(handler);
  connect();

  return () => {
    handlers = handlers.filter((h) => h !== handler);
    if (handlers.length === 0 && socket) {
      // Only close when fully open. Closing a CONNECTING socket logs a
      // browser warning; instead let it finish — a remount (e.g. React
      // Strict Mode) will reuse it via the CONNECTING guard in connect().
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
        socket = null;
      }
    }
  };
}

/**
 * Subscribe to notifications for a specific TID.
 */
export function subscribeTid(tid: string): void {
  subscribedTid = tid;
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ subscribe: tid }));
  } else {
    connect();
  }
}
