export type AgentStatus = "Active" | "Paused" | "Revoked";
export type PaymentStatus = "Settled" | "Pending" | "Rejected";

export interface Agent {
  id: string;
  name: string;
  initials: string;
  identity: string;
  owner: string;
  network: string;
  status: AgentStatus;
  spent: number;
  budget: number;
  transactions: number;
  color: string;
}

export interface Payment {
  id: string;
  agent: string;
  merchant: string;
  purpose: string;
  amount: number;
  status: PaymentStatus;
  time: string;
  hash: string;
}

export const seedAgents: Agent[] = [
  { id: "AG-1024", name: "Research Agent", initials: "RA", identity: "did:ethr:base:0x82…a4f1", owner: "Vikas Labs", network: "Base Sepolia", status: "Active", spent: 32.40, budget: 100, transactions: 18, color: "violet" },
  { id: "AG-1025", name: "Data Scout", initials: "DS", identity: "did:ethr:base:0x1c…8b20", owner: "Vikas Labs", network: "Base Sepolia", status: "Active", spent: 18.75, budget: 50, transactions: 12, color: "blue" },
  { id: "AG-1026", name: "Market Analyst", initials: "MA", identity: "did:ethr:base:0xf4…0d91", owner: "FinOps Team", network: "Base Sepolia", status: "Paused", spent: 7.20, budget: 40, transactions: 5, color: "orange" },
  { id: "AG-1027", name: "Cloud Operator", initials: "CO", identity: "did:ethr:base:0x77…34c2", owner: "Platform Team", network: "Base Sepolia", status: "Active", spent: 44.60, budget: 75, transactions: 31, color: "green" },
];

export const seedPayments: Payment[] = [
  { id: "TX-89321", agent: "Research Agent", merchant: "Vector API", purpose: "Embedding generation", amount: 2.40, status: "Settled", time: "2 min ago", hash: "0x8ad4…09ce" },
  { id: "TX-89320", agent: "Cloud Operator", merchant: "ComputeCloud", purpose: "GPU compute · 1 hour", amount: 8.50, status: "Settled", time: "8 min ago", hash: "0xa19c…b72f" },
  { id: "TX-89319", agent: "Data Scout", merchant: "OpenData Hub", purpose: "Market dataset", amount: 1.25, status: "Settled", time: "16 min ago", hash: "0x3df2…1a83" },
  { id: "TX-89318", agent: "Market Analyst", merchant: "NewsWire API", purpose: "News sentiment endpoint", amount: 4.00, status: "Rejected", time: "24 min ago", hash: "—" },
  { id: "TX-89317", agent: "Research Agent", merchant: "Vector API", purpose: "Reranking request", amount: 0.85, status: "Settled", time: "37 min ago", hash: "0xc1f8…2dc1" },
  { id: "TX-89316", agent: "Cloud Operator", merchant: "ComputeCloud", purpose: "Storage request", amount: 2.10, status: "Pending", time: "51 min ago", hash: "Awaiting settlement" },
];

export const spendingTrend = [
  { day: "Mon", approved: 0.022, rejected: 0.004 },
  { day: "Tue", approved: 0.031, rejected: 0.002 },
  { day: "Wed", approved: 0.027, rejected: 0.006 },
  { day: "Thu", approved: 0.042, rejected: 0.003 },
  { day: "Fri", approved: 0.035, rejected: 0.005 },
  { day: "Sat", approved: 0.049, rejected: 0.002 },
  { day: "Sun", approved: 0.039, rejected: 0.004 },
];
