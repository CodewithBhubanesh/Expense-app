import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./home3d.css";

/* ---------- 3D coin / particle field drawn on a canvas ---------- */
function useCoinField(canvasRef) {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext("2d");
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const small = window.innerWidth < 768;
        const count = small ? 40 : 90;
        const colors = ["#7c6cff", "#27d3ff", "#ffcf5a", "#ffffff"];

        // x, y, z are in the range -1..1
        const parts = Array.from({ length: count }, (_, i) => ({
            x: Math.random() * 2 - 1,
            y: Math.random() * 2 - 1,
            z: Math.random() * 2 - 1,
            coin: i % 6 === 0,
            color: colors[i % colors.length],
            speed: 0.0004 + Math.random() * 0.0008,
        }));

        let w = 0;
        let h = 0;
        let dpr = 1;
        const pointer = { x: 0, y: 0 };
        const view = { rx: 0, ry: 0 };
        let raf = 0;

        const resize = () => {
            dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
            w = canvas.clientWidth;
            h = canvas.clientHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const draw = (t) => {
            ctx.clearRect(0, 0, w, h);
            const scroll = window.scrollY * 0.0007;
            view.ry += (pointer.x * 0.5 - view.ry) * 0.05;
            view.rx += (pointer.y * 0.3 - view.rx) * 0.05;
            const spin = t * 0.00008 + scroll + view.ry;
            const cosY = Math.cos(spin);
            const sinY = Math.sin(spin);
            const cosX = Math.cos(view.rx);
            const sinX = Math.sin(view.rx);
            const focal = 2.4;
            const scale = Math.min(w, h) * 0.9;

            const projected = parts.map((p) => {
                const x1 = p.x * cosY - p.z * sinY;
                const z1 = p.x * sinY + p.z * cosY;
                const y2 = p.y * cosX - z1 * sinX;
                const z2 = p.y * sinX + z1 * cosX;
                const s = focal / (focal + z2);
                return { p, sx: w / 2 + x1 * scale * s, sy: h / 2 + y2 * scale * s, s, z: z2 };
            });

            projected.sort((a, b) => b.z - a.z); // far first

            projected.forEach(({ p, sx, sy, s }) => {
                if (!reduced) {
                    p.y -= p.speed;
                    if (p.y < -1) p.y = 1;
                }
                ctx.globalAlpha = Math.max(0.15, Math.min(1, s - 0.3));
                if (p.coin) {
                    const r = 14 * s * (small ? 0.8 : 1.1);
                    const g = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, 1, sx, sy, r);
                    g.addColorStop(0, "#fff1b3");
                    g.addColorStop(0.5, "#ffcf5a");
                    g.addColorStop(1, "#c78d12");
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.ellipse(sx, sy, r * Math.abs(cosY * 0.6 + 0.4), r, 0, 0, Math.PI * 2);
                    ctx.fill();
                    if (r > 9) {
                        ctx.fillStyle = "#8a5a00";
                        ctx.font = `700 ${Math.round(r)}px sans-serif`;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText("\u20B9", sx, sy + 1);
                    }
                } else {
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(sx, sy, Math.max(0.8, 2.6 * s), 0, Math.PI * 2);
                    ctx.fill();
                }
            });
            ctx.globalAlpha = 1;
        };

        const loop = (t) => {
            if (!document.hidden) draw(t);
            raf = requestAnimationFrame(loop);
        };

        const onPointer = (e) => {
            pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
            pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
        };

        resize();
        window.addEventListener("resize", resize);
        window.addEventListener("pointermove", onPointer, { passive: true });

        if (reduced) draw(0);
        else raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
            window.removeEventListener("pointermove", onPointer);
        };
    }, [canvasRef]);
}

/* ---------- card that tilts toward the pointer and reveals on scroll ---------- */
function TiltCard({ icon, title, children }) {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    el.classList.add("is-in");
                    io.disconnect();
                }
            },
            { threshold: 0.2 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    const move = (e) => {
        const el = ref.current;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--ty", `${(px - 0.5) * 16}deg`);
        el.style.setProperty("--tx", `${(0.5 - py) * 16}deg`);
        el.style.setProperty("--gx", `${px * 100}%`);
        el.style.setProperty("--gy", `${py * 100}%`);
    };

    const leave = () => {
        const el = ref.current;
        el.style.setProperty("--ty", "0deg");
        el.style.setProperty("--tx", "0deg");
    };

    return (
        <div ref={ref} className="h3-tilt" onPointerMove={move} onPointerLeave={leave}>
            <div className="h3-icon">
                <i className={`bi ${icon}`}></i>
            </div>
            <h4>{title}</h4>
            <p>{children}</p>
        </div>
    );
}

function Home() {
    const canvasRef = useRef(null);
    const stageRef = useRef(null);
    useCoinField(canvasRef);

    const tiltStage = (e) => {
        const el = stageRef.current;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", `${px * 24}deg`);
        el.style.setProperty("--rx", `${-py * 18}deg`);
    };

    const resetStage = () => {
        const el = stageRef.current;
        el.style.setProperty("--ry", "0deg");
        el.style.setProperty("--rx", "0deg");
    };

    return (
        <div className="h3-root">
            <canvas ref={canvasRef} className="h3-canvas" aria-hidden="true" />

            <div className="h3-content">
                {/* ---------- hero ---------- */}
                <header className="h3-wrap h3-hero">
                    <div>
                        <span className="h3-badge">All-in-One Finance Manager</span>
                        <h1 className="h3-title">
                            Stop tracking twice. <br />
                            <span className="h3-grad">Start Merging.</span>
                        </h1>
                        <p className="h3-lead">
                            The first app that bridges the gap between splitting bills with friends and
                            tracking your personal wealth. One transaction, zero double-entry.
                        </p>
                        <div className="h3-actions">
                            <Link to="/login" className="h3-btn h3-btn--primary">Get Started</Link>
                            <a href="#features" className="h3-btn h3-btn--ghost">Learn More</a>
                        </div>
                        <div className="h3-pay">
                            <span>UPI</span>
                            <span>Cards</span>
                            <span>Netbanking</span>
                            <span>Secured by Razorpay</span>
                        </div>
                    </div>

                    <div
                        ref={stageRef}
                        className="h3-stage"
                        onPointerMove={tiltStage}
                        onPointerLeave={resetStage}
                    >
                        <div className="h3-scene">
                            <div className="h3-card3d h3-card3d--a">
                                <small>Net worth this month</small>
                                <strong>&#8377;75,400.00</strong>
                            </div>
                            <div className="h3-card3d h3-card3d--b">
                                <small>Goa Trip Split</small>
                                <strong className="h3-neg">-&#8377;2,500</strong>
                                <small>Auto-synced to personal spending</small>
                            </div>
                            <div className="h3-card3d h3-card3d--c">
                                <small>Settled via UPI</small>
                                <strong className="h3-pos">+&#8377;600</strong>
                            </div>
                            <div className="h3-coin" aria-hidden="true">
                                {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                                    <i key={n} style={{ transform: `translateZ(${-n * 2}px)` }} />
                                ))}
                                <b>&#8377;</b>
                            </div>
                        </div>
                    </div>
                </header>

                {/* ---------- features ---------- */}
                <section id="features" className="h3-wrap h3-section">
                    <div className="h3-center">
                        <h2 className="h3-h2">Why MergeMoney is Different</h2>
                        <p className="h3-sub">
                            We believe your share of a group expense IS a personal expense. We handle the math
                            so you don&apos;t have to.
                        </p>
                    </div>
                    <div className="h3-grid">
                        <TiltCard icon="bi-people-fill" title="Smart Bill Splitting">
                            Create groups for trips, rent, or dinners. Invite friends and split costs with one click.
                        </TiltCard>
                        <TiltCard icon="bi-person-check-fill" title="Personal Spending">
                            Your share of group expenses automatically flows into your personal ledger. No more manual entry.
                        </TiltCard>
                        <TiltCard icon="bi-graph-up-arrow" title="Wealth & Investments">
                            Track Mutual Funds, Stocks, and Crypto alongside your daily coffee spend. See the big picture.
                        </TiltCard>
                        <TiltCard icon="bi-shield-lock-fill" title="Secure Payments">
                            Settle up or buy credits with UPI, cards and netbanking. Every payment is verified on our server.
                        </TiltCard>
                    </div>
                </section>

                {/* ---------- wealth + cube ---------- */}
                <section className="h3-wrap h3-section">
                    <div className="h3-split">
                        <div>
                            <h2 className="h3-h2 h3-grad">Master Your Wealth.</h2>
                            <p className="h3-sub" style={{ marginInline: 0 }}>
                                Categorize your life three levels deep (Grocery {">"} Food {">"} Essentials). Track
                                your income sources and watch your &quot;Excess Money&quot; grow month over month.
                            </p>
                            <ul className="h3-list mt-4">
                                <li><i className="bi bi-check2-circle"></i>Real-time Dashboard Statistics</li>
                                <li><i className="bi bi-check2-circle"></i>Custom Date Range Reporting</li>
                                <li><i className="bi bi-check2-circle"></i>Secure Replica-Set Transactions</li>
                            </ul>
                        </div>
                        <div className="h3-cubebox" aria-hidden="true">
                            <div className="h3-cube">
                                <span>Groups</span>
                                <span>Splits</span>
                                <span>Settle</span>
                                <span>Analytics</span>
                                <span>Pay</span>
                                <span>Secure</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ---------- call to action ---------- */}
                <section className="h3-wrap">
                    <div className="h3-cta">
                        <h2 className="h3-h2">Ready to simplify your finances?</h2>
                        <p className="h3-sub">
                            Join thousands of users managing their wealth smarter with MergeMoney.
                        </p>
                        <Link to="/login" className="h3-btn h3-btn--primary d-inline-block mt-4">
                            Create Your Account
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default Home;
