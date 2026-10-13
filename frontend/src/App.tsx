import { useEffect, useMemo, useState } from "react";
import { api, type ApiAgent, type ApiPayment } from "./api";
import {
  Activity, ArrowRight, ArrowUpRight, Bell,
  Bot, ChevronDown, CircleHelp, Clock3, Command, Copy, CreditCard,
  ExternalLink, Fingerprint, Gauge, LayoutDashboard, LockKeyhole,
  Menu, MoreHorizontal, Network, Plus, Search, Settings2, Shield, ShieldAlert,
  ShieldCheck, SlidersHorizontal, Sparkles, WalletCards, X, Zap, Check, RefreshCw,
  Ban, Pause, Play, Eye, EyeOff, CheckCircle2, AlertTriangle, CircleDollarSign
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { seedAgents, seedPayments, spendingTrend, type Agent, type Payment } from "./data";

type Page = "Overview" | "Agents" | "Spending policies" | "Payments" | "Identity registry" | "Activity log" | "Settings";

const navigation = [
  { group: "WORKSPACE", items: [
    { name: "Overview" as Page, icon: LayoutDashboard },
    { name: "Agents" as Page, icon: Bot },
    { name: "Spending policies" as Page, icon: SlidersHorizontal },
    { name: "Payments" as Page, icon: CreditCard },
  ]},
  { group: "INFRASTRUCTURE", items: [
    { name: "Identity registry" as Page, icon: Fingerprint },
    { name: "Activity log" as Page, icon: Activity },
  ]},
];
const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const shortAddress = (value: string) => value.length > 22 ? value.slice(0, 14) + "…" + value.slice(-5) : value;
const fromApiAgent = (a: ApiAgent, index = 0): Agent => ({ id: a.id, name: a.name, initials: a.name.split(/\\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase(), identity: a.did, owner: a.owner, network: a.network, status: a.status === "active" ? "Active" : a.status === "paused" ? "Paused" : "Revoked", spent: 0, budget: 0, transactions: 0, color: ["violet", "blue", "orange", "green"][index % 4] });
const fromApiPayment = (p: ApiPayment, agents: Agent[]): Payment => ({ id: p.id, agent: agents.find(a => a.id === p.agent_id)?.name ?? p.agent_id, merchant: p.merchant, purpose: p.purpose, amount: p.amount_cents / 100, status: p.status === "settled" ? "Settled" : p.status === "pending" ? "Pending" : "Rejected", time: new Date(p.created_at).toLocaleString(), hash: p.tx_hash ?? (p.rejection_reason ? p.rejection_reason : "No settlement (demo)") });

export default function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [paymentFilter, setPaymentFilter] = useState("All transactions");
  const [showIdentity, setShowIdentity] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentOwner, setAgentOwner] = useState("Vikas Labs");
  const [agentBudget, setAgentBudget] = useState("50");
  const [policyLimit, setPolicyLimit] = useState("10");
  const [policyPeriod, setPolicyPeriod] = useState("Daily");
  const [merchant, setMerchant] = useState("api.example.com");
  const [testAmount, setTestAmount] = useState("3.50");
  const [testAgent, setTestAgent] = useState("");
  const [testMerchant, setTestMerchant] = useState("Vector API");
  const [testResult, setTestResult] = useState<"Approved" | "Rejected" | null>(null);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiAgents = await api.listAgents();
        const mappedAgents = apiAgents.map(fromApiAgent);
        const apiPayments = await api.listPayments();
        if (!cancelled) {
          setAgents(mappedAgents);
          setPayments(apiPayments.map(p => fromApiPayment(p, mappedAgents)));
          setTestAgent(current => current || mappedAgents[0]?.id || "");
        }
      } catch (error) { if (!cancelled) notify(error instanceof Error ? "API load failed: " + error.message : "API load failed"); }
      finally { if (!cancelled) setLoadingData(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshData = async () => {
    setLoadingData(true);
    try {
      const apiAgents = await api.listAgents();
      const mappedAgents = apiAgents.map(fromApiAgent);
      const apiPayments = await api.listPayments();
      setAgents(mappedAgents); setPayments(apiPayments.map(p => fromApiPayment(p, mappedAgents)));
      setTestAgent(current => mappedAgents.some(a => a.id === current) ? current : mappedAgents[0]?.id || "");
      notify("Data refreshed from API");
    } catch (error) { notify(error instanceof Error ? error.message : "Refresh failed"); }
    finally { setLoadingData(false); }
  };

  const activeAgents = agents.filter(a => a.status === "Active").length;
  const totalSpent = agents.reduce((sum, a) => sum + a.spent, 0);
  const totalBudget = agents.filter(a => a.status !== "Revoked").reduce((sum, a) => sum + a.budget, 0);
  const rejectedPayments = payments.filter(p => p.status === "Rejected").length;
  const filteredAgents = useMemo(() => agents.filter(a => [a.name, a.id, a.owner, a.identity].some(v => v.toLowerCase().includes(query.toLowerCase()))), [agents, query]);
  const filteredPayments = useMemo(() => payments.filter(p => {
    const matches = [p.id, p.agent, p.merchant, p.purpose].some(v => v.toLowerCase().includes(query.toLowerCase()));
    return matches && (paymentFilter === "All transactions" || p.status === paymentFilter);
  }), [payments, query, paymentFilter]);

  const createAgent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = agentName.trim();
    if (!name) return;
    try {
      const created = await api.createAgent({ name, owner: agentOwner.trim(), network: "Base Sepolia" });
      const agent = fromApiAgent(created, agents.length);
      agent.budget = Math.max(0, Number(agentBudget) || 0);
      setAgents(current => [agent, ...current]); setTestAgent(created.id); setAgentName(""); setAgentBudget("50"); setCreateOpen(false);
      setPage("Agents"); notify("Agent saved to backend. Budget is display-only until a policy is configured.");
    } catch (error) { notify(error instanceof Error ? error.message : "Agent creation failed"); }
  };

  const toggleAgent = async (agent: Agent) => {
    if (agent.status === "Revoked") { notify("Revoked identity cannot be reactivated"); return; }
    const status = agent.status === "Active" ? "paused" : "active";
    try {
      const updated = await api.setAgentStatus(agent.id, status);
      setAgents(current => current.map(a => a.id === agent.id ? fromApiAgent(updated, current.indexOf(a)) : a));
      setSelectedAgent(current => current?.id === agent.id ? fromApiAgent(updated, agents.indexOf(agent)) : current);
      notify(agent.name + (status === "paused" ? " paused" : " activated") + " and saved");
    } catch (error) { notify(error instanceof Error ? error.message : "Agent status update failed"); }
  };
  const revokeAgent = async (agent: Agent) => {
    try {
      const updated = await api.setAgentStatus(agent.id, "revoked");
      setAgents(current => current.map(a => a.id === agent.id ? fromApiAgent(updated, current.indexOf(a)) : a));
      setSelectedAgent(null); notify(agent.name + " revoked and saved");
    } catch (error) { notify(error instanceof Error ? error.message : "Agent revocation failed"); }
  };

  const runPaymentTest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const agent = agents.find(a => a.id === testAgent);
    const amount = Number(testAmount);
    if (!agent) { notify("Register an agent before testing a payment"); return; }
    if (!Number.isFinite(amount) || amount <= 0) { notify("Enter a positive payment amount"); return; }
    try {
      const result = await api.createPayment({ agent_id: agent.id, merchant: testMerchant, purpose: "Policy simulator request", amount_cents: Math.round(amount * 100) });
      const mapped = fromApiPayment(result, agents);
      setPayments(current => [mapped, ...current.filter(p => p.id !== mapped.id)]);
      setTestResult(result.status === "rejected" ? "Rejected" : "Approved");
      notify(result.status === "rejected" ? "Payment rejected: " + (result.rejection_reason ?? "policy check failed") : "Recorded as pending; no funds transferred");
    } catch (error) { notify(error instanceof Error ? error.message : "Payment request failed"); }
  };

  const headline = page === "Overview" ? "Good evening, Vikas" : page;
  const subtitle = page === "Overview" ? "Here's what's happening with your autonomous payment network." : ({
    "Agents": "Manage agent identities, access and operational status.",
    "Spending policies": "Define the boundaries every autonomous payment must respect.",
    "Payments": "Monitor requests, policy decisions and settlement activity.",
    "Identity registry": "Explore the decentralized identities associated with your workspace.",
    "Activity log": "A chronological record of workspace actions and policy events.",
    "Settings": "Manage workspace preferences and connected infrastructure."
  } as Record<string,string>)[page];

  return (
    <div className="app-shell">
      <aside className={"sidebar " + (sidebarOpen ? "sidebar-open" : "")}>
        <div className="brand"><div className="brand-mark"><Command size={20} strokeWidth={2.3}/></div><span>oncred<span className="brand-light">sync</span></span><span className="brand-beta">BETA</span><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={18}/></button></div>
        <button className="workspace-switch" onClick={() => notify("Workspace switcher is a frontend demo")}><div className="workspace-avatar">VL</div><div className="workspace-label"><strong>Vikas Labs</strong><span>Free workspace</span></div><ChevronDown size={15} className="muted"/></button>
        <div className="nav-scroll">
          {navigation.map(section => <div className="nav-section" key={section.group}><div className="nav-label">{section.group}</div>{section.items.map(item => <button key={item.name} className={"nav-link " + (page === item.name ? "active" : "")} onClick={() => {setPage(item.name);setSidebarOpen(false);}}><item.icon size={17}/><span>{item.name}</span>{item.name === "Payments" && <span className="nav-count">{payments.length}</span>}</button>)}</div>)}
          <div className="nav-section"><div className="nav-label">PREFERENCES</div><button className={"nav-link " + (page === "Settings" ? "active" : "")} onClick={() => setPage("Settings")}><Settings2 size={17}/><span>Settings</span></button><button className="nav-link" onClick={() => notify("Help center will be connected soon")}><CircleHelp size={17}/><span>Help center</span><ExternalLink size={13} className="nav-external"/></button></div>
          <div className="sidebar-callout"><div className="callout-icon"><Sparkles size={16}/></div><strong>Autonomy, with guardrails.</strong><p>Every agent. One policy layer. Total control.</p><button onClick={() => {setPolicyOpen(true);setPage("Spending policies");}}>Explore policies <ArrowRight size={13}/></button><div className="callout-orb orb-one"/><div className="callout-orb orb-two"/></div>
        </div>
        <div className="sidebar-bottom"><div className="status-line"><span className="live-dot"/><span>Demo environment</span><span className="status-right">LOCAL</span></div><button className="profile-button" onClick={() => {setPage("Settings");setSidebarOpen(false);}}><div className="profile-avatar">GV</div><div className="profile-info"><strong>Vikas Gummadala</strong><span>Workspace owner</span></div><MoreHorizontal size={18} className="muted"/></button></div>
      </aside>
      {sidebarOpen && <button className="mobile-backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)}/>}

      <main className="main-area">
        <header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={19}/></button><span>Workspace</span><span className="crumb-slash">/</span><strong>{page}</strong></div><div className="topbar-actions"><div className="network-pill"><span className="network-dot"/><span>Base Sepolia</span><ChevronDown size={13}/></div><button className="icon-button notification-button" aria-label="Notifications" onClick={() => notify("You're all caught up")}><Bell size={17}/><span className="notification-dot"/></button><div className="top-avatar">GV</div></div></header>

        <div className="page-content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>{page === "Overview" ? "COMMAND CENTER" : "ONCREDSYNC WORKSPACE"}</div><h1>{headline}{page === "Overview" && <span className="wave"> ✳</span>}</h1><p>{subtitle}</p></div><div className="heading-actions"><button className="button button-secondary" onClick={refreshData} disabled={loadingData}><RefreshCw size={15}/> {loadingData ? "Loading…" : "Refresh"}</button><button className="button button-primary" onClick={() => setCreateOpen(true)}><Plus size={16}/> New agent</button></div></div>

          {page === "Overview" && <Overview agents={agents} payments={payments} totalSpent={totalSpent} totalBudget={totalBudget} activeAgents={activeAgents} rejectedPayments={rejectedPayments} onNavigate={setPage} onNewAgent={() => setCreateOpen(true)} onPaymentTest={() => {setTestResult(null);setPolicyOpen(true);}} onViewAgent={setSelectedAgent}/>}
          {page === "Agents" && <AgentsPage agents={filteredAgents} query={query} setQuery={setQuery} onNew={() => setCreateOpen(true)} onSelect={setSelectedAgent} onToggle={toggleAgent}/>}
          {page === "Spending policies" && <PoliciesPage agents={agents} policyOpen={() => setPolicyOpen(true)} onNotify={notify} />}
          {page === "Payments" && <PaymentsPage payments={filteredPayments} query={query} setQuery={setQuery} paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter}/>}
          {page === "Identity registry" && <IdentityPage agents={agents} showIdentity={showIdentity} setShowIdentity={setShowIdentity} onNotify={notify}/>}
          {page === "Activity log" && <ActivityPage payments={payments}/>}
          {page === "Settings" && <SettingsPage onNotify={notify}/>}
          <footer className="page-footer"><span>© 2026 OnCredSync. Autonomous by design.</span><span><span className="footer-status"/>{ "Frontend prototype · Not connected to a live chain" }</span></footer>
        </div>
      </main>

      {createOpen && <Modal title="Register an AI agent" subtitle="Create a new agent identity in this demo workspace." onClose={() => setCreateOpen(false)}><form className="modal-form" onSubmit={createAgent}><label>Agent name<input autoFocus value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="e.g. Research Assistant" required maxLength={60}/></label><label>Owner / team<input value={agentOwner} onChange={e => setAgentOwner(e.target.value)} required/></label><label>Initial budget (USD)<input value={agentBudget} onChange={e => setAgentBudget(e.target.value)} type="number" min="0" max="1000000" step="0.01" required/></label><div className="notice-box"><ShieldCheck size={17}/><span>A unique demo DID will be assigned. Real on-chain registration is not enabled yet.</span></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setCreateOpen(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={15}/> Create agent</button></div></form></Modal>}

      {policyOpen && <Modal title="Payment policy simulator" subtitle="Test the policy rules against a sample autonomous payment." onClose={() => setPolicyOpen(false)} wide><form className="modal-form" onSubmit={runPaymentTest}><div className="simulator-banner"><div className="sim-icon"><ShieldCheck size={21}/></div><div><strong>Policy enforcement preview</strong><span>Requests are evaluated against demo workspace rules.</span></div><span className="demo-badge">DEMO</span></div><label>Agent<select value={testAgent} onChange={e => setTestAgent(e.target.value)}>{agents.map(a => <option key={a.id} value={a.id}>{a.name} · {a.status}</option>)}</select></label><div className="form-grid"><label>Payment amount (USD)<input value={testAmount} onChange={e => setTestAmount(e.target.value)} type="number" min="0.01" step="0.01" required/></label><label>Merchant<select value={testMerchant} onChange={e => setTestMerchant(e.target.value)}><option>Vector API</option><option>ComputeCloud</option><option>OpenData Hub</option><option>Unknown Merchant</option></select></label></div><div className="rule-preview"><div><span className="rule-check"><Check size={13}/></span><span>Agent must be active</span></div><div><span className="rule-check"><Check size={13}/></span><span>Transaction limit: $10.00</span></div><div><span className="rule-check"><Check size={13}/></span><span>Merchant must be approved</span></div><div><span className="rule-check"><Check size={13}/></span><span>Budget remaining must cover payment</span></div></div>{testResult && <div className={"result-box " + (testResult === "Approved" ? "result-success" : "result-fail")}>{testResult === "Approved" ? <CheckCircle2 size={19}/> : <ShieldAlert size={19}/>}<div><strong>Request {testResult}</strong><span>{testResult === "Approved" ? "The simulated request passed all demo policy checks." : "One or more policy rules failed. Review agent status, amount, budget and merchant."}</span></div></div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setPolicyOpen(false)}>Close</button><button className="button button-primary" type="submit"><Zap size={15}/> Evaluate request</button></div></form></Modal>}

      {selectedAgent && <Modal title={selectedAgent.name} subtitle={selectedAgent.id + " · Agent profile"} onClose={() => setSelectedAgent(null)}><div className="agent-detail"><div className="agent-detail-head"><div className={"agent-avatar large " + selectedAgent.color}>{selectedAgent.initials}</div><Status value={selectedAgent.status}/></div><div className="detail-stat-row"><div><span>Spent</span><strong>{usd(selectedAgent.spent)}</strong></div><div><span>Budget</span><strong>{usd(selectedAgent.budget)}</strong></div><div><span>Transactions</span><strong>{selectedAgent.transactions}</strong></div></div><div className="detail-field"><span>Decentralized identity</span><code>{selectedAgent.identity}</code></div><div className="detail-field"><span>Owner</span><strong>{selectedAgent.owner}</strong></div><div className="detail-field"><span>Network</span><strong>{selectedAgent.network}</strong></div><div className="modal-actions split-actions"><button className="button button-secondary" onClick={() => {navigator.clipboard?.writeText(selectedAgent.identity);notify("Identity copied");}}><Copy size={14}/> Copy DID</button><button className="button button-secondary" onClick={() => toggleAgent(selectedAgent)} disabled={selectedAgent.status === "Revoked"}>{selectedAgent.status === "Active" ? <Pause size={14}/> : <Play size={14}/>} {selectedAgent.status === "Active" ? "Pause agent" : "Activate agent"}</button><button className="button button-danger" onClick={() => revokeAgent(selectedAgent)} disabled={selectedAgent.status === "Revoked"}><Ban size={14}/> Revoke</button></div></div></Modal>}
      {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    </div>
  );
}

function Overview({ agents, payments, totalSpent, totalBudget, activeAgents, rejectedPayments, onNavigate, onNewAgent, onPaymentTest, onViewAgent }: {
  agents: Agent[]; payments: Payment[]; totalSpent: number; totalBudget: number; activeAgents: number; rejectedPayments: number;
  onNavigate: (page: Page) => void; onNewAgent: () => void; onPaymentTest: () => void; onViewAgent: (agent: Agent) => void;
}) {
  const settled = payments.filter(p => p.status === "Settled").length;
  const approvalRate = payments.length ? Math.round(settled / payments.length * 100) : 0;
  return <div className="overview-stack">
    <div className="welcome-banner"><div className="welcome-copy"><div className="welcome-chip"><span className="live-dot"/> SYSTEM OPERATIONAL <span className="chip-divider"/> <span>TEST NETWORK</span></div><h2>Trust every transaction.<br/><span>Control every agent.</span></h2><p>Your AI agents are running within policy. Here's your network at a glance.</p><div className="welcome-buttons"><button className="button button-light" onClick={onNewAgent}><Plus size={15}/> Register an agent</button><button className="button button-glass" onClick={onPaymentTest}><ShieldCheck size={15}/> Test a payment <ArrowRight size={14}/></button></div></div><div className="welcome-art" aria-hidden="true"><div className="art-orbit orbit-a"/><div className="art-orbit orbit-b"/><div className="art-orbit orbit-c"/><div className="art-core"><Command size={30}/></div><div className="art-node node-a"><Bot size={18}/></div><div className="art-node node-b"><Fingerprint size={17}/></div><div className="art-node node-c"><WalletCards size={17}/></div><div className="art-node node-d"><ShieldCheck size={16}/></div><div className="art-spark spark-a">✳</div><div className="art-spark spark-b">·</div></div><div className="banner-grid"/></div>
    <div className="metrics-grid">
      <Metric icon={<Bot size={17}/>} label="Registered agents" value={String(agents.length).padStart(2,"0")} trend={activeAgents + " active right now"} trendIcon={<ArrowUpRight size={13}/>} tone="violet" foot="Across all teams"/>
      <Metric icon={<CircleDollarSign size={17}/>} label="Total spend" value={usd(totalSpent)} trend="Live demo activity" trendIcon={<Activity size={13}/>} tone="blue" foot={"of " + usd(totalBudget) + " allocated"}/>
      <Metric icon={<ShieldCheck size={17}/>} label="Payment success" value={approvalRate + "%"} trend={settled + " settled transactions"} trendIcon={<ArrowUpRight size={13}/>} tone="green" foot="Across visible history"/>
      <Metric icon={<ShieldAlert size={17}/>} label="Policy rejections" value={String(rejectedPayments).padStart(2,"0")} trend="Rules protect your funds" trendIcon={<Shield size={13}/>} tone="orange" foot="Rejected before settlement"/>
    </div>
    <div className="charts-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><div className="panel-title">Spending activity <span className="mini-live"><span/> DEMO</span></div><div className="panel-subtitle">Approved spend vs. rejected payment attempts</div></div><button className="select-pill" onClick={() => onNavigate("Payments")}>Last 7 days <ChevronDown size={13}/></button></div><div className="chart-legend"><span><i className="legend-approved"/>Approved</span><span><i className="legend-rejected"/>Rejected</span><span className="chart-unit">USD</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={spendingTrend} margin={{top:8,right:4,left:-20,bottom:0}}><defs><linearGradient id="approvedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7764ec" stopOpacity={0.19}/><stop offset="95%" stopColor="#7764ec" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf0f6" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:"#9299ac",fontSize:11}} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{fill:"#9299ac",fontSize:10}}/><Tooltip contentStyle={{border:"1px solid #e8eaf1",borderRadius:10,fontSize:12,boxShadow:"0 8px 24px #18214012"}} formatter={(v) => ["$" + v, ""]}/><Area type="monotone" dataKey="approved" name="Approved" stroke="#7665e8" strokeWidth={2.4} fill="url(#approvedFill)" activeDot={{r:4,strokeWidth:0}}/><Area type="monotone" dataKey="rejected" name="Rejected" stroke="#e5a052" strokeWidth={2} fill="transparent" activeDot={{r:3,strokeWidth:0}}/></AreaChart></ResponsiveContainer></div><div className="chart-bottom"><span><span className="bottom-dot purple"/>Daily authorized spend</span><span>Illustrative demo data</span></div></section>
      <section className="panel allocation-panel"><div className="panel-heading"><div><div className="panel-title">Budget allocation</div><div className="panel-subtitle">Spend by autonomous agent</div></div><button className="icon-button subtle-icon" aria-label="View agents" onClick={() => onNavigate("Agents")}><ArrowRight size={16}/></button></div><div className="allocation-total"><div><span>Allocated</span><strong>{usd(totalBudget)}</strong></div><div><span>Utilization</span><strong>{totalBudget ? Math.round(totalSpent/totalBudget*100) : 0}%</strong></div></div><div className="allocation-bar">{agents.filter(a => a.status !== "Revoked").map((a,i)=><span key={a.id} style={{width:(a.budget/Math.max(totalBudget,1)*100)+"%"}} className={"allocation-segment seg-"+a.color} title={a.name}/>)}</div><div className="allocation-list">{agents.filter(a=>a.status!=="Revoked").slice(0,4).map(a=><div className="allocation-item" key={a.id}><span className={"allocation-dot seg-"+a.color}/><span className="allocation-name">{a.name}</span><span className="allocation-amount">{usd(a.spent)} <em>/ {usd(a.budget)}</em></span></div>)}</div><button className="text-link full-link" onClick={() => onNavigate("Spending policies")}>Manage spending policies <ArrowRight size={14}/></button></section>
    </div>
    <section className="panel table-panel"><div className="panel-heading table-heading"><div><div className="panel-title">Recent payment activity</div><div className="panel-subtitle">The latest requests from your autonomous agents</div></div><button className="text-link" onClick={() => onNavigate("Payments")}>View all transactions <ArrowRight size={14}/></button></div><PaymentTable payments={payments.slice(0,5)}/></section>
    <div className="lower-grid"><section className="panel agents-panel"><div className="panel-heading"><div><div className="panel-title">Your agents <span className="counter-pill">{agents.length}</span></div><div className="panel-subtitle">Identity and spending overview</div></div><button className="icon-button subtle-icon" aria-label="All agents" onClick={() => onNavigate("Agents")}><ArrowRight size={16}/></button></div><div className="compact-agent-list">{agents.slice(0,4).map(a=><button className="compact-agent" key={a.id} onClick={() => onViewAgent(a)}><AgentAvatar agent={a}/><span className="compact-agent-copy"><strong>{a.name}</strong><span>{a.id} · {a.transactions} transactions</span></span><Status value={a.status}/><ChevronDown className="compact-chevron" size={14}/></button>)}</div><button className="text-link full-link" onClick={() => onNavigate("Agents")}>Manage all agents <ArrowRight size={14}/></button></section>
    <section className="panel safeguards-panel"><div className="panel-heading"><div><div className="panel-title">Policy safeguards</div><div className="panel-subtitle">Your network's current guardrails</div></div><div className="safeguard-icon"><ShieldCheck size={18}/></div></div><div className="safeguard-row"><div className="safeguard-symbol"><Gauge size={16}/></div><div className="safeguard-copy"><strong>Transaction cap</strong><span>Maximum amount per request</span></div><span className="safeguard-value">$10.00</span></div><div className="safeguard-row"><div className="safeguard-symbol"><Clock3 size={16}/></div><div className="safeguard-copy"><strong>Daily budget</strong><span>Reset window</span></div><span className="safeguard-value">24 hours</span></div><div className="safeguard-row"><div className="safeguard-symbol"><LockKeyhole size={16}/></div><div className="safeguard-copy"><strong>Merchant allowlist</strong><span>Restricted merchant access</span></div><span className="enabled-tag"><Check size={11}/> On</span></div><div className="safeguard-row"><div className="safeguard-symbol"><Ban size={16}/></div><div className="safeguard-copy"><strong>Instant revocation</strong><span>Disable agent access</span></div><span className="enabled-tag"><Check size={11}/> On</span></div><button className="text-link full-link" onClick={() => onNavigate("Spending policies")}>Configure policies <ArrowRight size={14}/></button></section></div>
  </div>;
}

function Metric({icon,label,value,trend,trendIcon,tone,foot}:{icon:React.ReactNode;label:string;value:string;trend:string;trendIcon:React.ReactNode;tone:string;foot:string}) {
  return <section className="metric-card"><div className="metric-top"><div className={"metric-icon "+tone}>{icon}</div><button className="metric-more" aria-label={label+" details"} title={label}><MoreHorizontal size={17}/></button></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className={"metric-trend "+tone}>{trendIcon}<span>{trend}</span></div><div className="metric-foot">{foot}</div></section>;
}

function AgentAvatar({agent,large=false}:{agent:Agent;large?:boolean}) {return <div className={"agent-avatar "+agent.color+(large?" large":"")}>{agent.initials}</div>;}
function Status({value}:{value:string}) {return <span className={"status status-"+value.toLowerCase()}><i/>{value}</span>;}

function PaymentTable({payments}:{payments:Payment[]}) {
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>TRANSACTION</th><th>AGENT / MERCHANT</th><th>AMOUNT</th><th>STATUS</th><th>TIME</th><th></th></tr></thead><tbody>{payments.length===0?<tr><td colSpan={6} className="empty-cell">No transactions match your search.</td></tr>:payments.map(p=><tr key={p.id}><td><span className="transaction-id">{p.id}</span><span className="cell-subline">{p.purpose}</span></td><td><div className="merchant-cell"><div className="merchant-mark">{p.merchant.slice(0,1)}</div><div><strong>{p.merchant}</strong><span>{p.agent}</span></div></div></td><td><span className="amount-cell">{usd(p.amount)}</span></td><td><Status value={p.status}/></td><td><span className="time-cell">{p.time}</span></td><td><button className="icon-button row-more" title={p.hash} aria-label={"Transaction "+p.id+" details"} onClick={() => navigator.clipboard?.writeText(p.hash)}><MoreHorizontal size={17}/></button></td></tr>)}</tbody></table></div>;
}

function AgentsPage({agents,query,setQuery,onNew,onSelect,onToggle}:{agents:Agent[];query:string;setQuery:(v:string)=>void;onNew:()=>void;onSelect:(a:Agent)=>void;onToggle:(a:Agent)=>void}) {
  return <div className="section-stack"><div className="section-toolbar"><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search agents, IDs or owners…"/>{query&&<button onClick={()=>setQuery("")} aria-label="Clear search"><X size={13}/></button>}</div><button className="button button-secondary"><SlidersHorizontal size={15}/> Filters</button><button className="button button-primary" onClick={onNew}><Plus size={15}/> Register agent</button></div><div className="agent-card-grid">{agents.map(a=><article className="panel agent-card" key={a.id}><div className="agent-card-top"><AgentAvatar agent={a} large/><button className="icon-button subtle-icon" aria-label="Agent options" onClick={()=>onSelect(a)}><MoreHorizontal size={18}/></button></div><div className="agent-card-name">{a.name}</div><div className="agent-card-id">{a.id} <span>·</span> {a.owner}</div><div className="identity-chip"><Fingerprint size={14}/><span>{shortAddress(a.identity)}</span><button title="Copy identity" aria-label="Copy identity" onClick={()=>navigator.clipboard?.writeText(a.identity)}><Copy size={12}/></button></div><div className="agent-card-budget"><div><span>Spend this period</span><strong>{usd(a.spent)} <em>/ {usd(a.budget)}</em></strong></div><span className="budget-percent">{a.budget?Math.round(a.spent/a.budget*100):0}%</span></div><div className="budget-progress"><span style={{width:Math.min(100,a.budget?a.spent/a.budget*100:0)+"%"}} className={"seg-"+a.color}/></div><div className="agent-card-footer"><Status value={a.status}/><span><Activity size={13}/>{a.transactions} transactions</span><button className="text-link" onClick={()=>onToggle(a)} disabled={a.status==="Revoked"}>{a.status==="Active"?"Pause":a.status==="Paused"?"Resume":"Revoked"}</button></div></article>)}</div>{agents.length===0&&<EmptyState title="No agents found" text="Try another search or register a new agent."/>}<div className="subtle-disclaimer"><Shield size={15}/> Agent information is local demo state and is not yet synchronized with a blockchain registry.</div></div>;
}

function PoliciesPage({agents,policyOpen,onNotify}:{agents:Agent[];policyOpen:()=>void;onNotify:(s:string)=>void}) {
  const rules=[{n:"Maximum transaction amount",v:"$10.00",desc:"Reject requests above the configured per-transaction cap.",icon:CircleDollarSign,tag:"ENFORCED IN DEMO"},{n:"Daily spending budget",v:"Per-agent",desc:"Requests are rejected when the remaining agent budget cannot cover the payment.",icon:Clock3,tag:"ENFORCED IN DEMO"},{n:"Approved merchant list",v:"Allowlist",desc:"Only approved merchants can receive a simulated payment.",icon:LockKeyhole,tag:"ENFORCED IN DEMO"},{n:"Agent status and revocation",v:"Immediate",desc:"Paused and revoked agents cannot authorize a simulated payment.",icon:Ban,tag:"ENFORCED IN DEMO"}];
  return <div className="section-stack"><div className="policy-hero"><div className="policy-hero-icon"><ShieldCheck size={24}/></div><div><div className="eyebrow">POLICY ENGINE <span className="demo-badge">FRONTEND DEMO</span></div><h2>Autonomy needs boundaries.</h2><p>Every payment request should prove it belongs. Review the current demo rules and test how your agents behave.</p></div><button className="button button-light" onClick={policyOpen}><Zap size={15}/> Simulate payment</button></div><div className="section-heading-row"><div><h2>Active guardrails</h2><p>Illustrative rules used by the local payment simulator.</p></div><span className="counter-pill">{rules.length} rules</span></div><div className="policy-list">{rules.map(r=><article className="panel policy-card" key={r.n}><div className="policy-rule-icon"><r.icon size={19}/></div><div className="policy-rule-content"><h3>{r.n}</h3><p>{r.desc}</p><span className="policy-tag"><span/> {r.tag}</span></div><div className="policy-rule-value">{r.v}</div><button className="icon-button subtle-icon" onClick={()=>onNotify("Policy editing will be wired to the smart contract in the backend phase")} aria-label={"Edit "+r.n}><Settings2 size={16}/></button></article>)}</div><div className="section-heading-row"><div><h2>Agent budget overview</h2><p>Remaining available budget in the current demo period.</p></div></div><div className="panel table-panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>AGENT</th><th>STATUS</th><th>ALLOCATED</th><th>SPENT</th><th>REMAINING</th><th>USAGE</th></tr></thead><tbody>{agents.map(a=><tr key={a.id}><td><div className="merchant-cell"><AgentAvatar agent={a}/><div><strong>{a.name}</strong><span>{a.id}</span></div></div></td><td><Status value={a.status}/></td><td>{usd(a.budget)}</td><td>{usd(a.spent)}</td><td><strong>{usd(Math.max(0,a.budget-a.spent))}</strong></td><td><div className="mini-progress"><span style={{width:Math.min(100,a.budget?a.spent/a.budget*100:0)+"%"}}/></div></td></tr>)}</tbody></table></div></div></div>;
}

function PaymentsPage({payments,query,setQuery,paymentFilter,setPaymentFilter}:{payments:Payment[];query:string;setQuery:(v:string)=>void;paymentFilter:string;setPaymentFilter:(v:string)=>void}) {
  const total=payments.filter(p=>p.status==="Settled").reduce((sum,p)=>sum+p.amount,0);
  return <div className="section-stack"><div className="metrics-grid mini-metrics"><Metric icon={<CreditCard size={16}/>} label="Visible transactions" value={String(payments.length)} trend="Current filter" trendIcon={<Activity size={13}/>} tone="violet" foot="In local demo history"/><Metric icon={<CircleDollarSign size={16}/>} label="Settled volume" value={usd(total)} trend="Successful payments" trendIcon={<ArrowUpRight size={13}/>} tone="green" foot="Illustrative values"/><Metric icon={<ShieldAlert size={16}/>} label="Rejected" value={String(payments.filter(p=>p.status==="Rejected").length)} trend="Policy guardrails" trendIcon={<Shield size={13}/>} tone="orange" foot="Not sent to settlement"/><Metric icon={<Clock3 size={16}/>} label="Pending" value={String(payments.filter(p=>p.status==="Pending").length)} trend="Awaiting finality" trendIcon={<Clock3 size={13}/>} tone="blue" foot="Demo status only"/></div><section className="panel table-panel"><div className="section-toolbar table-filter-toolbar"><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search transaction, agent or merchant…"/>{query&&<button onClick={()=>setQuery("")} aria-label="Clear search"><X size={13}/></button>}</div><select className="filter-select" value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value)}><option>All transactions</option><option>Settled</option><option>Pending</option><option>Rejected</option></select><button className="button button-secondary" onClick={()=>{setQuery("");setPaymentFilter("All transactions")}}><RefreshCw size={14}/> Reset</button></div><PaymentTable payments={payments}/></section><div className="subtle-disclaimer"><Network size={15}/> Transaction hashes and settlement statuses are illustrative; no live payment rails are connected.</div></div>;
}

function IdentityPage({agents,showIdentity,setShowIdentity,onNotify}:{agents:Agent[];showIdentity:boolean;setShowIdentity:(v:boolean)=>void;onNotify:(s:string)=>void}) {
  return <div className="section-stack"><div className="identity-hero"><div className="identity-graphic"><div className="identity-ring ring-one"/><div className="identity-ring ring-two"/><Fingerprint size={38}/></div><div><div className="eyebrow">DECENTRALIZED IDENTIFIERS</div><h2>One identity. Portable trust.</h2><p>Each agent profile carries a demo DID reference. On-chain DID resolution and verifiable credentials are planned for the integration phase.</p><button className="button button-secondary" onClick={()=>onNotify("Live DID resolver is not connected yet")}><ExternalLink size={14}/> DID resolver <span className="coming-soon">COMING SOON</span></button></div></div><div className="section-heading-row"><div><h2>Agent identity registry</h2><p>{agents.length} identities in this demo workspace.</p></div><button className="button button-secondary" onClick={()=>setShowIdentity(!showIdentity)}>{showIdentity?<EyeOff size={15}/>:<Eye size={15}/>} {showIdentity?"Hide full IDs":"Reveal IDs"}</button></div><div className="panel registry-list">{agents.map(a=><div className="registry-item" key={a.id}><AgentAvatar agent={a}/><div className="registry-main"><strong>{a.name}</strong><code>{showIdentity?a.identity:shortAddress(a.identity)}</code></div><Status value={a.status}/><button className="icon-button subtle-icon" title="Copy DID" aria-label="Copy DID" onClick={()=>{navigator.clipboard?.writeText(a.identity);onNotify("Demo identity copied")}}><Copy size={15}/></button></div>)}</div><div className="notice-box wide-notice"><ShieldCheck size={17}/><span>These identifiers are generated locally for UI demonstration. They are not registered DIDs, signed credentials, or proof of blockchain ownership.</span></div></div>;
}

function ActivityPage({payments}:{payments:Payment[]}) {
  const events=[...payments.map(p=>({id:p.id,title:p.status==="Rejected"?"Payment request rejected":p.status==="Pending"?"Payment settlement pending":"Payment settled",desc:p.agent+" · "+p.merchant+" · "+usd(p.amount),time:p.time,status:p.status})),{id:"EV-001",title:"Workspace demo initialized",desc:"OnCredSync local prototype started",time:"Today",status:"Settled" as const}];
  return <div className="section-stack"><div className="panel audit-panel"><div className="panel-heading"><div><div className="panel-title">Workspace activity</div><div className="panel-subtitle">Recent events in the local demo session</div></div><span className="demo-badge">NOT ON-CHAIN</span></div><div className="timeline">{events.map((e,i)=><div className="timeline-item" key={e.id}><div className={"timeline-icon "+(e.status==="Rejected"?"timeline-rejected":e.status==="Pending"?"timeline-pending":"timeline-success")}>{e.status==="Rejected"?<ShieldAlert size={15}/>:e.status==="Pending"?<Clock3 size={15}/>:<Check size={15}/>}</div><div className="timeline-content"><strong>{e.title}</strong><span>{e.desc}</span><small>{e.id}</small></div><time>{e.time}</time></div>)}</div></div><div className="subtle-disclaimer"><Activity size={15}/> This log is client-side demo history and is cleared when the app reloads.</div></div>;
}

function SettingsPage({onNotify}:{onNotify:(s:string)=>void}) {
  const [workspace,setWorkspace]=useState("Vikas Labs");
  const [network,setNetwork]=useState("Base Sepolia");
  const [alerts,setAlerts]=useState(true);
  const [compact,setCompact]=useState(false);
  return <div className="settings-grid"><section className="panel settings-panel"><div className="panel-heading"><div><div className="panel-title">Workspace preferences</div><div className="panel-subtitle">Personalize your demo environment.</div></div></div><label className="settings-field">Workspace name<input value={workspace} onChange={e=>setWorkspace(e.target.value)}/></label><label className="settings-field">Preferred blockchain network<select value={network} onChange={e=>setNetwork(e.target.value)}><option>Base Sepolia</option><option>Local Anvil</option><option>Ethereum Sepolia</option></select></label><div className="settings-toggle"><div><strong>Security notifications</strong><span>Show in-app alerts for demo policy events.</span></div><button className={"toggle "+(alerts?"toggle-on":"")} aria-pressed={alerts} onClick={()=>setAlerts(!alerts)}><i/></button></div><div className="settings-toggle"><div><strong>Compact tables</strong><span>Preference placeholder for dense data views.</span></div><button className={"toggle "+(compact?"toggle-on":"")} aria-pressed={compact} onClick={()=>setCompact(!compact)}><i/></button></div><button className="button button-primary" onClick={()=>onNotify("Preferences saved for this session only")}>Save preferences <ArrowRight size={14}/></button></section><section className="panel settings-panel"><div className="panel-heading"><div><div className="panel-title">Infrastructure status</div><div className="panel-subtitle">Integration connection overview.</div></div><div className="safeguard-icon"><Network size={18}/></div></div>{[{name:"React frontend",state:"Running locally",ok:true},{name:"Rust API backend",state:"Not connected",ok:false},{name:"PostgreSQL database",state:"Not connected",ok:false},{name:"Smart contracts",state:"Not deployed",ok:false},{name:"x402 facilitator",state:"Not configured",ok:false}].map(x=><div className="infra-row" key={x.name}><span className={"infra-dot "+(x.ok?"infra-ok":"")}/><div><strong>{x.name}</strong><span>{x.state}</span></div><span className={"infra-label "+(x.ok?"infra-live":"")}>{x.ok?"LIVE":"PENDING"}</span></div>)}<div className="notice-box settings-notice"><AlertTriangle size={16}/><span>Do not use this frontend for real funds or real agent authorization until the backend and on-chain policy contracts are implemented and audited.</span></div></section></div>;
}

function EmptyState({title,text}:{title:string;text:string}) {return <div className="empty-state"><div className="empty-icon"><Search size={22}/></div><strong>{title}</strong><span>{text}</span></div>;}
function Modal({title,subtitle,children,onClose,wide=false}:{title:string;subtitle:string;children:React.ReactNode;onClose:()=>void;wide?:boolean}) {return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={"modal "+(wide?"modal-wide":"")} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18}/></button></div>{children}</section></div>;}
