import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Base44Logo } from "@/components/Base44Logo";
import { RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Send, Trash2, MessageCircle } from "lucide-react";

const db = base44.entities;
const api = (data) => base44.functions.invoke("carpeta-api", data);

const STATUS_PILL = {
  invited: "bg-slate-100 text-slate-700",
  active: "bg-blue-100 text-blue-800",
  complete: "bg-emerald-100 text-emerald-800",
  delivered: "bg-violet-100 text-violet-800",
  wiped: "bg-zinc-200 text-zinc-600",
};
const STATUS_ES = { invited: "Invitado", active: "Activo", complete: "Recibidos, revisar", delivered: "Entregado", wiped: "Borrado" };
const ITEM_ICON = { missing: "⏳", received: "✅", needs_retake: "🔁", flagged: "🟡", delivered: "📨", wiped: "—" };
const CAT = {
  emergency: ["EMERGENCY", "bg-red-600 text-white"],
  legal_question: ["LEGAL", "bg-amber-100 text-amber-900"],
  notice_or_deadline: ["NOTICE", "bg-orange-100 text-orange-900"],
  name_mismatch: ["NAME", "bg-yellow-100 text-yellow-900"],
  outside_window: ["DATE", "bg-yellow-100 text-yellow-900"],
  other: ["OTHER", "bg-slate-100 text-slate-800"],
};

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

export default function App() {
  const [data, setData] = useState({ providers: [], clients: [], cases: [], items: [], escalations: [] });
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [providers, clients, cases, items, escalations] = await Promise.all([
      db.Provider.list(), db.Client.list(), db.Case.list(), db.ChecklistItem.list(), db.Escalation.list("-created_date"),
    ]);
    setData({ providers, clients, cases, items, escalations });
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const provider = data.providers[0];
  const caseOf = (c) => data.cases.find((k) => k.client_id === c.id);
  const itemsOf = (k) => data.items.filter((i) => i.case_id === k?.id).sort((a, b) => a.order - b.order);
  const firstName = (caseId) => data.clients.find((c) => c.id === data.cases.find((k) => k.id === caseId)?.client_id)?.first_name;

  const openEsc = data.escalations
    .filter((e) => e.status === "open")
    .sort((a, b) => (a.category === "emergency" ? -1 : 0) - (b.category === "emergency" ? -1 : 0));

  // Export before wipe: the paralegal downloads a dated packet (checklist + upload log + image
  // links) to the office's own system before ENTREGAR deletes Carpeta's copies.
  const exportPacket = async (client, kase) => {
    const docs = await db.Document.filter({ case_id: kase.id });
    const rows = itemsOf(kase);
    const esc = data.escalations.filter((e) => e.case_id === kase.id);
    const ny = (iso) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
    const html = `<!doctype html><meta charset="utf-8"><title>Carpeta packet ${client.first_name}</title>
<body style="font-family:sans-serif;max-width:800px;margin:24px auto">
<p><b>Demo, datos ficticios.</b> Exported ${ny(new Date().toISOString())} ET</p>
<h1>Carpeta packet: ${client.first_name}</h1><p>${kase.process_label} · ${kase.items_received} of ${kase.items_total} received</p>
<h2>Checklist</h2><ol>${rows.map((r) => `<li>${r.label_es} [${r.requested_by}]: <b>${r.status}</b>${r.received_at ? " · " + ny(r.received_at) : ""}${r.sha256 ? " · sha256 " + r.sha256 : ""}</li>`).join("")}</ol>
<h2>Upload log</h2><table border="1" cellpadding="4" style="border-collapse:collapse;font-size:12px"><tr><th>Received (ET)</th><th>Classified as</th><th>Outcome</th><th>Flags</th><th>Image</th></tr>
${docs.sort((a, b) => String(a.created_date).localeCompare(String(b.created_date))).map((d) => `<tr><td>${ny(d.created_date)}</td><td>${d.classified_as || ""}</td><td>${d.outcome || ""}</td><td>${(d.quality_flags || []).join(", ")}</td><td><a href="${d.file_url}">image</a></td></tr>`).join("")}</table>
<h2>Questions and flags</h2><ul>${esc.map((e) => `<li>[${e.category}] ${e.summary_en || e.summary_es} (${e.status})</li>`).join("")}</ul>
<p>For the paralegal: review the flags. For the attorney: sign off before filing. Information, not legal advice.</p></body>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `carpeta-${client.first_name}-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
  };

  const act = async (label, payload, confirmText, before) => {
    if (confirmText && !window.confirm(confirmText)) return;
    if (before) await before();
    setBusy(label);
    try {
      const r = await api(payload);
      const out = r?.data ?? r;
      if (out?.reply_text) window.alert(out.reply_text);
    } catch (e) {
      window.alert("Error: " + (e?.message || e));
    }
    setBusy("");
    load();
  };

  const closeEsc = async (e) => {
    await db.Escalation.update(e.id, { status: "closed" }).catch(() => window.alert("Solo la oficina puede cerrar (inicie sesión)."));
    load();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="bg-amber-400 text-amber-950 text-center text-sm font-semibold py-1.5 px-4">
        Demo · todos los datos son ficticios · fictional data only
      </div>

      <header className="max-w-5xl mx-auto px-4 pt-6 pb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-2xl">
            <MessageCircle className="w-7 h-7" /> Carpeta
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {provider ? `${provider.name} · ${provider.organization}` : "Cargando…"}
          </p>
          <p className="text-sm font-semibold text-slate-700 mt-1">Bandeja del paralegal · Paralegal inbox</p>
          <p className="text-xs text-slate-500">Los clientes juntan documentos por WhatsApp; el paralegal revisa aquí y el abogado/a firma.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded border bg-white hover:bg-slate-100">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-24 space-y-6">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Preguntas y alertas ({openEsc.length})
          </h2>
          {openEsc.length === 0 && <p className="text-sm text-slate-500">Nada pendiente.</p>}
          <ul className="space-y-2">
            {openEsc.map((e) => {
              const [tag, cls] = CAT[e.category] || CAT.other;
              return (
                <li key={e.id} className={`flex items-start gap-3 rounded-lg border bg-white p-3 ${e.category === "emergency" ? "border-red-500" : ""}`}>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${cls}`}>{tag}</span>
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{e.client_first_name || firstName(e.case_id)}:</span> {e.summary_en || e.summary_es}
                    <div className="text-xs text-slate-500">{fmt(e.created_date)}</div>
                  </div>
                  <button onClick={() => closeEsc(e)} className="text-xs px-2 py-1 rounded border hover:bg-slate-100">Cerrar</button>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">Clientes</h2>
          {!loaded && <p className="text-sm text-slate-500">Cargando…</p>}
          <div className="rounded-lg border bg-white divide-y">
            {data.clients.map((c) => {
              const k = caseOf(c);
              const rows = itemsOf(k);
              const total = k?.items_total || rows.length || 12;
              const got = k?.items_received || 0;
              const pct = Math.round((got / total) * 100);
              const nEsc = data.escalations.filter((e) => e.case_id === k?.id && e.status === "open").length;
              const isOpen = open === c.id;
              return (
                <div key={c.id}>
                  <div className="p-3 flex flex-wrap items-center gap-3">
                    <button onClick={() => setOpen(isOpen ? null : c.id)} className="flex items-center gap-1 font-semibold w-28 text-left">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} {c.first_name}
                    </button>
                    <div className="text-xs text-slate-600 w-56 truncate" title={k?.process_label}>{k?.process_label}</div>
                    <div className="flex-1 min-w-[140px]">
                      <div className="h-2 rounded bg-slate-200 overflow-hidden">
                        <div className="h-2 bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs mt-0.5 font-mono">{got} de {total}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_PILL[c.status] || ""}`}>{STATUS_ES[c.status] || c.status}</span>
                    {nEsc > 0 && <span className="flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="w-3.5 h-3.5" />{nEsc}</span>}
                    <span className="text-xs text-slate-400 w-28">{fmt(c.last_activity_at)}</span>
                    <code className="text-xs bg-slate-100 px-1.5 rounded" title="Código de invitación">{c.invite_code}</code>
                    <button disabled={!!busy || !k || c.status === "wiped" || c.status === "delivered"}
                      onClick={() => act("deliver", { action: "deliver", case_id: k.id }, `¿Descargar el paquete de ${c.first_name}, mandarlo por correo y borrar las fotos de Carpeta?`, () => exportPacket(c, k))}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-40">
                      <Send className="w-3.5 h-3.5" /> ENTREGAR
                    </button>
                    <button disabled={!!busy || !k || c.status === "wiped"}
                      onClick={() => act("wipe", { action: "wipe", case_id: k.id, by: "provider" }, `¿Borrar todo lo que ${c.first_name} mandó?`)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-300 text-red-700 disabled:opacity-40">
                      <Trash2 className="w-3.5 h-3.5" /> BORRAR
                    </button>
                  </div>
                  {isOpen && (
                    <ol className="px-10 pb-4 text-sm space-y-1">
                      {rows.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center gap-2">
                          <span className="w-6">{ITEM_ICON[r.status] || ""}</span>
                          <span className="w-72">{r.order}. {r.label_es}</span>
                          <span className="text-[10px] px-1.5 rounded bg-slate-100 text-slate-600">{r.requested_by}</span>
                          {r.retake_count > 0 && <span className="text-xs text-slate-500">intentos: {r.retake_count}</span>}
                          {r.type === "bring_original" && <span className="text-xs">🏷️ traer original</span>}
                          {r.received_at && <span className="text-xs text-slate-500">{fmt(r.received_at)}</span>}
                          {r.sha256 && (
                            <code className="text-[10px] text-slate-500" title="Prueba de lo que se entregó; el archivo ya no está guardado.">
                              sha256: {String(r.sha256).slice(0, 6)}…{String(r.sha256).slice(-3)}
                            </code>
                          )}
                          {r.source_url && <a className="text-[10px] text-blue-600 underline" href={r.source_url} target="_blank" rel="noreferrer">fuente USCIS ({r.source_read_date})</a>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold">Cómo funciona</p>
          <p>El paralegal hace el 80% del trabajo de juntar y revisar documentos; Carpeta lo hace más rápido y fácil de verificar, y el abogado/a solo firma. La oficina le da a su cliente un código. El cliente lo escribe en WhatsApp y Carpeta le pide los documentos de la lista, uno por uno. El conteo viene de la base de datos, no del modelo. Toda pregunta legal se la pasa a usted. ENTREGAR le manda el paquete por correo y borra las fotos; quedan solo el estado y una huella sha256.</p>
        </section>
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-white border-t text-center text-xs text-slate-600 py-2 px-4">
        Información, no asesoría legal. El abogado/a elige el proceso y revisa cada documento. · Built on <Base44Logo className="inline w-3 h-3" /> Base44
      </footer>
    </div>
  );
}
