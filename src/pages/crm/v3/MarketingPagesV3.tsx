import { useState, useMemo, type CSSProperties } from "react";
import CrmShellV3, { Kpi, PageHero, PeriodBar, CardHead } from "@/components/crm/v3/CrmShellV3";
import {
  Plus, Download, Send, Activity, Edit3, Eye, Gift, UserX, Loader2,
  Sparkles, RefreshCw, ChevronDown, Mail,
} from "lucide-react";
import {
  useDashboardKpis, useHealthDistribution, useHealthScoresList,
  useActiveChurnRisks, useAutomationsPerformance, useRecentAutomations, useUtmBreakdown,
} from "@/hooks/useCrm";
import { supabase } from "@/lib/crm/supabase";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

const fmt = (v: number) => v.toLocaleString("pt-BR");
const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const PLAN_TAG: Record<string, string> = {
  monthly: "gray", annual: "green", biannual: "gold", free_access: "blue",
};
const PLAN_LABEL: Record<string, string> = {
  monthly: "Mensal", annual: "Anual", biannual: "Bianual", free_access: "Free",
};

/* =========================================================
   HEALTH — dados reais
   ========================================================= */
export function HealthV3() {
  const { data: dist } = useHealthDistribution();
  const { data: list } = useHealthScoresList({ zone: "risk", page: 1 });
  const { data: kpis } = useDashboardKpis();

  const total = (dist ?? []).reduce((s, d: any) => s + d.count, 0);
  const byZone: Record<string, number> = {};
  (dist ?? []).forEach((d: any) => { byZone[d.zone] = (byZone[d.zone] ?? 0) + d.count; });
  const saudaveis = byZone["healthy"] ?? 0;
  const atentos = byZone["attention"] ?? 0;
  const risco = (byZone["risk"] ?? 0) + (byZone["critical"] ?? 0);
  const scoreMedio = total > 0
    ? Math.round((dist ?? []).reduce((s, d: any) => s + d.avg_score * d.count, 0) / total)
    : 0;

  const emRisco = (list?.scores ?? []).slice(0, 5);

  return (
    <CrmShellV3 mode="marketing" crumbs={[{ label: "CRM" }, { label: "Marketing" }, { label: "Saúde dos alunos" }]}>
      <main className="crm-page">
        <PageHero
          eyebrow="Marketing · Health Score"
          title={<>Saúde <em>dos {fmt(total || kpis?.totalSubscribers || 0)} alunos</em></>}
          sub="Score 0-100 calculado a partir de engajamento, última atividade e progressão. Atualizado pela view crm_health_distribution."
          actions={<button className="crm-btn crm-btn-ghost"><Download size={13} /> Exportar</button>}
        />

        <section className="crm-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Kpi label="Score médio" value={scoreMedio} accent="mrr" />
          <Kpi label="Saudáveis" value={saudaveis} unit={`/${total}`} deltaText="score ≥ 70" />
          <Kpi label="Atentos" value={atentos} deltaText="score 40-69" accent="warn" />
          <Kpi label="Em risco" value={risco} deltaText="score < 40" accent="neg" />
        </section>

        <section className="crm-card">
          <CardHead title="Distribuição por zona" sub="dados de crm_health_distribution" />
          <div className="crm-card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(dist ?? []).map((d: any) => {
              const pct = total > 0 ? (d.count / total) * 100 : 0;
              const cor = d.zone === "healthy" ? "var(--crm-green-deep)" : d.zone === "attention" ? "var(--crm-gold-deep)" : "var(--crm-neg)";
              return (
                <div key={d.zone}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "var(--crm-ink-2)", textTransform: "capitalize" }}>{d.zone}</span>
                    <span className="crm-mono" style={{ fontSize: 13, fontWeight: 700 }}>{d.count} · score médio {Math.round(d.avg_score)}</span>
                  </div>
                  <div style={{ height: 14, background: "var(--crm-surface-3)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(pct, 2)}%`, background: cor, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
            {(!dist || dist.length === 0) && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>Sem dados em crm_health_distribution.</div>
            )}
          </div>
        </section>

        <section className="crm-card">
          <CardHead title="Alunos em risco" sub={`${list?.total ?? 0} alunos com score em zona risk/critical`} side={<a className="crm-btn crm-btn-link" href="/admin/crm-mkt/health">Ver todos →</a>} />
          {emRisco.length > 0 ? (
            <table className="crm-tbl">
              <thead><tr><th>Aluno</th><th>Score</th><th>Questões 7d</th><th>Dias ativos 14d</th></tr></thead>
              <tbody>
                {emRisco.map((r: any) => (
                  <tr key={r.id}>
                    <td><div className="lead-name">{r.crm_leads?.nome ?? r.crm_leads?.email ?? "—"}</div><div className="lead-email">{r.crm_leads?.email}</div></td>
                    <td><div className="crm-score"><div className="crm-score-bar" style={{ ["--score" as never]: `${r.score}%` }} /><span className="crm-score-num">{r.score}</span></div></td>
                    <td className="num">{r.questoes_7d ?? 0}</td>
                    <td className="num">{r.dias_ativos_14d ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>Nenhum aluno em zona de risco.</div>
          )}
        </section>
      </main>
    </CrmShellV3>
  );
}

/* =========================================================
   CHURN — dados reais
   ========================================================= */
export function ChurnV3() {
  const { data: critical } = useActiveChurnRisks({ risk_level: "critical", page: 1 });
  const { data: high } = useActiveChurnRisks({ risk_level: "high", page: 1 });
  const { data: medium } = useActiveChurnRisks({ risk_level: "medium", page: 1 });
  const { data: kpis } = useDashboardKpis();

  const all: any[] = [...(critical?.predictions ?? []), ...(high?.predictions ?? []), ...(medium?.predictions ?? [])];
  const cri = critical?.total ?? 0;
  const hi = high?.total ?? 0;
  const md = medium?.total ?? 0;

  return (
    <CrmShellV3 mode="marketing" crumbs={[{ label: "CRM" }, { label: "Marketing" }, { label: "Risco de churn" }]}>
      <main className="crm-page">
        <PageHero
          eyebrow="Marketing · Churn Prediction"
          title={<>{cri + hi} alunos <em>em risco real</em> de cancelar</>}
          sub="Modelo preditivo usando crm_active_churn_risks. Probabilidade de cancelamento na janela de validade."
          actions={<button className="crm-btn crm-btn-primary"><Send size={13} /> Acionar todos</button>}
        />

        <section className="crm-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Kpi label="Risco crítico" value={cri} deltaText="≥ 70%" accent="neg" />
          <Kpi label="Risco alto" value={hi} deltaText="50-69%" accent="warn" />
          <Kpi label="Risco médio" value={md} deltaText="30-49%" />
          <Kpi label="MRR ameaçado" value={fmtBRL((cri + hi) * (kpis?.mrr ? kpis.mrr / Math.max(kpis.totalSubscribers, 1) : 50))} deltaText="estimativa se cancelarem" accent="mrr" />
        </section>

        <section className="crm-card">
          <CardHead title="Lista priorizada" sub={`${all.length} predições ativas · ordenadas por probabilidade`} />
          {all.length > 0 ? (
            <table className="crm-tbl">
              <thead><tr><th>Aluno</th><th style={{ textAlign: "right" }}>Prob.</th><th>Risco</th><th>Sinais</th><th>Health</th><th>Válido até</th></tr></thead>
              <tbody>
                {all.sort((a: any, b: any) => b.churn_probability - a.churn_probability).slice(0, 30).map((r: any) => {
                  const pct = Math.round(r.churn_probability * 100);
                  return (
                    <tr key={r.id}>
                      <td><div className="lead-name">{r.nome ?? r.email ?? "—"}</div><div className="lead-email">{r.email}</div></td>
                      <td className="num"><span style={{ color: pct >= 70 ? "var(--crm-neg)" : pct >= 50 ? "var(--crm-gold-deep)" : "var(--crm-ink)", fontWeight: 700 }}>{pct}%</span></td>
                      <td><span className={`crm-tag crm-tag-${r.risk_level === "critical" ? "red" : r.risk_level === "high" ? "warn" : "gray"}`}><span className="crm-tag-dot" />{r.risk_level}</span></td>
                      <td className="muted">{(r.signals ?? []).slice(0, 2).join(" · ") || "—"}</td>
                      <td className="num">{r.health_score ?? "—"}</td>
                      <td className="muted">{r.valid_until ? new Date(r.valid_until).toLocaleDateString("pt-BR") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>Nenhuma predição ativa em crm_active_churn_risks.</div>
          )}
        </section>
      </main>
    </CrmShellV3>
  );
}

/* =========================================================
   COHORTS — dados reais (calculados client-side)
   ========================================================= */
function useCohortsRetencao() {
  return useQuery({
    queryKey: ["crm", "cohorts-retencao"],
    queryFn: async () => {
      // Busca leads + última activity para montar coortes mensais.
      const { data: leads } = await supabase
        .from("crm_leads")
        .select("id, created_at, last_activity_at, status")
        .gte("created_at", new Date(Date.now() - 240 * 86400000).toISOString());
      const byCohort: Record<string, { total: number; active: number[] }> = {};
      const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      (leads ?? []).forEach((l: any) => {
        const cohort = monthKey(new Date(l.created_at));
        if (!byCohort[cohort]) byCohort[cohort] = { total: 0, active: [0, 0, 0, 0, 0, 0, 0] };
        byCohort[cohort].total += 1;
        if (l.status === "subscriber" || l.status === "active_trial" || l.status === "engaged") {
          // contar como ativo nos meses M0..M6 a partir de last_activity
          const created = new Date(l.created_at);
          const lastAct = l.last_activity_at ? new Date(l.last_activity_at) : created;
          const mAtivo = Math.min(6, Math.floor((lastAct.getTime() - created.getTime()) / (30 * 86400000)));
          for (let i = 0; i <= mAtivo; i++) byCohort[cohort].active[i] += 1;
        } else {
          byCohort[cohort].active[0] += 1;
        }
      });

      return Object.entries(byCohort)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-7)
        .map(([cohort, d]) => ({
          cohort,
          total: d.total,
          values: d.active.map((c) => d.total > 0 ? Math.round((c / d.total) * 100) : 0),
        }));
    },
  });
}

export function CohortsV3() {
  const { data: cohorts } = useCohortsRetencao();
  const lista = cohorts ?? [];

  // KPIs: retenção média M1, M3, M6 considerando apenas coortes que já viveram esse mês
  const avgM = (mIdx: number) => {
    const vals = lista.filter((c) => c.values[mIdx] !== undefined && lista.indexOf(c) <= lista.length - 1 - mIdx).map((c) => c.values[mIdx]);
    return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  };

  return (
    <CrmShellV3 mode="marketing" crumbs={[{ label: "CRM" }, { label: "Marketing" }, { label: "Coortes" }]}>
      <main className="crm-page">
        <PageHero
          eyebrow="Marketing · Retention"
          title={<>Coortes <em>de retenção</em></>}
          sub="% de assinantes ativos por mês de cadastro. Calculado client-side a partir de crm_leads."
        />

        <section className="crm-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Kpi label="Retenção M1" value={avgM(1)} unit="%" accent="mrr" />
          <Kpi label="Retenção M3" value={avgM(3)} unit="%" />
          <Kpi label="Retenção M6" value={avgM(6)} unit="%" />
          <Kpi label="Coortes ativas" value={lista.length} deltaText="últimos 8 meses" />
        </section>

        <section className="crm-card">
          <CardHead title="Cohort grid" sub="cada linha é uma coorte mensal · cada coluna meses desde o cadastro" />
          <div className="crm-card-pad">
            {lista.length > 0 ? (
              <div className="crm-cohort-grid" style={{ display: "grid", gridTemplateColumns: "140px repeat(7, 1fr)", gap: 4, fontFamily: "var(--crm-mono)", fontSize: 11, minWidth: 560 }}>
                <div style={{ color: "var(--crm-ink-4)", fontSize: 10.5, padding: "6px 8px", fontWeight: 600, fontFamily: "var(--crm-sans)" }}>Coorte</div>
                {["M0","M1","M2","M3","M4","M5","M6"].map((m) => <div key={m} style={{ color: "var(--crm-ink-4)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10.5, padding: "6px 8px", textAlign: "center", fontWeight: 600 }}>{m}</div>)}
                {lista.map((row, idx) => {
                  const maxIdx = lista.length - 1 - idx;
                  return (
                    <RowCohort key={row.cohort} row={row} maxIdx={maxIdx} />
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 32, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>Sem coortes calculadas — aguardando leads em crm_leads.</div>
            )}
          </div>
        </section>
      </main>
    </CrmShellV3>
  );
}

function RowCohort({ row, maxIdx }: { row: { cohort: string; total: number; values: number[] }; maxIdx: number }) {
  const cor = (v: number | null) => {
    if (v === null) return { bg: "transparent", color: "var(--crm-ink-5)" };
    if (v >= 90) return { bg: "#1B5E3B", color: "#fff" };
    if (v >= 75) return { bg: "#3F8B5C", color: "#fff" };
    if (v >= 50) return { bg: "#5BA374", color: "#fff" };
    return { bg: "#86B996", color: "#fff" };
  };
  return (
    <>
      <div style={{ color: "var(--crm-ink-3)", fontFamily: "var(--crm-sans)", padding: "8px 8px", fontSize: 11.5 }}>{row.cohort} · {row.total}</div>
      {row.values.map((v, i) => {
        const visible = i <= maxIdx;
        const { bg, color } = cor(visible ? v : null);
        return (
          <div key={`${row.cohort}-${i}`} style={{ padding: "10px 6px", textAlign: "center", borderRadius: 4, background: bg, color, fontFeatureSettings: '"tnum"', fontWeight: 600 }}>
            {visible ? `${v}%` : "—"}
          </div>
        );
      })}
    </>
  );
}

/* =========================================================
   AUTOMATIONS — dados reais
   ========================================================= */
export function AutomationsV3() {
  const { data: perf } = useAutomationsPerformance();
  const { data: recent } = useRecentAutomations({ pageSize: 50 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const disparosHoje = (recent?.automations ?? []).filter((a: any) => new Date(a.created_at) >= todayStart).length;

  const lista = recent?.automations ?? [];
  const totalDelivered = lista.filter((a: any) => a.delivered_at || a.status === "delivered" || a.status === "opened" || a.status === "clicked").length;
  const totalOpened = lista.filter((a: any) => a.opened_at || a.status === "opened" || a.status === "clicked").length;
  const totalSent = lista.filter((a: any) => a.sent_at || a.status !== "pending").length;
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const openRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0;

  return (
    <CrmShellV3 mode="marketing" crumbs={[{ label: "CRM" }, { label: "Marketing" }, { label: "Automações" }]}
      topbarTools={<><button className="crm-btn crm-btn-ghost"><Download size={13} /> Logs</button><button className="crm-btn crm-btn-primary"><Plus size={13} /> Nova automação</button></>}
    >
      <main className="crm-page">
        <PageHero
          eyebrow="Marketing · Automations"
          title={<>{fmt(disparosHoje)} disparos <em>hoje</em></>}
          sub="Logs de crm_automations_log e performance agregada via view crm_automations_performance."
        />

        <section className="crm-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Kpi label="Disparos hoje" value={disparosHoje} accent="mrr" />
          <Kpi label="Delivery rate" value={deliveryRate} unit="%" deltaText={`${totalDelivered}/${totalSent}`} />
          <Kpi label="Open rate" value={openRate} unit="%" deltaText={`${totalOpened}/${totalDelivered}`} />
          <Kpi label="Playbooks ativos" value={(perf ?? []).length} deltaText="performance views" accent="warn" />
        </section>

        <section className="crm-card">
          <CardHead title="Performance por gatilho" sub="agregado em crm_automations_performance" />
          {(perf ?? []).length > 0 ? (
            <table className="crm-tbl">
              <thead><tr><th>Trigger</th><th>Canal</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Delivery</th><th style={{ textAlign: "right" }}>Open</th><th style={{ textAlign: "right" }}>Click</th></tr></thead>
              <tbody>
                {(perf ?? []).map((p: any, i: number) => (
                  <tr key={i}>
                    <td className="lead-name">{p.trigger_name}</td>
                    <td><span className={`crm-tag crm-tag-${p.automation_type === "email" ? "blue" : p.automation_type === "push" ? "gold" : p.automation_type === "whatsapp" ? "green" : "gray"}`}><span className="crm-tag-dot" />{p.automation_type}</span></td>
                    <td className="num">{p.total_sent ?? 0}</td>
                    <td className="num">{p.total_sent > 0 ? `${Math.round((Number(p.delivered) / Number(p.total_sent)) * 100)}%` : "—"}</td>
                    <td className="num">{p.open_rate_pct != null ? `${Math.round(Number(p.open_rate_pct))}%` : "—"}</td>
                    <td className="num">{p.click_rate_pct != null ? `${Math.round(Number(p.click_rate_pct))}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>Sem dados em crm_automations_performance.</div>
          )}
        </section>

        <section className="crm-card">
          <CardHead title="Logs recentes" sub={`${lista.length} disparos · ordenados por data desc`} />
          {lista.length > 0 ? (
            <table className="crm-tbl">
              <thead><tr><th>Trigger</th><th>Lead</th><th>Canal</th><th>Status</th><th>Quando</th></tr></thead>
              <tbody>
                {lista.slice(0, 30).map((a: any) => (
                  <tr key={a.id}>
                    <td className="lead-name">{a.trigger_name}</td>
                    <td className="muted">{a.crm_leads?.email ?? "—"}</td>
                    <td><span className="crm-tag crm-tag-gray"><span className="crm-tag-dot" />{a.channel}</span></td>
                    <td><span className={`crm-tag crm-tag-${a.status === "failed" || a.status === "bounced" ? "red" : a.status === "opened" || a.status === "clicked" ? "green" : "gray"}`}><span className="crm-tag-dot" />{a.status}</span></td>
                    <td className="muted">{new Date(a.created_at).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>Sem disparos em crm_automations_log.</div>
          )}
        </section>
      </main>
    </CrmShellV3>
  );
}

/* =========================================================
   EMAIL TEMPLATES — dados reais
   ========================================================= */
function useEmailTemplates() {
  return useQuery({
    queryKey: ["crm", "email-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_email_templates").select("*").order("label");
      return (data ?? []) as any[];
    },
  });
}

export function EmailTemplatesV3() {
  const { data: templates } = useEmailTemplates();
  const lista = templates ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = lista.find((t: any) => t.trigger_name === selectedId) ?? lista[0];

  return (
    <CrmShellV3 mode="marketing" crumbs={[{ label: "CRM" }, { label: "Marketing" }, { label: "E-mail templates" }]}
      topbarTools={<><button className="crm-btn crm-btn-ghost"><Eye size={13} /> Preview</button><button className="crm-btn crm-btn-primary"><Plus size={13} /> Novo template</button></>}
    >
      <main className="crm-page">
        <PageHero
          eyebrow="Marketing · Email Library"
          title={<>{lista.length} templates <em>em produção</em></>}
          sub="Biblioteca de e-mails salva em crm_email_templates. Cada trigger tem um template ativo."
        />

        {lista.length === 0 ? (
          <section className="crm-card">
            <div style={{ padding: 48, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>Sem templates em crm_email_templates.</div>
          </section>
        ) : (
          <section className="crm-mobile-stack" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div className="crm-card">
              <CardHead title="Lista de templates" sub={`${lista.length} cadastrados`} />
              <div>
                {lista.map((t: any) => {
                  const isSel = (selected?.trigger_name === t.trigger_name);
                  return (
                    <button key={t.trigger_name} onClick={() => setSelectedId(t.trigger_name)} style={{
                      width: "100%", textAlign: "left", border: "none",
                      padding: "14px 18px",
                      borderBottom: "1px solid var(--crm-line-soft)",
                      background: isSel ? "var(--crm-green-tint)" : "var(--crm-surface)",
                      cursor: "pointer", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontFamily: "var(--crm-sans)", fontSize: 13, fontWeight: 600, color: "var(--crm-ink)" }}>{t.label ?? t.trigger_name}</div>
                        <div className="crm-mono" style={{ fontSize: 11, color: "var(--crm-ink-4)", marginTop: 2 }}>
                          {t.trigger_name} · {t.auto_send ? "auto" : "manual"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className={`crm-tag crm-tag-${t.auto_send ? "green" : "gray"}`}><span className="crm-tag-dot" />{t.auto_send ? "Ativo" : "Manual"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="crm-card">
              <CardHead title="Preview" sub={selected?.label ?? selected?.trigger_name ?? "—"} side={<><button className="crm-btn crm-btn-primary"><Edit3 size={13} /> Editar</button></>} />
              <div style={{ padding: 24, background: "var(--crm-surface-2)", minHeight: 420 }}>
                <div style={{ background: "#fff", border: "1px solid var(--crm-line)", borderRadius: 8, padding: 28, maxWidth: 520, margin: "0 auto" }}>
                  <div className="crm-mono" style={{ fontSize: 11, color: "var(--crm-ink-4)", marginBottom: 16 }}>De: PreceptorMED &lt;ola@thepreceptor.com.br&gt;</div>
                  {selected?.subject && (
                    <h2 style={{ fontFamily: "var(--crm-sans)", fontSize: 18, fontWeight: 700, color: "var(--crm-ink)", letterSpacing: "-0.02em", margin: "0 0 12px" }}>
                      {selected.subject}
                    </h2>
                  )}
                  <div style={{ fontSize: 14, color: "var(--crm-ink-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {selected?.body_text ?? selected?.body_html ?? "Sem corpo cadastrado."}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </CrmShellV3>
  );
}

/* =========================================================
   ATIVIDADE / ANALYTICS — dados reais de generation_logs + user_progression
   ========================================================= */
/* ─── Estimativa de custo da IA ──────────────────────────────────
 * Sem token logs por chamada, estimamos custo medio por function_name
 * baseado em tokens medios observados (input + output) × precos da
 * Claude Opus 5 (setembro/2026: $5.00/1M input, $25.00/1M output).
 * Multiplicado por USD_BRL pra mostrar em reais.
 */
const USD_BRL = 5.5;
const CLAUDE_IN_PER_1M = 5.00;
const CLAUDE_OUT_PER_1M = 25.00;

// Tokens medios por funcao (estimado por inspecao dos prompts/outputs)
const AVG_TOKENS: Record<string, { in: number; out: number }> = {
  "generate-fechamento": { in: 5500, out: 12000 },
  "generate-exam":       { in: 3500, out: 5500 },
  "generate-enamed":     { in: 4000, out: 6500 },
  "generate-flashcards": { in: 2500, out: 3000 },
  "scientific-mentor":   { in: 3500, out: 5500 },
  "ai-chat":             { in: 3500, out: 1500 },
  "support-chat":        { in: 2000, out: 1500 },
};
const FALLBACK_TOKENS = { in: 2000, out: 2000 };

/** Custo estimado em USD de uma chamada da funcao */
function estimateCostUsd(functionName: string): number {
  const t = AVG_TOKENS[functionName] ?? FALLBACK_TOKENS;
  return (t.in * CLAUDE_IN_PER_1M + t.out * CLAUDE_OUT_PER_1M) / 1_000_000;
}

/** Custo estimado em BRL (USD × cambio) */
function estimateCostBrl(functionName: string): number {
  return estimateCostUsd(functionName) * USD_BRL;
}

function useRealActivity() {
  return useQuery({
    queryKey: ["crm", "real-activity"],
    queryFn: async () => {
      const now = Date.now();
      const d1 = new Date(now - 86400000).toISOString();
      const d7 = new Date(now - 7 * 86400000).toISOString();
      const d30 = new Date(now - 30 * 86400000).toISOString();

      // Pega TODOS os logs dos últimos 30 dias (com user_id, function_name, created_at)
      const { data: logs30 } = await supabase
        .from("generation_logs")
        .select("user_id, function_name, created_at")
        .gte("created_at", d30)
        .order("created_at", { ascending: false })
        .limit(50000);

      const all = logs30 ?? [];
      const dauSet = new Set<string>();
      const wauSet = new Set<string>();
      const mauSet = new Set<string>();
      const featureCount: Record<string, { calls: number; users: Set<string> }> = {};
      const userCount: Record<string, { calls: number; lastUsed: string; features: Set<string> }> = {};
      const todayUserCount: Record<string, { calls: number; lastUsed: string; features: Set<string> }> = {};
      const dailyCount: Record<string, number> = {};

      all.forEach((l: any) => {
        if (l.created_at >= d1) {
          dauSet.add(l.user_id);
          if (!todayUserCount[l.user_id]) todayUserCount[l.user_id] = { calls: 0, lastUsed: l.created_at, features: new Set() };
          todayUserCount[l.user_id].calls += 1;
          if (l.created_at > todayUserCount[l.user_id].lastUsed) todayUserCount[l.user_id].lastUsed = l.created_at;
          todayUserCount[l.user_id].features.add(l.function_name);
        }
        if (l.created_at >= d7) wauSet.add(l.user_id);
        mauSet.add(l.user_id);

        if (!featureCount[l.function_name]) featureCount[l.function_name] = { calls: 0, users: new Set() };
        featureCount[l.function_name].calls += 1;
        featureCount[l.function_name].users.add(l.user_id);

        if (!userCount[l.user_id]) userCount[l.user_id] = { calls: 0, lastUsed: l.created_at, features: new Set() };
        userCount[l.user_id].calls += 1;
        if (l.created_at > userCount[l.user_id].lastUsed) userCount[l.user_id].lastUsed = l.created_at;
        userCount[l.user_id].features.add(l.function_name);

        const day = l.created_at.split("T")[0];
        dailyCount[day] = (dailyCount[day] ?? 0) + 1;
      });

      const dau = dauSet.size;
      const wau = wauSet.size;
      const mau = mauSet.size;

      // Top users (30d) + Today users — buscamos profiles dos dois conjuntos
      const topUserIds = Object.entries(userCount).sort((a, b) => b[1].calls - a[1].calls).slice(0, 30).map(([uid]) => uid);
      const todayUserIds = Object.keys(todayUserCount);
      const allUserIds = Array.from(new Set([...topUserIds, ...todayUserIds]));

      const { data: profiles } = allUserIds.length > 0
        ? await supabase.from("profiles").select("user_id, email, full_name").in("user_id", allUserIds)
        : { data: [] };
      const profMap: Record<string, any> = {};
      (profiles ?? []).forEach((p: any) => { profMap[p.user_id] = p; });

      const topUsers = Object.entries(userCount)
        .sort((a, b) => b[1].calls - a[1].calls)
        .slice(0, 30)
        .map(([uid, info]) => ({
          user_id: uid,
          email: profMap[uid]?.email ?? "—",
          name: profMap[uid]?.full_name ?? null,
          calls: info.calls,
          features: info.features.size,
          lastUsed: info.lastUsed,
        }));

      // Usuários que chamaram IA HOJE (últimas 24h), ordenados por número de calls
      const todayUsers = Object.entries(todayUserCount)
        .sort((a, b) => b[1].calls - a[1].calls)
        .map(([uid, info]) => ({
          user_id: uid,
          email: profMap[uid]?.email ?? "—",
          name: profMap[uid]?.full_name ?? null,
          calls: info.calls,
          features: Array.from(info.features),
          lastUsed: info.lastUsed,
        }));

      // Top features
      const topFeatures = Object.entries(featureCount)
        .sort((a, b) => b[1].calls - a[1].calls)
        .map(([name, info]) => ({
          name,
          calls: info.calls,
          users: info.users.size,
        }));

      // Daily timeseries
      const days = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now - i * 86400000);
        return d.toISOString().split("T")[0];
      }).reverse();
      const timeseries = days.map((d) => ({ day: d, calls: dailyCount[d] ?? 0 }));

      return { dau, wau, mau, topUsers, todayUsers, topFeatures, timeseries, totalCalls: all.length };
    },
    refetchInterval: 60_000,
  });
}

function useStreakLeaders() {
  return useQuery({
    queryKey: ["crm", "streak-leaders"],
    queryFn: async () => {
      const { data: progression } = await supabase
        .from("user_progression")
        .select("user_id, streak_days, best_streak, total_xp, level, last_activity_date, cards_reviewed_total")
        .order("streak_days", { ascending: false })
        .limit(30);

      const ids = (progression ?? []).map((p: any) => p.user_id);
      const { data: profiles } = ids.length > 0
        ? await supabase.from("profiles").select("user_id, email, full_name").in("user_id", ids)
        : { data: [] };
      const profMap: Record<string, any> = {};
      (profiles ?? []).forEach((p: any) => { profMap[p.user_id] = p; });

      return (progression ?? []).map((p: any) => ({
        ...p,
        email: profMap[p.user_id]?.email ?? "—",
        name: profMap[p.user_id]?.full_name ?? null,
      }));
    },
    refetchInterval: 60_000,
  });
}

const FEATURE_LABELS: Record<string, string> = {
  "ai-chat": "Chat IA",
  "generate-fechamento": "Resumo PBL",
  "generate-exam": "Simulado",
  "generate-flashcards": "Flashcards (gerar)",
  "generate-enamed": "ENAMED",
  "scientific-mentor": "Mentor científico",
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `há ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `há ${Math.floor(diff / 3600000)} h`;
  return `há ${Math.floor(diff / 86400000)} dias`;
}

type TopUserSortKey = "index" | "user" | "calls" | "features" | "lastUsed";

export function AnalyticsV3() {
  const { data: act, isLoading } = useRealActivity();
  const { data: streaks } = useStreakLeaders();
  const { data: utm } = useUtmBreakdown();

  // Ordenacao da tabela "Top usuarios ativos" — click na <th> ordena, click denovo inverte
  const [topUsersSort, setTopUsersSort] = useState<{ key: TopUserSortKey; dir: "asc" | "desc" }>({ key: "calls", dir: "desc" });
  const toggleTopUsersSort = (key: TopUserSortKey) => {
    setTopUsersSort(prev => prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "user" ? "asc" : "desc" });
  };
  const sortedTopUsers = useMemo(() => {
    const list = act?.topUsers ?? [];
    if (list.length === 0) return list;
    const dirMul = topUsersSort.dir === "asc" ? 1 : -1;
    const getKey = (u: any, key: TopUserSortKey) => {
      switch (key) {
        case "user": return (u.name ?? u.email ?? "").toLowerCase();
        case "calls": return Number(u.calls ?? 0);
        case "features": return Number(u.features ?? 0);
        case "lastUsed": return new Date(u.lastUsed ?? 0).getTime();
        default: return 0;
      }
    };
    if (topUsersSort.key === "index") return [...list]; // ordem natural
    return [...list].sort((a, b) => {
      const av = getKey(a, topUsersSort.key);
      const bv = getKey(b, topUsersSort.key);
      if (av < bv) return -1 * dirMul;
      if (av > bv) return  1 * dirMul;
      return 0;
    });
  }, [act?.topUsers, topUsersSort]);

  const stickiness = (act?.mau ?? 0) > 0 ? Math.round(((act?.dau ?? 0) / (act?.mau ?? 1)) * 100) : 0;
  const maxDay = Math.max(1, ...((act?.timeseries ?? []).map((d) => d.calls)));

  // ── Custo estimado de IA ──
  const costStats = useMemo(() => {
    const features = act?.topFeatures ?? [];
    let totalUsd = 0;
    const byFunction = features.map(f => {
      const usd = estimateCostUsd(f.name) * f.calls;
      totalUsd += usd;
      return {
        name: f.name,
        calls: f.calls,
        users: f.users,
        usd,
        brl: usd * USD_BRL,
        unitBrl: estimateCostBrl(f.name),
      };
    }).sort((a, b) => b.usd - a.usd);
    const totalBrl = totalUsd * USD_BRL;
    const totalCalls = features.reduce((s, f) => s + f.calls, 0);
    const avgPerCallBrl = totalCalls > 0 ? totalBrl / totalCalls : 0;
    const costPerDauBrl = (act?.dau ?? 0) > 0 ? totalBrl / (act?.dau ?? 1) : 0;
    return { totalUsd, totalBrl, byFunction, avgPerCallBrl, costPerDauBrl, totalCalls };
  }, [act?.topFeatures, act?.dau]);

  return (
    <CrmShellV3 mode="marketing" crumbs={[{ label: "CRM" }, { label: "Marketing" }, { label: "Atividade" }]}>
      <main className="crm-page">
        <PageHero
          eyebrow="Marketing · Atividade real"
          title={<>Quem está <em>usando o app</em></>}
          sub="DAU/WAU/MAU calculados de generation_logs (uso real de IA). Streaks vêm de user_progression. Tudo direto do banco — sem caches."
        />

        <section className="crm-kpi-row" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          <Kpi label="DAU" value={fmt(act?.dau ?? 0)} deltaText="users com chamada IA hoje" accent="mrr" />
          <Kpi label="WAU" value={fmt(act?.wau ?? 0)} deltaText="últimos 7 dias" />
          <Kpi label="MAU" value={fmt(act?.mau ?? 0)} deltaText="últimos 30 dias" />
          <Kpi label="Stickiness" value={`${stickiness}%`} deltaText="DAU / MAU" accent="warn" />
          <Kpi label="Calls IA / 30d" value={fmt(act?.totalCalls ?? 0)} deltaText="generation_logs" />
        </section>

        {/* ── KPIs de custo de IA ── */}
        <section className="crm-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Kpi
            label="Custo IA · 30d"
            value={`R$ ${costStats.totalBrl.toFixed(2)}`}
            deltaText={`~US$ ${costStats.totalUsd.toFixed(2)} · estimado`}
            accent="neg"
          />
          <Kpi
            label="Custo médio / chamada"
            value={`R$ ${costStats.avgPerCallBrl.toFixed(3)}`}
            deltaText={`${fmt(costStats.totalCalls)} chamadas`}
          />
          <Kpi
            label="Custo / DAU"
            value={`R$ ${costStats.costPerDauBrl.toFixed(2)}`}
            deltaText="por usuário ativo hoje"
          />
          <Kpi
            label="Projeção 30d"
            value={`R$ ${(costStats.totalBrl).toFixed(2)}`}
            deltaText={`Anualizado: R$ ${(costStats.totalBrl * 12).toFixed(0)}`}
            accent="warn"
          />
        </section>

        {isLoading ? (
          <section className="crm-card"><div style={{ padding: 48, textAlign: "center", color: "var(--crm-ink-4)" }}><Loader2 className="animate-spin" style={{ display: "inline-block", color: "var(--crm-green-deep)" }} /></div></section>
        ) : (
          <>
            {/* Usuários ativos HOJE — drill-down do DAU */}
            <section className="crm-card">
              <CardHead
                title="Usuários ativos hoje"
                sub={`${(act?.todayUsers ?? []).length} ${(act?.todayUsers ?? []).length === 1 ? "usuário chamou" : "usuários chamaram"} IA nas últimas 24h`}
              />
              {(act?.todayUsers ?? []).length > 0 ? (
                <table className="crm-tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Usuário</th>
                      <th style={{ textAlign: "right" }}>Calls hoje</th>
                      <th>Features usadas</th>
                      <th>Última chamada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(act?.todayUsers ?? []).map((u, i) => (
                      <tr key={u.user_id}>
                        <td className="muted crm-mono" style={{ fontSize: 11 }}>{i + 1}</td>
                        <td>
                          <div className="lead-name">{u.name ?? u.email}</div>
                          {u.name && <div className="lead-email">{u.email}</div>}
                        </td>
                        <td className="num"><strong style={{ color: "var(--crm-gold-deep)" }}>{fmt(u.calls)}</strong></td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {u.features.map((f) => (
                              <span key={f} style={{
                                fontSize: 10,
                                padding: "2px 6px",
                                borderRadius: 3,
                                background: "var(--crm-green-soft)",
                                color: "var(--crm-green-deep)",
                                fontFamily: "var(--crm-mono)",
                              }}>{FEATURE_LABELS[f] ?? f}</span>
                            ))}
                          </div>
                        </td>
                        <td className="muted">{fmtRelative(u.lastUsed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 32, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>
                  Nenhuma chamada de IA nas últimas 24h.
                </div>
              )}
            </section>

            {/* Daily activity */}
            <section className="crm-card">
              <CardHead title="Atividade diária · 30 dias" sub={`Total ${fmt(act?.totalCalls ?? 0)} chamadas de IA`} />
              <div className="crm-card-pad">
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
                  {(act?.timeseries ?? []).map((d) => {
                    const h = (d.calls / maxDay) * 100;
                    const date = new Date(d.day);
                    const isToday = d.day === new Date().toISOString().split("T")[0];
                    return (
                      <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${date.toLocaleDateString("pt-BR")} — ${d.calls} chamadas`}>
                        <div style={{
                          width: "100%",
                          height: `${Math.max(h, 2)}%`,
                          background: isToday ? "var(--crm-gold-deep)" : "var(--crm-green-deep)",
                          borderRadius: "2px 2px 0 0",
                        }} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "var(--crm-ink-4)" }} className="crm-mono">
                  <span>{(act?.timeseries ?? [])[0]?.day ? new Date((act?.timeseries ?? [])[0].day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : ""}</span>
                  <span>hoje</span>
                </div>
              </div>
            </section>

            {/* Top users */}
            <section className="crm-card">
              <CardHead title="Top usuários ativos · 30d" sub={`Clique no cabeçalho para ordenar · top ${(act?.topUsers ?? []).length}`} />
              {sortedTopUsers.length > 0 ? (
                <table className="crm-tbl">
                  <thead>
                    <tr>
                      <SortableTh label="#" sortKey="index" align="left" current={topUsersSort} onToggle={toggleTopUsersSort} />
                      <SortableTh label="Usuário" sortKey="user" align="left" current={topUsersSort} onToggle={toggleTopUsersSort} />
                      <SortableTh label="Calls IA" sortKey="calls" align="right" current={topUsersSort} onToggle={toggleTopUsersSort} />
                      <SortableTh label="Features" sortKey="features" align="right" current={topUsersSort} onToggle={toggleTopUsersSort} />
                      <SortableTh label="Última atividade" sortKey="lastUsed" align="left" current={topUsersSort} onToggle={toggleTopUsersSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTopUsers.map((u, i) => (
                      <tr key={u.user_id}>
                        <td className="muted crm-mono" style={{ fontSize: 11 }}>{i + 1}</td>
                        <td>
                          <div className="lead-name">{u.name ?? u.email}</div>
                          {u.name && <div className="lead-email">{u.email}</div>}
                        </td>
                        <td className="num"><strong style={{ color: "var(--crm-green-deep)" }}>{fmt(u.calls)}</strong></td>
                        <td className="num">{u.features}</td>
                        <td className="muted">{fmtRelative(u.lastUsed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 32, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>Nenhuma chamada de IA em <code>generation_logs</code> nos últimos 30d.</div>
              )}
            </section>

            {/* Top features */}
            <section className="crm-card">
              <CardHead title="Uso por feature · 30d" sub="Quais features de IA são mais usadas" />
              {(act?.topFeatures ?? []).length > 0 ? (
                <div className="crm-card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(act?.topFeatures ?? []).map((f) => {
                    const max = (act?.topFeatures ?? [])[0]?.calls ?? 1;
                    const pct = (f.calls / max) * 100;
                    return (
                      <div key={f.name}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: "var(--crm-ink-2)" }}>{FEATURE_LABELS[f.name] ?? f.name}</span>
                          <span className="crm-mono" style={{ fontSize: 12, color: "var(--crm-ink)", fontWeight: 700 }}>{fmt(f.calls)} <span style={{ fontWeight: 400, color: "var(--crm-ink-4)" }}>· {f.users} users</span></span>
                        </div>
                        <div style={{ height: 14, background: "var(--crm-surface-3)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.max(pct, 2)}%`, background: "var(--crm-green-deep)", borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: 32, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>Sem chamadas em generation_logs.</div>
              )}
            </section>

            {/* Custos de IA · breakdown por feature */}
            <section className="crm-card">
              <CardHead
                title="Custo estimado de IA · 30d"
                sub={`Baseado em tokens médios por chamada × preços Claude Opus 5 · câmbio USD ${USD_BRL.toFixed(2)} BRL`}
              />
              {costStats.byFunction.length > 0 ? (
                <table className="crm-tbl">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th style={{ textAlign: "right" }}>Chamadas</th>
                      <th style={{ textAlign: "right" }}>Usuários</th>
                      <th style={{ textAlign: "right" }}>Custo unitário</th>
                      <th style={{ textAlign: "right" }}>Custo total</th>
                      <th style={{ textAlign: "right" }}>% do total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costStats.byFunction.map((f) => {
                      const pct = costStats.totalBrl > 0 ? (f.brl / costStats.totalBrl) * 100 : 0;
                      return (
                        <tr key={f.name}>
                          <td>{FEATURE_LABELS[f.name] ?? f.name}</td>
                          <td className="num">{fmt(f.calls)}</td>
                          <td className="num muted">{f.users}</td>
                          <td className="num muted">R$ {f.unitBrl.toFixed(3)}</td>
                          <td className="num"><strong style={{ color: "var(--crm-green-deep)" }}>R$ {f.brl.toFixed(2)}</strong></td>
                          <td className="num muted">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: "2px solid var(--crm-border)", fontWeight: 700 }}>
                      <td>Total</td>
                      <td className="num">{fmt(costStats.totalCalls)}</td>
                      <td></td>
                      <td className="num muted">R$ {costStats.avgPerCallBrl.toFixed(3)} médio</td>
                      <td className="num" style={{ color: "var(--crm-green-deep)" }}>R$ {costStats.totalBrl.toFixed(2)}</td>
                      <td className="num">100%</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 32, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>
                  Sem chamadas em <code>generation_logs</code> nos últimos 30d.
                </div>
              )}
              <div style={{ padding: "12px 20px", fontSize: 11, color: "var(--crm-ink-4)", borderTop: "1px solid var(--crm-border)", lineHeight: 1.5 }}>
                ⚠️ <strong>Estimativa</strong> — sem token logs por chamada, usamos médias por function_name (5500 in + 12000 out pra fechamento, 3500 + 1500 pra chat, etc.). Para custo exato, use o Usage & Cost do console da Anthropic ou logue <code>usage.input_tokens/output_tokens</code> por chamada nas edge functions.
              </div>
            </section>

            {/* Streaks */}
            <section className="crm-card">
              <CardHead title="Top streaks ativos" sub="user_progression · ordenado por streak_days" />
              {(streaks ?? []).length > 0 ? (
                <table className="crm-tbl">
                  <thead><tr><th>#</th><th>Usuário</th><th style={{ textAlign: "right" }}>Streak atual</th><th style={{ textAlign: "right" }}>Melhor</th><th style={{ textAlign: "right" }}>XP</th><th style={{ textAlign: "right" }}>Lvl</th><th>Última ativ.</th></tr></thead>
                  <tbody>
                    {(streaks ?? []).slice(0, 20).map((u: any, i) => (
                      <tr key={u.user_id}>
                        <td className="muted crm-mono" style={{ fontSize: 11 }}>{i + 1}</td>
                        <td>
                          <div className="lead-name">{u.name ?? u.email}</div>
                          {u.name && <div className="lead-email">{u.email}</div>}
                        </td>
                        <td className="num"><strong style={{ color: u.streak_days >= 7 ? "var(--crm-green-deep)" : "var(--crm-ink)" }}>{u.streak_days}</strong> dias</td>
                        <td className="num muted">{u.best_streak}d</td>
                        <td className="num">{fmt(u.total_xp ?? 0)}</td>
                        <td className="num muted">{u.level ?? 1}</td>
                        <td className="muted">{u.last_activity_date ? new Date(u.last_activity_date).toLocaleDateString("pt-BR") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 32, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>Sem registros em user_progression.</div>
              )}
            </section>

            {/* UTM (mantido — análise de aquisição) */}
            {(utm ?? []).length > 0 && (
              <section className="crm-card">
                <CardHead title="UTM breakdown · aquisição" sub={`${(utm ?? []).length} fontes`} />
                <table className="crm-tbl">
                  <thead><tr><th>Fonte</th><th style={{ textAlign: "right" }}>Leads</th><th style={{ textAlign: "right" }}>Subscribers</th><th style={{ textAlign: "right" }}>Conv.</th><th style={{ textAlign: "right" }}>Score médio</th></tr></thead>
                  <tbody>
                    {(utm ?? []).slice().sort((a: any, b: any) => b.leads - a.leads).map((u: any) => {
                      const conv = u.leads > 0 ? Math.round((u.subscribers / u.leads) * 100) : 0;
                      const avgScore = u.leads > 0 ? Math.round(u.total_score / u.leads) : 0;
                      return (
                        <tr key={u.source}>
                          <td className="lead-name"><code style={{ background: "var(--crm-surface-2)", padding: "2px 6px", borderRadius: 3, fontFamily: "var(--crm-mono)", fontSize: 12 }}>{u.source}</code></td>
                          <td className="num">{fmt(u.leads)}</td>
                          <td className="num">{fmt(u.subscribers)}</td>
                          <td className="num"><span style={{ color: conv >= 10 ? "var(--crm-green-deep)" : "var(--crm-ink)", fontWeight: 700 }}>{conv}%</span></td>
                          <td className="num">{avgScore}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}
      </main>
    </CrmShellV3>
  );
}

/* =========================================================
   USERS — usuários da plataforma (alunos) via crm-auth list_users
   ========================================================= */
interface PlatformUser {
  user_id: string;
  email: string;
  full_name?: string;
  phone?: string | null;
  created_at: string;
  subscription?: {
    status: string;
    plan_type: string;
    access_expires_at: string | null;
  };
}

function usePlatformUsers() {
  return useQuery({
    queryKey: ["crm", "platform-users"],
    queryFn: async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-auth`;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const token = localStorage.getItem("crm_token");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": apiKey,
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ action: "list_users", token }),
      });
      if (!res.ok) return [];
      const json = await res.json();
      const profiles: any[] = json.profiles ?? [];
      const subs: any[] = json.subscriptions ?? [];
      const subMap: Record<string, any> = {};
      subs.forEach((s) => { subMap[s.user_id] = s; });

      return profiles.map((p) => ({
        user_id: p.user_id,
        email: p.email,
        full_name: p.full_name,
        phone: p.phone,
        created_at: p.created_at,
        subscription: subMap[p.user_id] ? {
          status: subMap[p.user_id].status,
          plan_type: subMap[p.user_id].plan_type,
          access_expires_at: subMap[p.user_id].access_expires_at,
        } : undefined,
      })) as PlatformUser[];
    },
  });
}

type AccessDuration = "unlimited" | "4h" | "1d" | "3d" | "7d" | "15d" | "30d";
const DURATION_LABELS: Record<AccessDuration, string> = {
  unlimited: "Ilimitado", "4h": "4 horas", "1d": "1 dia",
  "3d": "3 dias", "7d": "7 dias", "15d": "15 dias", "30d": "30 dias",
};

function expiresFor(d: AccessDuration): string | null {
  if (d === "unlimited") return null;
  const ms: Record<string, number> = {
    "4h": 4 * 3600000, "1d": 86400000, "3d": 3 * 86400000,
    "7d": 7 * 86400000, "15d": 15 * 86400000, "30d": 30 * 86400000,
  };
  return new Date(Date.now() + ms[d]).toISOString();
}

async function callCrmAction(action: string, payload: Record<string, unknown>) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-admin-actions`;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const token = localStorage.getItem("crm_token");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apiKey, "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ action, token, ...payload }),
  });
  return res.json();
}

function useGrantAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { user_id: string; duration: AccessDuration }) => {
      const result = await callCrmAction("grant_access", {
        user_id: p.user_id,
        plan_type: "free_access",
        access_expires_at: expiresFor(p.duration),
      });
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "platform-users"] }),
  });
}

function useRevokeAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (user_id: string) => {
      const result = await callCrmAction("revoke_access", { user_id });
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "platform-users"] }),
  });
}

function fmtRemaining(iso: string | null): string {
  if (!iso) return "ilimitado";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "expirado";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function UsersV3() {
  const { data: users, isLoading } = usePlatformUsers();
  const grant = useGrantAccess();
  const revoke = useRevokeAccess();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paying" | "free" | "none">("all");
  const [durationFor, setDurationFor] = useState<Record<string, AccessDuration>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const lista = users ?? [];

  const isExpired = (sub?: PlatformUser["subscription"]) => {
    if (!sub?.access_expires_at) return false;
    return new Date(sub.access_expires_at) < new Date();
  };

  const isActive = (u: PlatformUser) =>
    u.subscription && u.subscription.status === "active" && !isExpired(u.subscription);

  const stats = {
    total: lista.length,
    paying: lista.filter((u) => isActive(u) && (u.subscription!.plan_type === "monthly" || u.subscription!.plan_type === "annual" || u.subscription!.plan_type === "biannual")).length,
    free: lista.filter((u) => isActive(u) && u.subscription!.plan_type === "free_access").length,
    none: lista.filter((u) => !isActive(u)).length,
  };

  const filtered = lista.filter((u) => {
    if (search) {
      const s = search.toLowerCase();
      if (!u.email.toLowerCase().includes(s) && !(u.full_name ?? "").toLowerCase().includes(s)) return false;
    }
    if (filter === "paying") return isActive(u) && (u.subscription!.plan_type === "monthly" || u.subscription!.plan_type === "annual" || u.subscription!.plan_type === "biannual");
    if (filter === "free") return isActive(u) && u.subscription!.plan_type === "free_access";
    if (filter === "none") return !isActive(u);
    return true;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const planLabel = (pt?: string) => {
    if (!pt) return "—";
    return PLAN_LABEL[pt] ?? pt;
  };

  const statusTag = (u: PlatformUser) => {
    const sub = u.subscription;
    if (!isActive(u)) {
      if (sub?.access_expires_at && isExpired(sub)) {
        return <span className="crm-tag crm-tag-gray"><span className="crm-tag-dot" />Expirado</span>;
      }
      return <span className="crm-tag crm-tag-gray"><span className="crm-tag-dot" />Sem acesso</span>;
    }
    if (sub!.plan_type === "free_access") {
      return <span className="crm-tag crm-tag-warn"><span className="crm-tag-dot" />Gratuito</span>;
    }
    return <span className={`crm-tag crm-tag-${PLAN_TAG[sub!.plan_type] ?? "gray"}`}><span className="crm-tag-dot" />{planLabel(sub!.plan_type)}</span>;
  };

  const handleGrant = async (uid: string) => {
    const dur = durationFor[uid] ?? "30d";
    setBusy(uid);
    try { await grant.mutateAsync({ user_id: uid, duration: dur }); } finally { setBusy(null); }
  };

  const handleRevoke = async (uid: string) => {
    if (!confirm("Revogar acesso deste usuário?")) return;
    setBusy(uid);
    try { await revoke.mutateAsync(uid); } finally { setBusy(null); }
  };

  return (
    <CrmShellV3 mode="marketing" crumbs={[{ label: "CRM" }, { label: "Marketing" }, { label: "Usuários" }]}>
      <main className="crm-page">
        <PageHero
          eyebrow="Sistema · Gestão de usuários"
          title={<>{fmt(stats.total)} usuários <em>cadastrados</em></>}
          sub="Lista real de alunos da plataforma cruzada com subscriptions ativas. Conceda ou revogue acesso gratuito direto da tabela."
        />

        <section className="crm-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Kpi label="Total" value={fmt(stats.total)} deltaText="usuários cadastrados" accent="mrr" />
          <Kpi label="Pagantes" value={fmt(stats.paying)} deltaText="ativos · monthly+annual+biannual" />
          <Kpi label="Gratuitos ativos" value={fmt(stats.free)} deltaText="free_access dentro do prazo" accent="warn" />
          <Kpi label="Sem acesso" value={fmt(stats.none)} deltaText="inativos ou expirados" />
        </section>

        <section className="crm-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--crm-surface-2)", borderBottom: "1px solid var(--crm-line)", flexWrap: "wrap" }}>
            <input
              placeholder="Buscar por email ou nome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: "var(--crm-surface)",
                border: "1px solid var(--crm-line)",
                borderRadius: 6,
                padding: "6px 10px",
                fontFamily: "var(--crm-text)",
                fontSize: 12.5,
                flex: 1, minWidth: 200, maxWidth: 320,
              }}
            />
            <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
              {[
                { key: "all" as const, label: "Todos", count: stats.total },
                { key: "paying" as const, label: "Pagantes", count: stats.paying },
                { key: "free" as const, label: "Gratuitos", count: stats.free },
                { key: "none" as const, label: "Sem acesso", count: stats.none },
              ].map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={filter === f.key ? "crm-btn crm-btn-primary" : "crm-btn crm-btn-ghost"}
                  style={{ fontSize: 12 }}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--crm-ink-4)" }}>
              <Loader2 className="animate-spin" style={{ display: "inline-block", color: "var(--crm-green-deep)" }} />
            </div>
          ) : filtered.length > 0 ? (
            <table className="crm-tbl">
              <thead><tr><th>Usuário</th><th>Status</th><th>Plano</th><th>Tempo restante</th><th>Cadastro</th><th style={{ textAlign: "right" }}>Ação</th></tr></thead>
              <tbody>
                {filtered.slice(0, 100).map((u) => {
                  const active = isActive(u);
                  const sub = u.subscription;
                  const dur = durationFor[u.user_id] ?? "30d";
                  const isBusy = busy === u.user_id;
                  return (
                    <tr key={u.user_id}>
                      <td>
                        <div className="lead-name">{u.full_name ?? "—"}</div>
                        <div className="lead-email">{u.email}</div>
                      </td>
                      <td>{statusTag(u)}</td>
                      <td className="muted">{planLabel(sub?.plan_type)}</td>
                      <td>
                        {active && sub?.plan_type === "free_access" ? (
                          <span className="crm-mono" style={{
                            fontSize: 12,
                            color: sub.access_expires_at && new Date(sub.access_expires_at).getTime() - Date.now() < 86400000 ? "var(--crm-neg)" : "var(--crm-green-deep)",
                            fontWeight: 600,
                          }}>{fmtRemaining(sub.access_expires_at)}</span>
                        ) : active && sub ? (
                          <span className="crm-mono" style={{ fontSize: 12, color: "var(--crm-ink-3)" }}>
                            {sub.access_expires_at ? new Date(sub.access_expires_at).toLocaleDateString("pt-BR") : "ilimitado"}
                          </span>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td className="muted">{u.created_at ? new Date(u.created_at).toLocaleDateString("pt-BR") : "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          {active && sub?.plan_type === "free_access" ? (
                            <button
                              onClick={() => handleRevoke(u.user_id)}
                              disabled={isBusy}
                              className="crm-btn crm-btn-ghost"
                              style={{ fontSize: 11, color: "var(--crm-neg)" }}
                            >
                              {isBusy ? <Loader2 size={11} className="animate-spin" /> : <UserX size={11} />} Revogar
                            </button>
                          ) : !active ? (
                            <>
                              <select
                                value={dur}
                                onChange={(e) => setDurationFor((prev) => ({ ...prev, [u.user_id]: e.target.value as AccessDuration }))}
                                style={{
                                  background: "var(--crm-surface)", border: "1px solid var(--crm-line)",
                                  borderRadius: 4, padding: "3px 6px", fontSize: 11, fontFamily: "var(--crm-mono)",
                                }}
                              >
                                {(Object.keys(DURATION_LABELS) as AccessDuration[]).map((k) => (
                                  <option key={k} value={k}>{DURATION_LABELS[k]}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleGrant(u.user_id)}
                                disabled={isBusy}
                                className="crm-btn crm-btn-primary"
                                style={{ fontSize: 11 }}
                              >
                                {isBusy ? <Loader2 size={11} className="animate-spin" /> : <Gift size={11} />} Liberar
                              </button>
                            </>
                          ) : (
                            <span className="muted crm-mono" style={{ fontSize: 11 }}>plano pago</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>
              {lista.length === 0
                ? "Sem usuários retornados pela função crm-auth."
                : "Sem usuários para o filtro/busca atual."}
            </div>
          )}
          {filtered.length > 100 && (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--crm-ink-4)", textAlign: "center", borderTop: "1px solid var(--crm-line)" }}>
              Exibindo primeiros 100 de {filtered.length}. Use a busca para refinar.
            </div>
          )}
        </section>
      </main>
    </CrmShellV3>
  );
}

/* =========================================================
   SUPORTE — dados reais do widget de suporte ao aluno.
   Lê feedbacks, NPS, CSAT e o histórico completo de conversas
   + mensagens (support_conversations / support_messages),
   inclusive as recebidas antes desta aba ser ativada.
   Admin enxerga tudo via RLS has_role(admin) — migration
   20260411020000_admin_can_view_support_data.sql
   ========================================================= */
type SupFeedback = { id: string; user_id: string; category: string; title: string | null; content: string; page_url: string | null; status: string; created_at: string };
type SupNps = { id: string; user_id: string; score: number; category: "promoter" | "passive" | "detractor"; comment: string | null; created_at: string };
type SupCsat = { id: string; user_id: string; conversation_id: string | null; rating: number; comment: string | null; resolved: boolean | null; created_at: string };
type SupConversation = { id: string; user_id: string; subject: string | null; status: string; created_at: string; updated_at: string; closed_at: string | null };
type SupMessage = { id: string; conversation_id: string; user_id: string; role: string; content: string; created_at: string };
type SupProfile = { email?: string; full_name?: string };

const SUP_PERIODS: { label: string; days: number | null }[] = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "Tudo", days: null },
];

const FB_CATEGORY_LABEL: Record<string, string> = {
  general: "Geral", bug: "Bug", improvement: "Melhoria", feature_request: "Nova feature",
  ui_ux: "UI/UX", content: "Conteúdo", performance: "Performance", other: "Outro",
};
const FB_CATEGORY_TAG: Record<string, string> = {
  bug: "crm-tag-red", improvement: "crm-tag-blue", feature_request: "crm-tag-gold",
  ui_ux: "crm-tag-warn", content: "crm-tag-green", performance: "crm-tag-warn",
  general: "crm-tag-gray", other: "crm-tag-gray",
};

// Estilos reaproveitados (tokens do design system v3)
const supEyebrow: CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--crm-gold-deep)", marginBottom: 8 };
const supItemCard: CSSProperties = { border: "1px solid var(--crm-line)", borderRadius: "var(--crm-radius-sm)", padding: "10px 12px", background: "var(--crm-surface-2)" };
const supThemeCard: CSSProperties = { border: "1px solid var(--crm-line)", borderRadius: "var(--crm-radius-sm)", padding: 12, background: "var(--crm-surface-2)" };
const supLoading: CSSProperties = { padding: 40, textAlign: "center" };
const supEmpty: CSSProperties = { padding: 32, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 };
const supQuote: CSSProperties = { fontSize: 12, color: "var(--crm-ink-3)", fontStyle: "italic", lineHeight: 1.5, margin: 0 };
const supErr: CSSProperties = { marginBottom: 12, padding: "9px 11px", background: "var(--crm-neg-soft)", border: "1px solid var(--crm-neg)", borderRadius: "var(--crm-radius-sm)", fontSize: 12, color: "var(--crm-neg)" };
const supList: CSSProperties = { margin: 0, paddingLeft: 16, display: "grid", gap: 4, fontSize: 12.5, color: "var(--crm-ink-2)", lineHeight: 1.5 };
const supConvBtn: CSSProperties = { width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" };
const supSelect: CSSProperties = { fontSize: 12, background: "var(--crm-surface)", border: "1px solid var(--crm-line-strong)", borderRadius: "var(--crm-radius-sm)", padding: "5px 8px", color: "var(--crm-ink-2)" };

function useSupportData(periodDays: number | null) {
  return useQuery({
    queryKey: ["crm", "support-data", periodDays],
    queryFn: async () => {
      const since = periodDays ? new Date(Date.now() - periodDays * 86400000).toISOString() : null;
      const sel = (table: string, cols: string, lim: number) => {
        let q: any = (supabase.from(table as any) as any).select(cols);
        if (since) q = q.gte("created_at", since);
        return q.order("created_at", { ascending: false }).limit(lim);
      };

      const [fbRes, npsRes, csatRes, convRes] = await Promise.all([
        sel("support_feedback", "id, user_id, category, title, content, page_url, status, created_at", 300),
        sel("nps_responses", "id, user_id, score, category, comment, created_at", 500),
        sel("csat_responses", "id, user_id, conversation_id, rating, comment, resolved, created_at", 500),
        sel("support_conversations", "id, user_id, subject, status, created_at, updated_at, closed_at", 200),
      ]);

      const feedbacks = (fbRes.data ?? []) as SupFeedback[];
      const nps = (npsRes.data ?? []) as SupNps[];
      const csat = (csatRes.data ?? []) as SupCsat[];
      const conversations = (convRes.data ?? []) as SupConversation[];

      // Mensagens das conversas do período (histórico completo do chat de suporte)
      let messages: SupMessage[] = [];
      const convIds = conversations.map((c) => c.id);
      if (convIds.length > 0) {
        const { data: msgData } = await (supabase.from("support_messages" as any) as any)
          .select("id, conversation_id, user_id, role, content, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: true })
          .limit(3000);
        messages = (msgData ?? []) as SupMessage[];
      }

      // Resolve identidade (profiles) de todos os user_ids envolvidos
      const userIds = Array.from(new Set([
        ...feedbacks.map((f) => f.user_id),
        ...conversations.map((c) => c.user_id),
        ...nps.map((n) => n.user_id),
        ...csat.map((c) => c.user_id),
      ].filter(Boolean)));
      const profMap: Record<string, SupProfile> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", userIds);
        (profiles ?? []).forEach((p: any) => { profMap[p.user_id] = { email: p.email, full_name: p.full_name }; });
      }

      const messagesByConv: Record<string, SupMessage[]> = {};
      for (const m of messages) {
        if (!messagesByConv[m.conversation_id]) messagesByConv[m.conversation_id] = [];
        messagesByConv[m.conversation_id].push(m);
      }

      return { feedbacks, nps, csat, conversations, messagesByConv, profMap };
    },
    refetchInterval: 120_000,
  });
}

export function SuporteV3() {
  const [period, setPeriod] = useState<number | null>(null); // null = Tudo → mostra o histórico completo por padrão
  const { data, isLoading } = useSupportData(period);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [summary, setSummary] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const feedbacks = data?.feedbacks ?? [];
  const nps = data?.nps ?? [];
  const csat = data?.csat ?? [];
  const conversations = data?.conversations ?? [];
  const messagesByConv = data?.messagesByConv ?? {};
  const profMap = data?.profMap ?? {};

  const who = (uid: string) => profMap[uid]?.full_name || profMap[uid]?.email || "Aluno";
  const whoEmail = (uid: string) => profMap[uid]?.email || "";

  const npsMetrics = useMemo(() => {
    const total = nps.length;
    if (!total) return { score: 0, promoters: 0, passives: 0, detractors: 0, total: 0 };
    const promoters = nps.filter((n) => n.category === "promoter").length;
    const passives = nps.filter((n) => n.category === "passive").length;
    const detractors = nps.filter((n) => n.category === "detractor").length;
    return { score: Math.round(((promoters - detractors) / total) * 100), promoters, passives, detractors, total };
  }, [nps]);

  const csatMetrics = useMemo(() => {
    const total = csat.length;
    if (!total) return { avg: 0, satisfied: 0, resolved: 0, total: 0 };
    const avg = csat.reduce((s, c) => s + c.rating, 0) / total;
    const satisfied = csat.filter((c) => c.rating >= 4).length;
    const resolved = csat.filter((c) => c.resolved === true).length;
    return { avg: Math.round(avg * 10) / 10, satisfied, resolved, total };
  }, [csat]);

  const categoryCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    feedbacks.forEach((f) => { acc[f.category] = (acc[f.category] ?? 0) + 1; });
    return acc;
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(
    () => (categoryFilter === "all" ? feedbacks : feedbacks.filter((f) => f.category === categoryFilter)),
    [feedbacks, categoryFilter]
  );

  const abertos = conversations.filter((c) => c.status === "open").length;
  const activeLabel = SUP_PERIODS.find((p) => p.days === period)?.label ?? "Tudo";

  const generateSummary = async (refresh = false) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-feedback-summary`);
      url.searchParams.set("days", String(period ?? 3650));
      if (refresh) url.searchParams.set("refresh", "1");
      const resp = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error ?? "Erro ao gerar resumo");
      const raw = json.summary;
      let themes: any[] = [];
      if (raw?.detailed_summary) {
        try { themes = JSON.parse(raw.detailed_summary).top_themes ?? []; } catch { themes = raw.top_themes ?? []; }
      } else {
        themes = raw?.top_themes ?? [];
      }
      setSummary({ ...raw, top_themes: themes });
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "Erro ao gerar resumo");
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <CrmShellV3 mode="marketing" crumbs={[{ label: "CRM" }, { label: "Marketing" }, { label: "Suporte" }]}>
      <main className="crm-page">
        <PageHero
          eyebrow="Marketing · Suporte ao aluno"
          title={<>Suporte <em>& Feedback</em></>}
          sub="NPS, CSAT, feedbacks e histórico completo das conversas do widget de suporte — inclui mensagens recebidas antes desta aba ser ativada."
          actions={
            <PeriodBar
              options={SUP_PERIODS.map((p) => p.label)}
              active={activeLabel}
              onChange={(l) => setPeriod(SUP_PERIODS.find((p) => p.label === l)?.days ?? null)}
            />
          }
        />

        {/* KPIs */}
        <section className="crm-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Kpi label="NPS Score" value={isLoading ? "—" : npsMetrics.score} accent={npsMetrics.score >= 50 ? "mrr" : npsMetrics.score >= 0 ? "warn" : "neg"} deltaText={`${npsMetrics.total} respostas`} />
          <Kpi label="CSAT médio" value={isLoading ? "—" : csatMetrics.avg.toFixed(1)} unit="/5" deltaText={`${csatMetrics.total} avaliações`} />
          <Kpi label="Feedbacks" value={isLoading ? "—" : feedbacks.length} deltaText="sugestões recebidas" />
          <Kpi label="Conversas" value={isLoading ? "—" : conversations.length} accent={abertos > 0 ? "warn" : undefined} deltaText={`${abertos} abertas`} />
        </section>

        {/* Resumo IA dos feedbacks */}
        <section className="crm-card">
          <CardHead
            title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Sparkles size={15} style={{ color: "var(--crm-gold-deep)" }} /> Resumo inteligente dos feedbacks</span>}
            sub="Análise gerada por PreceptorMED (Claude) dos temas mais pedidos"
            side={
              summary ? (
                <button className="crm-btn crm-btn-ghost" onClick={() => generateSummary(true)} disabled={summaryLoading}>
                  <RefreshCw size={13} className={summaryLoading ? "animate-spin" : ""} /> Regenerar
                </button>
              ) : (
                <button className="crm-btn crm-btn-primary" onClick={() => generateSummary(false)} disabled={summaryLoading || feedbacks.length === 0}>
                  {summaryLoading ? <><Loader2 size={13} className="animate-spin" /> Gerando…</> : <><Sparkles size={13} /> Gerar resumo</>}
                </button>
              )
            }
          />
          {summaryError && <div style={supErr}>{summaryError}</div>}
          {!summary && !summaryLoading && (
            <div style={{ padding: "24px 8px", textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>
              {feedbacks.length === 0 ? "Nenhum feedback no período selecionado." : `Clique em "Gerar resumo" para analisar os ${feedbacks.length} feedbacks.`}
            </div>
          )}
          {summary && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={supEyebrow}>Resumo executivo</div>
                <p style={{ fontSize: 13.5, color: "var(--crm-ink-2)", lineHeight: 1.6, margin: 0 }}>{summary.executive_summary}</p>
                <div style={{ fontSize: 11, color: "var(--crm-ink-4)", marginTop: 6 }}>
                  Gerado em {summary.generated_at ? new Date(summary.generated_at).toLocaleString("pt-BR") : "—"} · {summary.total_feedbacks} feedbacks
                </div>
              </div>
              {summary.top_themes?.length > 0 && (
                <div>
                  <div style={supEyebrow}>Top temas pedidos</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {summary.top_themes.map((t: any, i: number) => (
                      <div key={i} style={supThemeCard}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, color: "var(--crm-gold-deep)", fontSize: 12 }}>#{i + 1}</span>
                          <span style={{ fontWeight: 600, color: "var(--crm-ink)", fontSize: 13 }}>{t.theme}</span>
                          <span className={`crm-tag ${FB_CATEGORY_TAG[t.category] ?? "crm-tag-gray"}`}><span className="crm-tag-dot" />{FB_CATEGORY_LABEL[t.category] ?? t.category}</span>
                          <span className="muted" style={{ marginLeft: "auto", fontWeight: 700 }}>{t.mentions}×</span>
                        </div>
                        {t.quotes?.length > 0 && (
                          <div style={{ marginTop: 6, display: "grid", gap: 3 }}>
                            {t.quotes.map((q: string, qi: number) => (
                              <p key={qi} style={{ fontSize: 12, color: "var(--crm-ink-3)", fontStyle: "italic", borderLeft: "2px solid var(--crm-line-strong)", paddingLeft: 8, margin: 0 }}>"{q}"</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {summary.detailed_summary && (() => {
                let parsed: any;
                try { parsed = JSON.parse(summary.detailed_summary); } catch { return null; }
                return (
                  <div className="crm-suporte-grid">
                    {parsed.recommended_actions?.length > 0 && (
                      <div style={supThemeCard}>
                        <div style={{ ...supEyebrow, color: "var(--crm-info)" }}>Ações recomendadas</div>
                        <ul style={supList}>{parsed.recommended_actions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
                      </div>
                    )}
                    {parsed.quick_wins?.length > 0 && (
                      <div style={supThemeCard}>
                        <div style={{ ...supEyebrow, color: "var(--crm-pos)" }}>Quick wins</div>
                        <ul style={supList}>{parsed.quick_wins.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </section>

        {/* Histórico de conversas + mensagens */}
        <section className="crm-card">
          <CardHead title="Conversas de suporte" sub={`${conversations.length} conversas · clique para abrir o histórico de mensagens`} />
          {isLoading ? (
            <div style={supLoading}><Loader2 className="animate-spin" style={{ color: "var(--crm-green-deep)" }} /></div>
          ) : conversations.length === 0 ? (
            <div style={supEmpty}>Nenhuma conversa de suporte no período.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {conversations.map((c) => {
                const msgs = messagesByConv[c.id] ?? [];
                const open = expanded === c.id;
                const email = whoEmail(c.user_id);
                const name = who(c.user_id);
                return (
                  <div key={c.id} style={{ border: "1px solid var(--crm-line)", borderRadius: "var(--crm-radius)", overflow: "hidden", background: "var(--crm-surface)" }}>
                    <button onClick={() => setExpanded(open ? null : c.id)} style={supConvBtn}>
                      <ChevronDown size={15} style={{ color: "var(--crm-ink-4)", transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform .15s", flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="lead-name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.subject || "(sem assunto)"}</div>
                        <div className="lead-email">{name}{email && email !== name ? ` · ${email}` : ""}</div>
                      </div>
                      <span className="muted" style={{ flexShrink: 0 }}>{msgs.length} msg</span>
                      <span className={`crm-tag ${c.status === "resolved" ? "crm-tag-green" : c.status === "escalated" ? "crm-tag-red" : "crm-tag-warn"}`} style={{ flexShrink: 0 }}>
                        <span className="crm-tag-dot" />{c.status === "resolved" ? "resolvido" : c.status === "escalated" ? "escalado" : "aberto"}
                      </span>
                      <span className="muted" style={{ flexShrink: 0 }}>{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                    </button>
                    {open && (
                      <div style={{ borderTop: "1px solid var(--crm-line)", padding: 14, background: "var(--crm-surface-2)", display: "grid", gap: 8 }}>
                        {msgs.length === 0 ? (
                          <div className="muted" style={{ textAlign: "center", padding: 8 }}>Sem mensagens registradas nesta conversa.</div>
                        ) : msgs.map((m) => (
                          <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-start" : "flex-end" }}>
                            <div style={{ maxWidth: "80%", borderRadius: 10, padding: "8px 11px", fontSize: 12.5, lineHeight: 1.5, background: m.role === "user" ? "var(--crm-surface)" : "var(--crm-green-soft)", color: "var(--crm-ink-2)", border: "1px solid var(--crm-line)" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: m.role === "user" ? "var(--crm-ink-4)" : "var(--crm-green-deep)", marginBottom: 2 }}>{m.role === "user" ? "Aluno" : "Suporte IA"}</div>
                              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                              <div style={{ fontSize: 10, color: "var(--crm-ink-5)", marginTop: 3 }}>{new Date(m.created_at).toLocaleString("pt-BR")}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Feedbacks + NPS/CSAT */}
        <div className="crm-suporte-grid">
          <section className="crm-card">
            <CardHead
              title="Feedbacks recebidos"
              sub={`${filteredFeedbacks.length} no filtro atual`}
              side={
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={supSelect}>
                  <option value="all">Todas categorias ({feedbacks.length})</option>
                  {Object.entries(FB_CATEGORY_LABEL).map(([k, l]) => {
                    const n = categoryCounts[k] ?? 0;
                    return n > 0 ? <option key={k} value={k}>{l} ({n})</option> : null;
                  })}
                </select>
              }
            />
            {isLoading ? (
              <div style={supLoading}><Loader2 className="animate-spin" style={{ color: "var(--crm-green-deep)" }} /></div>
            ) : filteredFeedbacks.length === 0 ? (
              <div style={supEmpty}>Nenhum feedback neste período.</div>
            ) : (
              <div style={{ display: "grid", gap: 8, maxHeight: 560, overflowY: "auto" }}>
                {filteredFeedbacks.map((f) => (
                  <div key={f.id} style={supItemCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span className={`crm-tag ${FB_CATEGORY_TAG[f.category] ?? "crm-tag-gray"}`}><span className="crm-tag-dot" />{FB_CATEGORY_LABEL[f.category] ?? f.category}</span>
                      {f.title && <span style={{ fontWeight: 600, fontSize: 12.5, color: "var(--crm-ink)" }}>{f.title}</span>}
                      <span className="muted" style={{ marginLeft: "auto" }}>{new Date(f.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: "var(--crm-ink-3)", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>{f.content}</p>
                    <div style={{ fontSize: 11, color: "var(--crm-ink-4)", marginTop: 5 }}>{who(f.user_id)}{f.page_url ? ` · ${f.page_url}` : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div style={{ display: "grid", gap: 16 }}>
            <section className="crm-card">
              <CardHead title="NPS · comentários" sub={`${npsMetrics.promoters} 🟢  ${npsMetrics.passives} 🟡  ${npsMetrics.detractors} 🔴`} />
              {nps.filter((n) => n.comment).length === 0 ? (
                <div style={supEmpty}>Sem comentários.</div>
              ) : (
                <div style={{ display: "grid", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                  {nps.filter((n) => n.comment).slice(0, 40).map((n) => (
                    <div key={n.id} style={supItemCard}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span className={`crm-tag ${n.category === "promoter" ? "crm-tag-green" : n.category === "passive" ? "crm-tag-warn" : "crm-tag-red"}`}>{n.score}</span>
                        <span className="muted" style={{ marginLeft: "auto" }}>{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p style={supQuote}>"{n.comment}"</p>
                      <div style={{ fontSize: 11, color: "var(--crm-ink-4)", marginTop: 4 }}>{who(n.user_id)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="crm-card">
              <CardHead title="CSAT · comentários" sub={`${csatMetrics.satisfied} satisfeitos · ${csatMetrics.resolved} resolvidos`} />
              {csat.filter((c) => c.comment).length === 0 ? (
                <div style={supEmpty}>Sem comentários.</div>
              ) : (
                <div style={{ display: "grid", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                  {csat.filter((c) => c.comment).slice(0, 40).map((c) => (
                    <div key={c.id} style={supItemCard}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ color: "var(--crm-gold-deep)", fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>
                          {"★".repeat(c.rating)}<span style={{ color: "var(--crm-line-strong)" }}>{"★".repeat(5 - c.rating)}</span>
                        </span>
                        {c.resolved === true && <span className="crm-tag crm-tag-green">resolvido</span>}
                        {c.resolved === false && <span className="crm-tag crm-tag-warn">escalado</span>}
                        <span className="muted" style={{ marginLeft: "auto" }}>{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p style={supQuote}>"{c.comment}"</p>
                      <div style={{ fontSize: 11, color: "var(--crm-ink-4)", marginTop: 4 }}>{who(c.user_id)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Nota de escalonamento */}
        <section style={{ border: "1px solid var(--crm-line-strong)", background: "var(--crm-gold-soft)", borderRadius: "var(--crm-radius)", padding: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Mail size={15} style={{ color: "var(--crm-gold-deep)", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12.5, color: "var(--crm-ink-3)", lineHeight: 1.5 }}>
            Quando o suporte IA não resolve, o aluno é direcionado para <strong style={{ color: "var(--crm-green-deep)" }}>matheus@ospreceptores.com</strong>. Conversas escaladas aparecem acima com o status <span style={{ color: "var(--crm-neg)" }}>escalado</span>.
          </div>
        </section>
      </main>
    </CrmShellV3>
  );
}

/* =========================================================
   LANDING FUNNEL — dados reais via crm_landing_funnel_daily
   ========================================================= */
function useLandingDaily(days = 30) {
  return useQuery({
    queryKey: ["crm", "landing-daily", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("crm_landing_funnel_daily" as any)
        .select("*")
        .gte("day", since)
        .order("day", { ascending: false });
      return (data ?? []) as any[];
    },
  });
}

export function LandingFunnelV3() {
  const { data: daily } = useLandingDaily(30);
  const lista = daily ?? [];

  const sumK = (k: string) => lista.reduce((s, r: any) => s + (r[k] ?? 0), 0);
  const sessions = sumK("sessions");
  const conversions = sumK("conversions");
  const ctaClicks = sumK("any_cta_click");
  const conv = sessions > 0 ? Math.round((conversions / sessions) * 1000) / 10 : 0;
  const ctaRate = sessions > 0 ? Math.round((ctaClicks / sessions) * 1000) / 10 : 0;

  return (
    <CrmShellV3 mode="marketing" crumbs={[{ label: "CRM" }, { label: "Marketing" }, { label: "Landing pages" }]}>
      <main className="crm-page">
        <PageHero
          eyebrow="Marketing · Landing Performance"
          title={<>Performance <em>das landings</em></>}
          sub="Funil agregado de visitor → signup via view crm_landing_funnel_daily. Últimos 30 dias."
          actions={<PeriodBar options={["7d", "30d", "90d"]} active="30d" />}
        />

        <section className="crm-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Kpi label="Sessões" value={fmt(sessions)} deltaText="30d" accent="mrr" />
          <Kpi label="Conversões" value={fmt(conversions)} deltaText={`${conv}%`} />
          <Kpi label="CTA clicks" value={fmt(ctaClicks)} deltaText={`${ctaRate}%`} accent="warn" />
          <Kpi label="Dias com tráfego" value={lista.length} deltaText={`${days(lista)} dias`} />
        </section>

        <section className="crm-card">
          <CardHead title="Daily breakdown · 30 dias" sub="dados de crm_landing_funnel_daily" />
          {lista.length > 0 ? (
            <table className="crm-tbl">
              <thead><tr><th>Dia</th><th style={{ textAlign: "right" }}>Sessões</th><th style={{ textAlign: "right" }}>Recursos</th><th style={{ textAlign: "right" }}>Como funciona</th><th style={{ textAlign: "right" }}>Preços</th><th style={{ textAlign: "right" }}>CTA</th><th style={{ textAlign: "right" }}>Conv.</th></tr></thead>
              <tbody>
                {lista.slice(0, 30).map((r: any) => (
                  <tr key={r.day}>
                    <td className="lead-name">{new Date(r.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</td>
                    <td className="num">{fmt(r.sessions ?? 0)}</td>
                    <td className="num">{fmt(r.viewed_recursos ?? 0)}</td>
                    <td className="num">{fmt(r.viewed_como_funciona ?? 0)}</td>
                    <td className="num">{fmt(r.viewed_precos ?? 0)}</td>
                    <td className="num">{fmt(r.any_cta_click ?? 0)}</td>
                    <td className="num"><strong>{fmt(r.conversions ?? 0)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>
              Sem dados em crm_landing_funnel_daily — view ainda não populada.
            </div>
          )}
        </section>
      </main>
    </CrmShellV3>
  );
}

function days(rows: any[]) {
  if (rows.length === 0) return 0;
  return rows.length;
}

// Suprime warnings de imports não usados (usados em variantes condicionais)
void Activity; void PLAN_TAG; void PLAN_LABEL;

// ── Cabeçalho de tabela clicavel pra ordenar ──
// Generico em <K extends string>. Reaproveitavel em qualquer tabela com sortKey.
function SortableTh<K extends string>({
  label, sortKey, align = "left", current, onToggle,
}: {
  label: string;
  sortKey: K;
  align?: "left" | "right";
  current: { key: K; dir: "asc" | "desc" };
  onToggle: (key: K) => void;
}) {
  const active = current.key === sortKey;
  const arrow = active ? (current.dir === "asc" ? "▲" : "▼") : "";
  return (
    <th
      onClick={() => onToggle(sortKey)}
      style={{
        cursor: "pointer",
        userSelect: "none",
        textAlign: align,
        color: active ? "var(--crm-green-deep)" : undefined,
        whiteSpace: "nowrap",
      }}
      title={`Ordenar por ${label}`}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        <span style={{ fontSize: 9, opacity: active ? 1 : 0.25, transition: "opacity .15s" }}>
          {arrow || "▼"}
        </span>
      </span>
    </th>
  );
}

/* =========================================================
   ROLETA — participantes do evento (Semana Médica Itajubá)
   ========================================================= */
interface RouletteSpin {
  id: string;
  email: string;
  full_name: string;
  faculdade: string | null;
  phone: string | null;
  prize: string;
  prize_label: string;
  redemption_code: string;
  delivered_at: string | null;
  created_at: string;
}

const PRIZE_LABEL: Record<string, string> = {
  desconto_20: "20% off anual",
  desconto_30: "30% off anual",
  desconto_50: "50% off anual",
  mensal_gratis: "1 mês grátis",
  chaveiro: "Chaveiro",
};

function useRouletteSpins() {
  return useQuery({
    queryKey: ["crm", "roulette-spins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roulette_spins")
        .select("id, email, full_name, faculdade, phone, prize, prize_label, redemption_code, delivered_at, created_at")
        .eq("event_slug", "semana-itajuba")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RouletteSpin[];
    },
    refetchInterval: 60_000,
  });
}

export function RoletaV3() {
  const { data: spins, isLoading } = useRouletteSpins();
  const lista = spins ?? [];

  const total = lista.length;
  const comTelefone = lista.filter((s) => s.phone && s.phone.trim()).length;
  const porPremio = lista.reduce<Record<string, number>>((acc, s) => {
    acc[s.prize] = (acc[s.prize] ?? 0) + 1;
    return acc;
  }, {});
  const mensalPendente = lista.filter((s) => s.prize === "mensal_gratis" && !s.delivered_at).length;

  const exportCSV = () => {
    const headers = ["Data", "Nome", "Email", "WhatsApp", "Faculdade", "Prêmio", "Código", "Entregue"];
    const rows = lista.map((s) => [
      new Date(s.created_at).toLocaleString("pt-BR"),
      s.full_name ?? "",
      s.email ?? "",
      s.phone ?? "",
      s.faculdade ?? "",
      PRIZE_LABEL[s.prize] ?? s.prize_label ?? s.prize,
      s.redemption_code ?? "",
      s.delivered_at ? "sim" : "não",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roleta-semana-itajuba-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <CrmShellV3 mode="marketing" crumbs={[{ label: "CRM" }, { label: "Marketing" }, { label: "Roleta" }]}
      topbarTools={<><button className="crm-btn crm-btn-primary" onClick={exportCSV} disabled={total === 0}><Download size={13} /> Exportar CSV</button></>}
    >
      <main className="crm-page">
        <PageHero
          eyebrow="Marketing · Evento presencial"
          title={<>Roleta — <em>Semana Médica Itajubá</em></>}
          sub="Participantes que se cadastraram e giraram a roleta. Lista de leads do evento (atualiza a cada 60s)."
        />

        <section className="crm-kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Kpi label="Participantes" value={total} accent="mrr" />
          <Kpi label="Com WhatsApp" value={comTelefone} deltaText={total > 0 ? `${Math.round((comTelefone / total) * 100)}% do total` : "—"} />
          <Kpi label="Mês grátis a ativar" value={mensalPendente} accent={mensalPendente > 0 ? "warn" : undefined} deltaText="prize=mensal_gratis pendente" />
          <Kpi label="50% off ganhos" value={porPremio["desconto_50"] ?? 0} />
        </section>

        <section className="crm-card">
          <CardHead
            title="Participantes da roleta"
            sub={`${total} cadastros · ${comTelefone} com telefone`}
            side={<button className="crm-btn crm-btn-ghost" onClick={exportCSV} disabled={total === 0}><Download size={13} /> CSV</button>}
          />
          {isLoading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--crm-ink-4)" }}>
              <Loader2 className="animate-spin" style={{ display: "inline-block", color: "var(--crm-green-deep)" }} />
            </div>
          ) : total > 0 ? (
            <table className="crm-tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Contato</th>
                  <th>Faculdade</th>
                  <th>Prêmio</th>
                  <th>Código</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => (
                  <tr key={s.id}>
                    <td><div className="lead-name">{s.full_name || "—"}</div></td>
                    <td>
                      <div className="lead-email">{s.email}</div>
                      <div className="crm-mono" style={{ fontSize: 12, color: s.phone ? "var(--crm-ink-2)" : "var(--crm-neg)" }}>
                        {s.phone || "sem telefone"}
                      </div>
                    </td>
                    <td className="muted">{s.faculdade || "—"}</td>
                    <td>
                      <span className={`crm-tag ${s.prize === "mensal_gratis" ? "crm-tag-warn" : "crm-tag-green"}`}>
                        <span className="crm-tag-dot" />
                        {PRIZE_LABEL[s.prize] ?? s.prize_label ?? s.prize}
                      </span>
                      {s.prize === "mensal_gratis" && (
                        <span className="crm-mono" style={{ fontSize: 10, marginLeft: 6, color: s.delivered_at ? "var(--crm-pos)" : "var(--crm-neg)" }}>
                          {s.delivered_at ? "ativado" : "ativar"}
                        </span>
                      )}
                    </td>
                    <td className="crm-mono" style={{ fontSize: 12 }}>{s.redemption_code}</td>
                    <td className="muted">{new Date(s.created_at).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "var(--crm-ink-4)", fontSize: 13 }}>
              Nenhum participante ainda. Compartilhe <code>thepreceptor.com.br/semana-itajuba</code> no evento.
            </div>
          )}
        </section>
      </main>
    </CrmShellV3>
  );
}
