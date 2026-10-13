const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8080";

export interface ApiAgent {
  id: string; name: string; owner: string; did: string;
  wallet_address: string | null; network: string; status: "active" | "paused" | "revoked";
  created_at: string; updated_at: string;
}
export interface ApiPayment {
  id: string; agent_id: string; merchant: string; purpose: string;
  amount_cents: number; status: "settled" | "pending" | "rejected";
  rejection_reason: string | null; protocol: string; tx_hash: string | null; created_at: string;
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? `API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
export const api = {
  listAgents: () => request<ApiAgent[]>("/api/v1/agents"),
  createAgent: (body: { name: string; owner: string; wallet_address?: string; network?: string }) =>
    request<ApiAgent>("/api/v1/agents", { method: "POST", body: JSON.stringify(body) }),
  setAgentStatus: (id: string, status: "active" | "paused" | "revoked") =>
    request<ApiAgent>(`/api/v1/agents/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  listPayments: () => request<ApiPayment[]>("/api/v1/payments"),
  createPayment: (body: { agent_id: string; merchant: string; purpose: string; amount_cents: number }) =>
    request<ApiPayment>("/api/v1/payments", { method: "POST", body: JSON.stringify(body) }),
};
