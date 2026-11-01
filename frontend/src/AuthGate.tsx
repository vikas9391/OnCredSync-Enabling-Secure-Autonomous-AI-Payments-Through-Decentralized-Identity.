import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { authApi, clearAuthSession, saveAuthSession, type AuthUser, type ApiWorkspace, type UserRole } from "./api";
import App from "./App";
import LandingPage from "./LandingPage";
import { ShieldCheck, LockKeyhole, LogOut, UserRound, Users, X, Save, Plus, RefreshCw, Eye, EyeOff } from "lucide-react";

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
  const [authView, setAuthView] = useState<"landing" | "login" | "register">("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerWorkspace, setRegisterWorkspace] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>("viewer");
  const [notice, setNotice] = useState("");
  const [platformLoading, setPlatformLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    let token: string | null = null;
    try { token = sessionStorage.getItem("oncredsync_token"); } catch { token = null; }
    if (!token) { setLoading(false); return; }
    authApi.me().then(u => { setUser(u); setFullName(u.full_name); })
      .catch(() => clearAuthSession())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user?.role !== "super_admin") return;
    let cancelled = false;
    setPlatformLoading(true);
    Promise.all([authApi.users(), authApi.workspaces()])
      .then(([nextUsers, nextWorkspaces]) => {
        if (cancelled) return;
        setUsers(nextUsers);
        setWorkspaces(nextWorkspaces);
      })
      .catch(e => {
        if (!cancelled) setNotice(e instanceof Error ? e.message : "Could not load platform data.");
      })
      .finally(() => { if (!cancelled) setPlatformLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

  const signIn = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const result = await authApi.login(email, password);
      saveAuthSession(result.access_token);
      setUser(result.user); setFullName(result.user.full_name); setPassword("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to sign in."); }
    finally { setBusy(false); }
  };
  const signUp = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const result = await authApi.register({ full_name: registerName, email, password, workspace_name: registerWorkspace });
      saveAuthSession(result.access_token);
      setUser(result.user); setFullName(result.user.full_name); setPassword("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create your account."); }
    finally { setBusy(false); }
  };
  const signOut = () => { clearAuthSession(); setUser(null); setPanel(null); setPassword(""); };
  const refreshPlatform = async () => {
    setPlatformLoading(true);
    try {
      const [nextUsers, nextWorkspaces] = await Promise.all([authApi.users(), authApi.workspaces()]);
      setUsers(nextUsers); setWorkspaces(nextWorkspaces); setNotice("");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not refresh platform data."); }
    finally { setPlatformLoading(false); }
  };
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
      const created = await authApi.createUser({ full_name: newName, email: newEmail, password: newPassword, role: newRole, ...(user?.role === "super_admin" && newRole !== "super_admin" ? { workspace_id: selectedWorkspace } : {}) });
      setUsers(current => [created, ...current]); setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("viewer"); setNotice("Account created for " + (workspaces.find(w => w.id === created.workspace_id)?.name ?? "the selected workspace") + ". Share credentials securely.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not create user."); }
  };
  const changeUser = async (id: string, body: { role?: UserRole; status?: "active" | "disabled" }) => {
    try { const updated = await authApi.updateUser(id, body); setUsers(current => current.map(u => u.id === id ? updated : u)); setNotice("User updated."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Could not update user."); }
  };

  if (loading) return <div className="auth-loading">Loading secure session…</div>;
  if (!user && authView === "landing") return <LandingPage onSignIn={() => setAuthView("login")} />;
  if (!user) return <div className="auth-screen"><div className="auth-glow auth-glow-a"/><div className="auth-glow auth-glow-b"/><div className="auth-card"><button type="button" className="auth-back-home" onClick={() => setAuthView("landing")}>← Back to home</button><div className="auth-brand"><span className="auth-brand-mark"><ShieldCheck size={23}/></span><span>oncred<span>sync</span></span><small>SECURE ACCESS</small></div><div className="auth-eyebrow">AUTONOMOUS PAYMENTS · CONTROL PLANE</div><h1>{authView === "register" ? "Create your account." : "Welcome back."}</h1><p className="auth-subtitle">{authView === "register" ? "Create your workspace and start managing AI agent payments." : "Sign in to manage AI agent identities, spending policies, and payment activity."}</p><form onSubmit={authView === "register" ? signUp : signIn} className="auth-form">{authView === "register" && <><label>Full name<input required maxLength={120} autoComplete="name" value={registerName} onChange={e => setRegisterName(e.target.value)} placeholder="Your full name"/></label><label>Workspace name<input required maxLength={120} value={registerWorkspace} onChange={e => setRegisterWorkspace(e.target.value)} placeholder="Your company or team"/></label></>}<label>Email address<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"/></label><label>Password<div style={{ position: "relative" }}><input type={authView === "register" ? (showRegisterPassword ? "text" : "password") : (showPassword ? "text" : "password")} autoComplete={authView === "register" ? "new-password" : "current-password"} required minLength={authView === "register" ? 12 : undefined} value={password} onChange={e => setPassword(e.target.value)} placeholder={authView === "register" ? "At least 12 characters" : "Your password"} style={{ paddingRight: 48 }}/><button type="button" onClick={() => authView === "register" ? setShowRegisterPassword(value => !value) : setShowPassword(value => !value)} aria-label={(authView === "register" ? showRegisterPassword : showPassword) ? "Hide password" : "Show password"} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "grid", placeItems: "center", border: 0, background: "transparent", color: "#64748b", cursor: "pointer", padding: 6 }}>{(authView === "register" ? showRegisterPassword : showPassword) ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? (authView === "register" ? "Creating account…" : "Signing in…") : (authView === "register" ? "Create account" : "Sign in securely")} <LockKeyhole size={16}/></button></form>{authView === "register" ? <p className="auth-help">Already registered? <button type="button" onClick={() => {setAuthView("login");setError("");}}>Sign in</button></p> : <p className="auth-help">New to OnCredSync? <button type="button" onClick={() => {setAuthView("register");setError("");}}>Create an account</button></p>}{import.meta.env.DEV && <div className="auth-help" style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#eff6ff" }}><strong>Local development Super Admin</strong><br/>Email: admin@oncredsync.local<br/>Password: OnCredSync-Local-Admin-2026!<br/><span>Local testing only. Do not deploy this demo credential.</span></div>}<div className="auth-foot"><LockKeyhole size={13}/> Protected by role-based API access <span>·</span> ETH demo mode</div></div></div>;

  return <><div className="auth-session-bar"><div className="auth-session-brand"><span className="auth-mini-mark"><ShieldCheck size={17}/></span>OnCredSync <span className="auth-session-divider">/</span><span className="auth-session-role">{roles.find(r => r.value === user.role)?.label ?? user.role}</span></div><div className="auth-session-actions"><span className="auth-session-user">{user.full_name}</span><button onClick={() => {setPanel("profile");setFullName(user.full_name);setNotice("");}}><UserRound size={15}/> Profile</button>{["super_admin", "workspace_admin"].includes(user.role) && <button onClick={openUsers}><Users size={15}/> User management</button>}<button onClick={signOut}><LogOut size={15}/> Sign out</button></div></div>{user.role === "super_admin" && !user.workspace_id ? <><style>{"\n.platform-dashboard{max-width:1240px;margin:0 auto;padding:54px 40px 64px;color:#172033}.platform-dashboard-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:30px}.platform-dashboard-heading h1{font-size:34px;letter-spacing:-1.2px;margin:10px 0}.platform-dashboard-heading p,.platform-users-heading p{color:#64748b;margin:0}.platform-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:24px}.platform-stat-card,.platform-users-card{background:#fff;border:1px solid #e5eaf2;border-radius:18px;box-shadow:0 8px 28px rgba(15,23,42,.04)}.platform-stat-card{padding:22px}.platform-stat-card span,.platform-stat-card small{display:block;color:#64748b}.platform-stat-card strong{display:block;font-size:32px;margin:12px 0 5px;letter-spacing:-1px}.platform-users-card{padding:24px}.platform-users-heading{display:flex;justify-content:space-between;align-items:center}.platform-users-heading h2{font-size:20px;margin:0 0 6px}.platform-users-toolbar{display:flex;align-items:center;gap:16px;margin:22px 0 12px}.platform-users-toolbar input{flex:1;min-width:0;border:1px solid #dbe2ec;border-radius:10px;padding:12px 14px;font:inherit}.platform-users-toolbar span{font-size:13px;color:#64748b;white-space:nowrap}.platform-users-table-wrap{overflow-x:auto}.platform-users-table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}.platform-users-table th{padding:12px 14px;color:#64748b;font-weight:600;background:#f8fafc}.platform-users-table td{padding:15px 14px;border-top:1px solid #edf0f5;white-space:nowrap}.platform-users-table td strong,.platform-users-table td small{display:block}.platform-users-table td small{color:#64748b;margin-top:4px}.platform-status{display:inline-flex;padding:5px 9px;border-radius:20px;font-size:12px;font-weight:600;text-transform:capitalize}.platform-status.is-active{background:#eaf8ef;color:#16703a}.platform-status.is-disabled{background:#fff1f0;color:#b42318}.platform-empty{text-align:center;color:#64748b;padding:30px!important}.platform-table-foot{color:#64748b;font-size:12px}.platform-security-note{display:flex;align-items:center;gap:9px;color:#64748b;font-size:13px;margin-top:20px}.platform-security-note svg{flex:none;color:#2563eb}@media(max-width:800px){.platform-dashboard{padding:30px 18px}.platform-dashboard-heading{align-items:flex-start;flex-direction:column}.platform-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.platform-stat-grid{grid-template-columns:1fr 1fr;gap:10px}.platform-stat-card{padding:16px}.platform-stat-card strong{font-size:26px}.platform-users-card{padding:16px}}\n"}</style><main className="platform-dashboard">
    <div className="platform-dashboard-heading">
      <div><span className="auth-eyebrow">PLATFORM CONTROL PLANE</span><h1>Super Admin Dashboard</h1><p>Monitor platform accounts, workspace access, and account status from one place.</p></div>
      <button className="auth-submit" onClick={openUsers}><Users size={16}/> Manage users & workspaces</button>
    </div>
    {notice && <div className="auth-notice">{notice}</div>}
    <div className="platform-stat-grid">
      <article className="platform-stat-card"><span>Total users</span><strong>{users.length}</strong><small>All platform accounts</small></article>
      <article className="platform-stat-card"><span>Active users</span><strong>{users.filter(u => u.status === "active").length}</strong><small>Can sign in</small></article>
      <article className="platform-stat-card"><span>Disabled users</span><strong>{users.filter(u => u.status === "disabled").length}</strong><small>Access suspended</small></article>
      <article className="platform-stat-card"><span>Workspaces</span><strong>{workspaces.length}</strong><small>Isolated tenant spaces</small></article>
    </div>
    <section className="platform-users-card">
      <div className="platform-users-heading"><div><h2>Platform users</h2><p>Review user identities, roles, workspace membership, and access status.</p></div><button className="auth-icon-button" title="Refresh platform data" onClick={refreshPlatform} disabled={platformLoading}><RefreshCw size={17}/></button></div>
      <div className="platform-users-toolbar"><input aria-label="Search platform users" placeholder="Search name, email, role, or workspace…" value={userSearch} onChange={e => setUserSearch(e.target.value)}/><span>{platformLoading ? "Refreshing…" : users.length + " accounts"}</span></div>
      <div className="platform-users-table-wrap"><table className="platform-users-table"><thead><tr><th>User</th><th>Role</th><th>Workspace</th><th>Status</th><th>Joined</th></tr></thead><tbody>
        {users.filter(u => { const q=userSearch.trim().toLowerCase(); const workspace=workspaces.find(w=>w.id===u.workspace_id)?.name ?? "Platform"; return !q || [u.full_name,u.email,u.role,workspace,u.status].some(v=>v.toLowerCase().includes(q)); }).slice(0,12).map(u => <tr key={u.id}><td><strong>{u.full_name}</strong><small>{u.email}</small></td><td>{roles.find(r=>r.value===u.role)?.label ?? u.role}</td><td>{workspaces.find(w=>w.id===u.workspace_id)?.name ?? (u.role==="super_admin" ? "Platform" : "—")}</td><td><span className={"platform-status "+(u.status==="active" ? "is-active" : "is-disabled")}>{u.status}</span></td><td>{new Date(u.created_at).toLocaleDateString()}</td></tr>)}
        {!platformLoading && users.length===0 && <tr><td colSpan={5} className="platform-empty">No user accounts were returned.</td></tr>}
      </tbody></table></div>
      {users.length>12 && <p className="platform-table-foot">Showing 12 of {users.length} accounts. Open user management to review and manage every account.</p>}
    </section>
    <p className="platform-security-note"><ShieldCheck size={16}/> Platform administration is separate from tenant business data. Super Admin can manage identities and workspaces, but cannot browse workspace payment or agent records.</p>
  </main></> : <App currentUser={user}/>}{panel && <div className="auth-panel-backdrop" onClick={() => setPanel(null)}><section className="auth-panel" onClick={e => e.stopPropagation()}><header><div><span className="auth-eyebrow">ACCOUNT CONTROL</span><h2>{panel === "profile" ? "Your profile" : "User management"}</h2></div><button className="auth-icon-button" onClick={() => setPanel(null)} aria-label="Close"><X size={19}/></button></header>{notice && <div className="auth-notice">{notice}</div>}{panel === "profile" ? <form className="auth-form" onSubmit={saveProfile}><label>Full name<input required maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)}/></label><label>Email<input value={user.email} disabled/></label><label>Role<input value={roles.find(r => r.value === user.role)?.label ?? user.role} disabled/></label><button className="auth-submit"><Save size={16}/> Save profile</button><p className="auth-muted">Password changes and recovery are not yet enabled.</p></form> : <>{user.role === "super_admin" && <form className="auth-user-create" onSubmit={addWorkspace}><h3>Create workspace</h3><label>Workspace name<input required maxLength={120} value={newWorkspaceName} onChange={e => setNewWorkspaceName(e.target.value)} placeholder="Example: Acme Finance"/></label><button className="auth-submit"><Plus size={16}/> Create workspace</button></form>}<form className="auth-user-create" onSubmit={addUser}><h3>Create account</h3><label>Full name<input required value={newName} onChange={e => setNewName(e.target.value)} maxLength={120}/></label><label>Email<input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}/></label><label>Temporary password<div style={{ position: "relative" }}><input required type={showNewPassword ? "text" : "password"} minLength={12} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 12 characters" style={{ paddingRight: 48 }}/><button type="button" onClick={() => setShowNewPassword(value => !value)} aria-label={showNewPassword ? "Hide password" : "Show password"} aria-pressed={showNewPassword} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "grid", placeItems: "center", border: 0, background: "transparent", color: "#64748b", cursor: "pointer", padding: 6 }}>{showNewPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></label>{user.role === "super_admin" && newRole !== "super_admin" && <label>Workspace<select required value={selectedWorkspace} onChange={e => setSelectedWorkspace(e.target.value)}>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}<label>Role<select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)}>{roles.filter(r => user.role === "super_admin" || r.value !== "super_admin").map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label><button className="auth-submit"><Plus size={16}/> Create user</button></form><div className="auth-role-guide"><h3>Role permissions</h3><div className="auth-role-guide-grid"><div><strong>Super Admin</strong><span>Create workspaces, provision accounts, assign roles, and manage platform access. Tenant records are not globally visible.</span></div><div><strong>Workspace Admin</strong><span>Full business access and account management within the assigned workspace only.</span></div><div><strong>Finance / Payments Manager</strong><span>Read agents, policies, payments and audit events; submit simulated payment requests.</span></div><div><strong>Developer / Agent Operator</strong><span>Read business data; create agents and policies, submit simulated payments, and change agent status.</span></div><div><strong>Read-only Viewer</strong><span>GET-only access to business endpoints. Cannot create or change records.</span></div></div><p className="auth-muted">Permissions are checked by the backend. Payment requests remain simulated and do not transfer ETH.</p></div><div className="auth-user-list"><div className="auth-user-list-head"><h3>{user.role === "super_admin" ? "All platform accounts" : "Workspace accounts"}</h3><button onClick={openUsers} title="Refresh users"><RefreshCw size={15}/></button></div>{users.map(u => <div className="auth-user-row" key={u.id}><div className="auth-user-avatar">{u.full_name.split(/\s+/).map(x => x[0]).join("").slice(0,2).toUpperCase()}</div><div className="auth-user-info"><strong>{u.full_name}</strong><span>{u.email} · {u.status} · {workspaces.find(w => w.id === u.workspace_id)?.name ?? (u.role === "super_admin" ? "Platform" : "Workspace")}</span><select aria-label={"Role for "+u.email} value={u.role} disabled={u.id === user.id || (user.role !== "super_admin" && u.role === "super_admin") || (user.role === "workspace_admin" && u.role === "workspace_admin")} onChange={e => changeUser(u.id,{role:e.target.value as UserRole})}>{roles.filter(r => user.role === "super_admin" || r.value !== "super_admin").map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div><button className="auth-status-button" disabled={u.id === user.id} onClick={() => changeUser(u.id,{status:u.status === "active" ? "disabled" : "active"})}>{u.status === "active" ? "Disable" : "Enable"}</button></div>)}</div></>}</section></div>}</>;
}
