import { useState } from "react";
import { Loader2, Lock, User } from "lucide-react";
import { useCrmAuth } from "@/contexts/CrmAuthContext";
import "@/styles/crm-design.css";

export default function LoginV3() {
  const { login } = useCrmAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await login(username, password);
    if (result.error) setError(result.error);
    setLoading(false);
  };

  return (
    <div className="crm-v3" style={{ minHeight: "100vh", background: "var(--crm-bg)", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="crm-brand-mark" style={{ width: 48, height: 48, fontSize: 26, margin: "0 auto 14px" }}>P</div>
          <div className="crm-page-eyebrow" style={{ justifyContent: "center" }}>PreceptorMED · CRM v3</div>
          <h1 style={{ fontFamily: "var(--crm-sans)", fontSize: 28, fontWeight: 700, color: "var(--crm-ink)", letterSpacing: "-0.02em", margin: "8px 0 4px" }}>
            Acesso <em style={{ fontFamily: "var(--crm-serif)", fontStyle: "italic", fontWeight: 500, color: "var(--crm-green-deep)" }}>interno</em>
          </h1>
          <p style={{ fontSize: 13, color: "var(--crm-ink-3)", margin: 0 }}>Apenas para o time PreceptorMED</p>
        </div>

        <form onSubmit={handleSubmit} className="crm-card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--crm-ink-4)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
              Usuário
            </label>
            <div style={{ position: "relative" }}>
              <User size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--crm-ink-4)" }} />
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{
                  width: "100%", padding: "9px 12px 9px 32px",
                  background: "var(--crm-surface-2)",
                  border: "1px solid var(--crm-line)",
                  borderRadius: 7, fontFamily: "var(--crm-text)",
                  fontSize: 13, color: "var(--crm-ink)",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--crm-ink-4)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
              Senha
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--crm-ink-4)" }} />
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%", padding: "9px 12px 9px 32px",
                  background: "var(--crm-surface-2)",
                  border: "1px solid var(--crm-line)",
                  borderRadius: 7, fontFamily: "var(--crm-text)",
                  fontSize: 13, color: "var(--crm-ink)",
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              padding: "8px 10px",
              background: "var(--crm-neg-soft)",
              color: "var(--crm-neg)",
              borderRadius: 6, fontSize: 12, fontWeight: 500,
              marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="crm-btn crm-btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "10px 12px", fontSize: 13, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Entrar"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--crm-ink-4)" }}>
          PreceptorMED · CRM interno · v3.0
        </p>
      </div>
    </div>
  );
}
