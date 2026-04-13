import { HUB_URLS, ER_SERVER_URLS } from "./constants";

interface NodeHealth {
  url: string;
  healthy: boolean;
  lastCheck: number;
}

const DEAD_NODE_RECHECK_MS = 30_000;
const REQUEST_TIMEOUT_MS = 5_000;

const hubNodes: NodeHealth[] = HUB_URLS.map((url) => ({
  url,
  healthy: true,
  lastCheck: 0,
}));

const erNodes: NodeHealth[] = ER_SERVER_URLS.map((url) => ({
  url,
  healthy: true,
  lastCheck: 0,
}));

function getCandidates(nodes: NodeHealth[]): NodeHealth[] {
  const now = Date.now();
  const healthy = nodes.filter((n) => n.healthy);
  const recheckable = nodes.filter(
    (n) => !n.healthy && now - n.lastCheck > DEAD_NODE_RECHECK_MS
  );
  return [...healthy, ...recheckable];
}

async function fetchWithFailover(
  nodes: NodeHealth[],
  path: string,
  init?: RequestInit
): Promise<Response> {
  const candidates = getCandidates(nodes);
  if (candidates.length === 0) {
    // All nodes dead and not yet recheckable — force retry all
    candidates.push(...nodes);
  }

  let lastError: Error | null = null;

  for (const node of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${node.url}${path}`, {
        ...init,
        signal: controller.signal,
      });
      // Any HTTP response (even 4xx/5xx) means the node is reachable
      node.healthy = true;
      node.lastCheck = Date.now();
      return res;
    } catch (err) {
      node.healthy = false;
      node.lastCheck = Date.now();
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("All nodes unreachable");
}

/**
 * Fetch from the hub with automatic failover between nodes.
 */
export function hubFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetchWithFailover(hubNodes, path, init);
}

/**
 * Fetch from the ER server with automatic failover between nodes.
 */
export function erFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetchWithFailover(erNodes, path, init);
}

/**
 * Get the base URL of the first healthy hub.
 * Used for constructing media URLs and WebSocket URLs.
 */
export function getHubBaseUrl(): string {
  const healthy = hubNodes.find((n) => n.healthy);
  return healthy?.url ?? hubNodes[0].url;
}

/**
 * Get the base URL of the first healthy ER server.
 */
export function getErBaseUrl(): string {
  const healthy = erNodes.find((n) => n.healthy);
  return healthy?.url ?? erNodes[0].url;
}
