export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8080";

export interface ApiAgent {
  id: string; name: string; owner: string; did: string;
  wallet_address: string | null; network: string; status: "active" | "paused" | "revoked";
  created_at: string; updated_at: string;
}
export interface ApiPolicy {
  id: string; agent_id: string; name: string; transaction_limit_wei: string;
  daily_limit_wei: string; approved_merchants: string[]; valid_until: string | null;
  revoked: boolean; created_at: string; updated_at: string;
}
export interface ApiAuditEvent {
  id: string; event_type: string; resource_type: string; resource_id: string | null;
  details: unknown; created_at: string;
}
export interface ApiPayment {
  id: string; agent_id: string; merchant: string; purpose: string;
  amount_wei: string; status: "settled" | "pending" | "rejected";
  rejection_reason: string | null; protocol: string; tx_hash: string | null; created_at: string;
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(sessionStorage.getItem("oncredsync_token") ? { Authorization: `Bearer ${sessionStorage.getItem("oncredsync_token")}` } : {}), ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? `API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
export const api = {
  health: () => request<{ status: string; database: string; mode?: string }>("/health"),
  listAgents: () => request<ApiAgent[]>("/api/v1/agents"),
  createAgent: (body: { name: string; owner: string; wallet_address?: string; network?: string }) =>
    request<ApiAgent>("/api/v1/agents", { method: "POST", body: JSON.stringify(body) }),
  setAgentStatus: (id: string, status: "active" | "paused" | "revoked") =>
    request<ApiAgent>(`/api/v1/agents/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  listPolicies: (agentId: string) => request<ApiPolicy[]>(`/api/v1/agents/${encodeURIComponent(agentId)}/policies`),
  createPolicy: (agentId: string, body: { name: string; transaction_limit_wei: string; daily_limit_wei: string; approved_merchants: string[] }) =>
    request<ApiPolicy>(`/api/v1/agents/${encodeURIComponent(agentId)}/policies`, { method: "POST", body: JSON.stringify(body) }),
  listPayments: () => request<ApiPayment[]>("/api/v1/payments"),
  listAuditEvents: () => request<ApiAuditEvent[]>("/api/v1/audit-events"),
  createPayment: (body: { agent_id: string; merchant: string; purpose: string; amount_wei: string }) =>
    request<ApiPayment>("/api/v1/payments", { method: "POST", body: JSON.stringify(body) }),
};

export type UserRole = "super_admin" | "workspace_admin" | "finance_manager" | "agent_operator" | "viewer";
export interface AuthUser { id: string; full_name: string; email: string; role: UserRole; status: "active" | "disabled"; workspace_id: string | null; created_at: string; }
export interface ApiWorkspace { id: string; name: string; created_at: string; }
export const authApi = {
  login: (email: string, password: string) => request<{ access_token: string; token_type: string; expires_in: number; user: AuthUser }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<AuthUser>("/api/v1/auth/me"),
  updateProfile: (full_name: string) => request<AuthUser>("/api/v1/auth/profile", { method: "PATCH", body: JSON.stringify({ full_name }) }),
  users: () => request<AuthUser[]>("/api/v1/auth/users"),
  workspaces: () => request<ApiWorkspace[]>("/api/v1/auth/workspaces"),
  createWorkspace: (name: string) => request<ApiWorkspace>("/api/v1/auth/workspaces", { method: "POST", body: JSON.stringify({ name }) }),
  createUser: (body: { full_name: string; email: string; password: string; role: UserRole; workspace_id?: string }) => request<AuthUser>("/api/v1/auth/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: { role?: UserRole; status?: "active" | "disabled" }) => request<AuthUser>(`/api/v1/auth/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
};
