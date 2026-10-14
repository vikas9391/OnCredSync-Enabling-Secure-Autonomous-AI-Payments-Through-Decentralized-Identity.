import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { authApi, type AuthUser, type UserRole } from "./api";
import App from "./App";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"profile" | "users" | null>(null);
  const [fullName, setFullName] = useState("");
  const [users, setUsers] = useState<AuthUser[]>([]);
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
    try { setUsers(await authApi.users()); } catch (e) { setNotice(e instanceof Error ? e.message : "Could not load users."); }
  };
  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    try { const updated = await authApi.updateProfile(fullName); setUser(updated); setNotice("Profile saved."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Profile update failed."); }
  };
  const addUser = async (e: FormEvent) => {
    e.preventDefault(); setNotice("");
    try {
      const created = await authApi.createUser({ full_name: newName, email: newEmail, password: newPassword, role: newRole });
      setUsers(current => [created, ...current]); setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("viewer"); setNotice("Account created. Share credentials securely and require the user to change their password in a future release.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not create user."); }
  };
  const changeUser = async (id: string, body: { role?: UserRole; status?: "active" | "disabled" }) => {
    try { const updated = await authApi.updateUser(id, body); setUsers(current => current.map(u => u.id === id ? updated : u)); setNotice("User updated."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Could not update user."); }
  };

  if (loading) return <div className="auth-loading">Loading secure session…</div>;
  if (!user) return <div className="auth-screen"><div className="auth-glow auth-glow-a"/><div className="auth-glow auth-glow-b"/><div className="auth-card"><div className="auth-brand"><span className="auth-brand-mark"><ShieldCheck size={23}/></span><span>oncred<span>sync</span></span><small>SECURE ACCESS</small></div><div className="auth-eyebrow">AUTONOMOUS PAYMENTS · CONTROL PLANE</div><h1>Welcome back.</h1><p className="auth-subtitle">Sign in to manage AI agent identities, spending policies, and payment activity.</p><form onSubmit={signIn} className="auth-form"><label>Email address<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password"/></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"} <LockKeyhole size={16}/></button></form><div className="auth-foot"><LockKeyhole size={13}/> Protected by role-based API access <span>·</span> ETH demo mode</div><p className="auth-help">Accounts are provisioned by an administrator. No public sign-up or shared demo password.</p></div></div>;

  return <><div className="auth-session-bar"><div className="auth-session-brand"><span className="auth-mini-mark"><ShieldCheck size={17}/></span>OnCredSync <span className="auth-session-divider">/</span><span className="auth-session-role">{roles.find(r => r.value === user.role)?.label ?? user.role}</span></div><div className="auth-session-actions"><span className="auth-session-user">{user.full_name}</span><button onClick={() => {setPanel("profile");setFullName(user.full_name);setNotice("");}}><UserRound size={15}/> Profile</button>{user.role === "super_admin" && <button onClick={openUsers}><Users size={15}/> User management</button>}<button onClick={signOut}><LogOut size={15}/> Sign out</button></div></div><App/>{panel && <div className="auth-panel-backdrop" onClick={() => setPanel(null)}><section className="auth-panel" onClick={e => e.stopPropagation()}><header><div><span className="auth-eyebrow">ACCOUNT CONTROL</span><h2>{panel === "profile" ? "Your profile" : "User management"}</h2></div><button className="auth-icon-button" onClick={() => setPanel(null)} aria-label="Close"><X size={19}/></button></header>{notice && <div className="auth-notice">{notice}</div>}{panel === "profile" ? <form className="auth-form" onSubmit={saveProfile}><label>Full name<input required maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)}/></label><label>Email<input value={user.email} disabled/></label><label>Role<input value={roles.find(r => r.value === user.role)?.label ?? user.role} disabled/></label><button className="auth-submit"><Save size={16}/> Save profile</button><p className="auth-muted">Password changes and recovery are not yet enabled.</p></form> : <><form className="auth-user-create" onSubmit={addUser}><h3>Create account</h3><label>Full name<input required value={newName} onChange={e => setNewName(e.target.value)} maxLength={120}/></label><label>Email<input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}/></label><label>Temporary password<input required type="password" minLength={12} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 12 characters"/></label><label>Role<select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)}>{roles.filter(r => user.role === "super_admin" || r.value !== "super_admin").map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label><button className="auth-submit"><Plus size={16}/> Create user</button></form><div className="auth-user-list"><div className="auth-user-list-head"><h3>Platform accounts</h3><button onClick={openUsers} title="Refresh users"><RefreshCw size={15}/></button></div>{users.map(u => <div className="auth-user-row" key={u.id}><div className="auth-user-avatar">{u.full_name.split(/\s+/).map(x => x[0]).join("").slice(0,2).toUpperCase()}</div><div className="auth-user-info"><strong>{u.full_name}</strong><span>{u.email} · {u.status}</span><select aria-label={"Role for "+u.email} value={u.role} disabled={u.id === user.id || (user.role !== "super_admin" && u.role === "super_admin")} onChange={e => changeUser(u.id,{role:e.target.value as UserRole})}>{roles.filter(r => user.role === "super_admin" || r.value !== "super_admin").map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div><button className="auth-status-button" disabled={u.id === user.id} onClick={() => changeUser(u.id,{status:u.status === "active" ? "disabled" : "active"})}>{u.status === "active" ? "Disable" : "Enable"}</button></div>)}</div></>}</section></div>}</>;
}
