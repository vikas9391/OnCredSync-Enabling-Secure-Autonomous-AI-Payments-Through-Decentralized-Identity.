import { ArrowRight, ArrowUpRight, Activity, Check, ChevronRight, Fingerprint, LockKeyhole, Shield, ShieldCheck, WalletCards } from "lucide-react";

export default function LandingPage({ onSignIn }: { onSignIn: () => void }) {
  return <div className="landing-page">
    <div className="landing-ambient landing-ambient-one"/><div className="landing-ambient landing-ambient-two"/>
    <header className="landing-nav">
      <a href="#home" className="landing-logo"><span className="landing-logo-mark"><ShieldCheck size={20}/></span><span>oncred<span>sync</span></span><small>CONTROL PLANE</small></a>
      <nav><a href="#platform">Platform</a><a href="#how-it-works">How it works</a><a href="#security">Security</a></nav>
      <div className="landing-nav-actions"><button className="landing-signin" onClick={onSignIn}>Sign in</button><button className="landing-nav-cta" onClick={onSignIn}>Open workspace <ArrowUpRight size={15}/></button></div>
    </header>
    <main id="home">
      <section className="landing-hero">
        <div className="landing-hero-copy"><div className="landing-kicker"><span className="landing-kicker-dot"/> TRUST LAYER FOR AUTONOMOUS PAYMENTS</div>
          <h1>Give AI agents<br/>the freedom to act.<br/><span>Keep control.</span></h1>
          <p className="landing-lead">One control plane for agent identity, programmable spending policies, and auditable payment decisions.</p>
          <div className="landing-hero-actions"><button className="landing-primary" onClick={onSignIn}>Enter your workspace <ArrowRight size={17}/></button><a className="landing-secondary" href="#platform">Explore the platform <ChevronRight size={16}/></a></div>
          <div className="landing-proof"><div className="landing-proof-avatars"><span><Fingerprint size={13}/></span><span><Shield size={13}/></span><span><Activity size={13}/></span></div><div><strong>Identity. Policy. Accountability.</strong><small>Designed for AI-native payment workflows.</small></div></div>
        </div>
        <div className="landing-visual"><div className="landing-orbit landing-orbit-a"/><div className="landing-orbit landing-orbit-b"/>
          <div className="landing-visual-label"><span className="landing-live-dot"/> POLICY ENGINE <span>·</span> DEMO</div>
          <div className="landing-core"><div className="landing-core-icon"><ShieldCheck size={35}/></div><strong>OnCredSync</strong><small>Autonomous payment control</small><div className="landing-core-line"/></div>
          <div className="landing-node landing-node-identity"><span className="landing-node-icon"><Fingerprint size={18}/></span><div><strong>Agent identity</strong><small>Identity reference</small></div><Check size={15}/></div>
          <div className="landing-node landing-node-policy"><span className="landing-node-icon"><Shield size={18}/></span><div><strong>Spending policy</strong><small>Limits & allowlists</small></div><Check size={15}/></div>
          <div className="landing-node landing-node-payment"><span className="landing-node-icon"><WalletCards size={18}/></span><div><strong>Payment decision</strong><small>Recorded for review</small></div><Activity size={15}/></div>
          <div className="landing-visual-foot"><span className="landing-foot-dot"/> Rules evaluated before a demo request is recorded</div>
        </div>
      </section>
      <section className="landing-stats"><div><strong>01</strong><span>Identity-aware agents</span></div><div><strong>02</strong><span>Policy-based guardrails</span></div><div><strong>03</strong><span>Auditable decisions</span></div><div><strong>ETH</strong><span>Demo payment workflow</span></div></section>
      <section className="landing-platform" id="platform"><div className="landing-section-head"><div className="landing-kicker">THE CONTROL PLANE</div><h2>Autonomy needs<br/><span>clear boundaries.</span></h2><p>Bring the key controls around autonomous payments into one place, so teams can inspect how agents are identified and how requests are evaluated.</p></div>
        <div className="landing-feature-grid">
          <article className="landing-feature"><span className="landing-feature-icon"><Fingerprint size={21}/></span><small>01 / IDENTITY</small><h3>Know your agents</h3><p>Manage agent identity references, wallet metadata, network labels, and operational status from a single registry.</p><a href="#how-it-works">Explore identity <ArrowUpRight size={14}/></a></article>
          <article className="landing-feature landing-feature-highlight"><span className="landing-feature-icon"><Shield size={21}/></span><small>02 / GOVERNANCE</small><h3>Set spending guardrails</h3><p>Define per-request and daily limits, merchant allowlists, and policy validity before requests are evaluated.</p><a href="#how-it-works">Explore policies <ArrowUpRight size={14}/></a></article>
          <article className="landing-feature"><span className="landing-feature-icon"><Activity size={21}/></span><small>03 / OBSERVABILITY</small><h3>Keep a clear record</h3><p>Review payment decisions and activity events to understand what was requested and how the demo policy responded.</p><a href="#security">Explore oversight <ArrowUpRight size={14}/></a></article>
        </div>
      </section>
      <section className="landing-how" id="how-it-works"><div><div className="landing-kicker">A CLEAR PATH TO CONTROL</div><h2>From agent intent<br/>to a <span>reviewable decision.</span></h2><p>OnCredSync brings the essential checks into a workflow your team can inspect. The current payment flow is a simulator—not a live transfer system.</p><button className="landing-primary" onClick={onSignIn}>Open the workspace <ArrowRight size={16}/></button></div>
        <div className="landing-steps"><div><span>01</span><div><strong>Register an agent</strong><p>Keep identity and operational status visible.</p></div><Fingerprint size={19}/></div><div><span>02</span><div><strong>Define the policy</strong><p>Set limits and approved merchants.</p></div><Shield size={19}/></div><div><span>03</span><div><strong>Evaluate a request</strong><p>Inspect the simulated outcome and audit trail.</p></div><Activity size={19}/></div></div>
      </section>
      <section className="landing-security" id="security"><div className="landing-security-icon"><LockKeyhole size={23}/></div><div><div className="landing-kicker">BUILT WITH GUARDRAILS IN MIND</div><h2>Access should be intentional.</h2><p>Authenticated sessions and role-based API checks help control access to workspace operations. Production deployment still requires tenant isolation, security review, and live-chain implementation before real funds are involved.</p></div><div className="landing-security-tags"><span><Check size={13}/> Role-aware access</span><span><Check size={13}/> Policy checks</span><span><Check size={13}/> Audit events</span></div></section>
      <section className="landing-bottom-cta"><div><div className="landing-kicker">YOUR CONTROL PLANE AWAITS</div><h2>Make agent payments<br/><span>more governable.</span></h2><p>Sign in to explore the OnCredSync workspace.</p></div><button className="landing-primary" onClick={onSignIn}>Sign in to OnCredSync <ArrowRight size={17}/></button></section>
    </main>
    <footer className="landing-footer"><a href="#home" className="landing-logo"><span className="landing-logo-mark"><ShieldCheck size={17}/></span><span>oncred<span>sync</span></span></a><span>© 2026 OnCredSync · Built for accountable autonomy</span><span className="landing-demo-note"><span className="landing-live-dot"/> ETH demo · No live transfers</span></footer>
  </div>;
}
