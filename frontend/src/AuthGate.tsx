import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { authApi, type AuthUser, type ApiWorkspace, type UserRole } from "./api";
import App from "./App";
import LandingPage from "./LandingPage";
import { ShieldCheck, LockKeyhole, LogOut, UserRound, Users, X, Save, Plus, RefreshCw } from "lucide-react";

const roles: { value: UserRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "workspace_admin", label: "Workspace Admin" },
  { value: "finance_manager", label: "Finance / Payments Manager" },
  { value: "agent_operator", label: "Developer / Agent Operator" },
  { value: "viewer", label: "Read-only Viewer" },
];

export default function AuthGate() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState<"landing" | "login">("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"profile" | "users" | null>(null);
  const [fullName, setFullName] = useState("");
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [workspaces, setWorkspaces] = useState<ApiWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("viewer");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!sessionStorage.getItem("oncredsync_token")) { setLoading(false); return; }
    authApi.me().then(u => { setUser(u); setFullName(u.full_name); }).catch(() => sessionStorage.removeItem("oncredsync_token")).finally(() => setLoading(false));
  }, []);

  const signIn = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const result = await authApi.login(email, password);
      sessionStorage.setItem("oncredsync_token", result.access_token);
      setUser(result.user); setFullName(result.user.full_name); setPassword("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to sign in."); }
    finally { setBusy(false); }
  };
  const signOut = () => { sessionStorage.removeItem("oncredsync_token"); setUser(null); setPanel(null); setPassword(""); };
  const openUsers = async () => {
    setPanel("users"); setNotice("");
    try {
      const [nextUsers, nextWorkspaces] = await Promise.all([authApi.users(), authApi.workspaces()]);
      setUsers(nextUsers); setWorkspaces(nextWorkspaces);
      setSelectedWorkspace(current => current || nextWorkspaces[0]?.id || "");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not load workspace accounts."); }
  };
  const addWorkspace = async (e: FormEvent) => {
    e.preventDefault(); setNotice("");
    try {
      const created = await authApi.createWorkspace(newWorkspaceName);
      setWorkspaces(current => [created, ...current]); setSelectedWorkspace(created.id); setNewWorkspaceName("");
      setNotice("Workspace created. Create its first Workspace Admin account below.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not create workspace."); }
  };
  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    try { const updated = await authApi.updateProfile(fullName); setUser(updated); setNotice("Profile saved."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Profile update failed."); }
  };
  const addUser = async (e: FormEvent) => {
    e.preventDefault(); setNotice("");
    try {
      const created = await authApi.createUser({ full_name: newName, email: newEmail, password: newPassword, role: newRole, ...(user.role === "super_admin" && newRole !== "super_admin" ? { workspace_id: selectedWorkspace } : {}) });
      setUsers(current => [created, ...current]); setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("viewer"); setNotice("Account created for " + (workspaces.find(w => w.id === created.workspace_id)?.name ?? "the selected workspace") + ". Share credentials securely.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not create user."); }
  };
  const changeUser = async (id: string, body: { role?: UserRole; status?: "active" | "disabled" }) => {
    try { const updated = await authApi.updateUser(id, body); setUsers(current => current.map(u => u.id === id ? updated : u)); setNotice("User updated."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Could not update user."); }
  };

  if (loading) return <div className="auth-loading">Loading secure session…</div>;
  if (!user && authView === "landing") return <LandingPage onSignIn={() => setAuthView("login")} />;
  if (!user) return <div className="auth-screen"><div className="auth-glow auth-glow-a"/><div className="auth-glow auth-glow-b"/><div className="auth-card"><button type="button" className="auth-back-home" onClick={() => setAuthView("landing")}>← Back to home</button><div className="auth-brand"><span className="auth-brand-mark"><ShieldCheck size={23}/></span><span>oncred<span>sync</span></span><small>SECURE ACCESS</small></div><div className="auth-eyebrow">AUTONOMOUS PAYMENTS · CONTROL PLANE</div><h1>Welcome back.</h1><p className="auth-subtitle">Sign in to manage AI agent identities, spending policies, and payment activity.</p><form onSubmit={signIn} className="auth-form"><label>Email address<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password"/></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"} <LockKeyhole size={16}/></button></form><div className="auth-foot"><LockKeyhole size={13}/> Protected by role-based API access <span>·</span> ETH demo mode</div><p className="auth-help">Accounts are provisioned by an administrator. No public sign-up or shared demo password.</p></div></div>;

  return <><div className="auth-session-bar"><div className="auth-session-brand"><span className="auth-mini-mark"><ShieldCheck size={17}/></span>OnCredSync <span className="auth-session-divider">/</span><span className="auth-session-role">{roles.find(r => r.value === user.role)?.label ?? user.role}</span></div><div className="auth-session-actions"><span className="auth-session-user">{user.full_name}</span><button onClick={() => {setPanel("profile");setFullName(user.full_name);setNotice("");}}><UserRound size={15}/> Profile</button>{["super_admin", "workspace_admin"].includes(user.role) && <button onClick={openUsers}><Users size={15}/> User management</button>}<button onClick={signOut}><LogOut size={15}/> Sign out</button></div></div>{user.role === "super_admin" && !user.workspace_id ? <div className="platform-home"><span className="auth-eyebrow">PLATFORM CONTROL PLANE</span><h1>Workspace isolation is active.</h1><p>Create a workspace, then provision a Workspace Admin account for its team. Platform administrators do not automatically see tenant business records.</p><button className="auth-submit" onClick={openUsers}><Users size={16}/> Manage workspaces and accounts</button></div> : <App currentUser={user}/>}{panel && <div className="auth-panel-backdrop" onClick={() => setPanel(null)}><section className="auth-panel" onClick={e => e.stopPropagation()}><header><div><span className="auth-eyebrow">ACCOUNT CONTROL</span><h2>{panel === "profile" ? "Your profile" : "User management"}</h2></div><button className="auth-icon-button" onClick={() => setPanel(null)} aria-label="Close"><X size={19}/></button></header>{notice && <div className="auth-notice">{notice}</div>}{panel === "profile" ? <form className="auth-form" onSubmit={saveProfile}><label>Full name<input required maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)}/></label><label>Email<input value={user.email} disabled/></label><label>Role<input value={roles.find(r => r.value === user.role)?.label ?? user.role} disabled/></label><button className="auth-submit"><Save size={16}/> Save profile</button><p className="auth-muted">Password changes and recovery are not yet enabled.</p></form> : <>{user.role === "super_admin" && <form className="auth-user-create" onSubmit={addWorkspace}><h3>Create workspace</h3><label>Workspace name<input required maxLength={120} value={newWorkspaceName} onChange={e => setNewWorkspaceName(e.target.value)} placeholder="Example: Acme Finance"/></label><button className="auth-submit"><Plus size={16}/> Create workspace</button></form>}<form className="auth-user-create" onSubmit={addUser}><h3>Create account</h3><label>Full name<input required value={newName} onChange={e => setNewName(e.target.value)} maxLength={120}/></label><label>Email<input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}/></label><label>Temporary password<input required type="password" minLength={12} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 12 characters"/></label>{user.role === "super_admin" && newRole !== "super_admin" && <label>Workspace<select required value={selectedWorkspace} onChange={e => setSelectedWorkspace(e.target.value)}>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}<label>Role<select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)}>{roles.filter(r => user.role === "super_admin" || r.value !== "super_admin").map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label><button className="auth-submit"><Plus size={16}/> Create user</button></form><div className="auth-role-guide"><h3>Role permissions</h3><div className="auth-role-guide-grid"><div><strong>Super Admin</strong><span>Create workspaces, provision accounts, assign roles, and manage platform access. Tenant records are not globally visible.</span></div><div><strong>Workspace Admin</strong><span>Full business access and account management within the assigned workspace only.</span></div><div><strong>Finance / Payments Manager</strong><span>Read agents, policies, payments and audit events; submit simulated payment requests.</span></div><div><strong>Developer / Agent Operator</strong><span>Read business data; create agents and policies, submit simulated payments, and change agent status.</span></div><div><strong>Read-only Viewer</strong><span>GET-only access to business endpoints. Cannot create or change records.</span></div></div><p className="auth-muted">Permissions are checked by the backend. Payment requests remain simulated and do not transfer ETH.</p></div><div className="auth-user-list"><div className="auth-user-list-head"><h3>{user.role === "super_admin" ? "All platform accounts" : "Workspace accounts"}</h3><button onClick={openUsers} title="Refresh users"><RefreshCw size={15}/></button></div>{users.map(u => <div className="auth-user-row" key={u.id}><div className="auth-user-avatar">{u.full_name.split(/\s+/).map(x => x[0]).join("").slice(0,2).toUpperCase()}</div><div className="auth-user-info"><strong>{u.full_name}</strong><span>{u.email} · {u.status} · {workspaces.find(w => w.id === u.workspace_id)?.name ?? (u.role === "super_admin" ? "Platform" : "Workspace")}</span><select aria-label={"Role for "+u.email} value={u.role} disabled={u.id === user.id || (user.role !== "super_admin" && u.role === "super_admin")} onChange={e => changeUser(u.id,{role:e.target.value as UserRole})}>{roles.filter(r => user.role === "super_admin" || r.value !== "super_admin").map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div><button className="auth-status-button" disabled={u.id === user.id} onClick={() => changeUser(u.id,{status:u.status === "active" ? "disabled" : "active"})}>{u.status === "active" ? "Disable" : "Enable"}</button></div>)}</div></>}</section></div>}</>;
}
