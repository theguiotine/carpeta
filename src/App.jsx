import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Base44Logo } from "@/components/Base44Logo";
import { RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Send, Trash2, FolderOpen, UserPlus, Copy, Check, Eye, EyeOff } from "lucide-react";

const db = base44.entities;
const api = async (data) => {
  const r = await base44.functions.invoke("carpeta-api", data);
  return r?.data ?? r;
};
const WA_NUMBER = "19789915607"; // Base44's WhatsApp number for the carpeta agent

const STATUS = {
  invited: ["Invitado", "bg-slate-100 text-slate-700"],
  active: ["Activo", "bg-sky-100 text-sky-800"],
  complete: ["Recibidos, revisar", "bg-amber-100 text-amber-900"],
  delivered: ["Entregado", "bg-emerald-100 text-emerald-800"],
  wiped: ["Borrado", "bg-zinc-200 text-zinc-600"],
};
const SEG = { received: "bg-emerald-500", delivered: "bg-emerald-700", needs_retake: "bg-amber-400", flagged: "bg-amber-400", wiped: "bg-zinc-300", missing: "bg-slate-200" };
const ICON = { missing: "⏳", received: "✅", needs_retake: "🔁", flagged: "🟡", delivered: "📨", wiped: "—" };
const CAT = {
  emergency: ["Emergencia", "bg-red-600 text-white"],
  legal_question: ["Pregunta legal", "bg-violet-100 text-violet-900"],
  notice_or_deadline: ["Carta / plazo", "bg-orange-100 text-orange-900"],
  name_mismatch: ["Nombre distinto", "bg-amber-100 text-amber-900"],
  outside_window: ["Fecha vieja", "bg-amber-100 text-amber-900"],
  other: ["Otro", "bg-slate-100 text-slate-800"],
};
const OUTCOME = { accepted: "aceptado", retake: "repetir foto", name_mismatch: "nombre distinto", outside_window: "fecha vieja", unknown: "sin clasificar" };

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString("es-US", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

function Bar({ rows }) {
  const list = rows.length ? rows : Array.from({ length: 12 }, () => ({ status: "missing" }));
  return (
    <div className="flex gap-0.5" aria-hidden>
      {list.map((r, i) => <div key={i} className={`h-2.5 flex-1 rounded-sm ${SEG[r.status] || SEG.missing}`} title={r.label_es} />)}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState({ providers: [], clients: [], cases: [], items: [], escalations: [], docs: [] });
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [invite, setInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [chat, setChat] = useState([]);
  const [chatMsg, setChatMsg] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const sendChat = async (e) => {
    e.preventDefault();
    const m = chatMsg.trim();
    if (!m) return;
    setChat((c) => [...c, { me: true, text: m }]);
    setChatMsg("");
    setChatBusy(true);
    try {
      const out = await api({ action: "team_chat", message: m });
      setChat((c) => [...c, { me: false, text: out?.reply_text || "(sin respuesta)", off: out?.ok === false }]);
    } catch {
      setChat((c) => [...c, { me: false, text: "El asistente de Roberto está desconectado ahora mismo.", off: true }]);
    }
    setChatBusy(false);
  };

  const load = useCallback(async () => {
    const [providers, clients, cases, items, escalations, docs] = await Promise.all([
      db.Provider.list(), db.Client.list("-last_activity_at"), db.Case.list(), db.ChecklistItem.list(),
      db.Escalation.list("-created_date"), db.Document.list("-created_date"),
    ]);
    setData({ providers, clients, cases, items, escalations, docs });
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
  const docsOf = (k) => data.docs.filter((d) => d.case_id === k?.id);
  const nameOfCase = (caseId) => data.clients.find((c) => c.id === data.cases.find((k) => k.id === caseId)?.client_id)?.first_name;

  const queue = data.escalations
    .filter((e) => e.status === "open")
    .sort((a, b) => (b.category === "emergency") - (a.category === "emergency"));

  const exportPacket = (client, kase) => {
    const docs = docsOf(kase);
    const rows = itemsOf(kase);
    const esc = data.escalations.filter((e) => e.case_id === kase.id);
    const ny = (iso) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
    const html = `<!doctype html><meta charset="utf-8"><title>Carpeta packet ${client.first_name}</title>
<body style="font-family:sans-serif;max-width:800px;margin:24px auto">
<p><b>Demo, datos ficticios.</b> Exported ${ny(new Date().toISOString())} ET</p>
<h1>Carpeta packet: ${client.first_name}</h1><p>${kase.process_label} · ${kase.items_received} of ${kase.items_total} received</p>
<h2>Checklist</h2><ol>${rows.map((r) => `<li>${r.label_es} [${r.requested_by}]: <b>${r.status}</b>${r.received_at ? " · " + ny(r.received_at) : ""}${r.sha256 ? " · sha256 " + r.sha256 : ""}</li>`).join("")}</ol>
<h2>Upload log</h2><table border="1" cellpadding="4" style="border-collapse:collapse;font-size:12px"><tr><th>Received (ET)</th><th>Classified as</th><th>Outcome</th><th>Flags</th><th>Image</th></tr>
${[...docs].sort((a, b) => String(a.created_date).localeCompare(String(b.created_date))).map((d) => `<tr><td>${ny(d.created_date)}</td><td>${d.classified_as || ""}</td><td>${d.outcome || ""}</td><td>${(d.quality_flags || []).join(", ")}</td><td><a href="${d.file_url}">image</a></td></tr>`).join("")}</table>
<h2>Review queue</h2><ul>${esc.map((e) => `<li>[${e.category}] ${e.summary_en || e.summary_es} (${e.status})</li>`).join("")}</ul>
<p>For the paralegal: review the flags. For the attorney: sign off before filing. Information, not legal advice.</p></body>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `carpeta-${client.first_name}-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
  };

  const act = async (label, payload, confirmText, before) => {
    if (confirmText && !window.confirm(confirmText)) return;
    if (before) before();
    setBusy(label);
    try {
      const out = await api(payload);
      if (out?.reply_text && label !== "quiet") window.alert(out.reply_text);
    } catch (e) {
      window.alert("Error: " + (e?.message || e));
    }
    setBusy("");
    load();
  };

  const doInvite = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy("invite");
    try {
      const out = await api({ action: "invite", first_name: newName.trim() });
      if (out?.invite_code) setInvite(out);
      setNewName("");
    } finally {
      setBusy("");
      load();
    }
  };

  const inviteText = invite
    ? `Hola ${invite.first_name}, soy de ${provider?.whatsapp_display_name || "la oficina de su abogado/a"}. Para mandarnos sus documentos por WhatsApp, escriba a +1 978-991-5607 el código ${invite.invite_code}. Nosotros revisamos todo; no es un mensaje del gobierno.`
    : "";
  const waLink = invite ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(invite.invite_code)}` : "";

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      <div className="bg-amber-300 text-amber-950 text-center text-xs font-semibold py-1 px-4">
        Demo · todos los datos son ficticios · fictional data only
      </div>

      <header className="max-w-6xl mx-auto px-4 pt-6 pb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen className="w-7 h-7 text-emerald-700" />
            <h1 className="text-2xl font-bold tracking-tight">Carpeta · Bandeja del paralegal</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Paralegal inbox · clients send documents over WhatsApp, the paralegal reviews, the attorney signs off.</p>
          <p className="text-xs text-slate-500 mt-1">{provider ? `${provider.name} · ${provider.organization}` : ""}</p>
        </div>
        <a href="/?stage" className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-700">▶ Modo presentación</a>
        <button onClick={load} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-24 grid gap-6 lg:grid-cols-3 mt-4">
        {/* Clients first */}
        <section className="lg:col-span-2 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Clientes <span className="text-sm font-normal text-slate-500">· documentos pendientes</span></h2>
            <span className="text-xs text-slate-500">{data.clients.length} clientes</span>
          </div>
          {!loaded && <p className="text-sm text-slate-500">Cargando…</p>}
          <div className="rounded-xl border bg-white divide-y shadow-sm">
            {data.clients.map((c) => {
              const k = caseOf(c);
              const rows = itemsOf(k);
              const total = k?.items_total || 12;
              const got = k?.items_received || 0;
              const flags = data.escalations.filter((e) => e.case_id === k?.id && e.status === "open").length;
              const [label, pill] = STATUS[c.status] || [c.status, ""];
              const isOpen = open === c.id;
              const docs = docsOf(k);
              return (
                <div key={c.id}>
                  <div className="p-4 grid grid-cols-12 items-center gap-3">
                    <button onClick={() => setOpen(isOpen ? null : c.id)} className="col-span-3 flex items-center gap-1 font-semibold text-left">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {c.first_name}
                      <code className="ml-1 text-[10px] font-normal bg-slate-100 px-1 rounded">{c.invite_code}</code>
                    </button>
                    <div className="col-span-4">
                      <Bar rows={rows} />
                      <div className="text-xs mt-1 text-slate-600"><span className="font-mono font-semibold text-slate-900">{got} de {total}</span> · {fmt(c.last_activity_at)}</div>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${pill}`}>{label}</span>
                      {flags > 0 && <span className="flex items-center gap-0.5 text-xs text-amber-700"><AlertTriangle className="w-3.5 h-3.5" />{flags}</span>}
                    </div>
                    <div className="col-span-3 flex justify-end gap-1.5">
                      <button disabled={!!busy || !k || ["wiped", "delivered"].includes(c.status)}
                        onClick={() => act("deliver", { action: "deliver", case_id: k.id }, `¿Descargar el paquete de ${c.first_name}, entregarlo y borrar las fotos de Carpeta?`, () => exportPacket(c, k))}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-emerald-700 text-white disabled:opacity-30">
                        <Send className="w-3.5 h-3.5" /> Entregar
                      </button>
                      <button disabled={!!busy || !k || c.status === "wiped"}
                        onClick={() => act("wipe", { action: "wipe", case_id: k.id, by: "provider" }, `¿Borrar todo lo que ${c.first_name} mandó?`)}
                        className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border border-red-200 text-red-700 disabled:opacity-30">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {isOpen && k && (
                    <div className="px-4 pb-4 bg-stone-50/60">
                      <div className="flex items-center justify-between py-2">
                        <span className="text-xs text-slate-600">{k.process_label}{k.next_appointment ? ` · cita ${fmt(k.next_appointment)}` : ""}</span>
                        <button onClick={() => act("quiet", { action: "set_visible", case_id: k.id, visible: !c.documents_visible_to_client })}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-white">
                          {c.documents_visible_to_client ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          {c.documents_visible_to_client ? "El cliente ve su lista" : "Lista oculta al cliente"}
                        </button>
                      </div>
                      <ol className="space-y-1.5">
                        {rows.map((r) => {
                          const doc = docs.find((d) => d.checklist_item_id === r.id && d.outcome === "accepted");
                          return (
                            <li key={r.id} className="flex items-center gap-2 text-sm bg-white rounded-md border px-2 py-1.5">
                              <span className="w-5 text-center">{ICON[r.status]}</span>
                              <span className={`flex-1 ${r.required === false ? "line-through text-slate-400" : ""}`}>{r.order}. {r.label_es}</span>
                              <button onClick={() => act("quiet", { action: "set_required", case_id: k.id, item_id: r.id, required: r.required === false })}
                                title="El abogado/a decide si se pide este documento a este cliente"
                                className={`text-[10px] px-1.5 py-0.5 rounded-full border ${r.required === false ? "bg-white text-slate-500" : "bg-emerald-50 text-emerald-800 border-emerald-200"}`}>
                                {r.required === false ? "no se pide" : "se pide"}
                              </button>
                              <span className="text-[10px] px-1.5 rounded bg-slate-100 text-slate-600">{r.requested_by}</span>
                              {r.retake_count > 0 && <span className="text-[11px] text-slate-500">intentos {r.retake_count}</span>}
                              {r.type === "bring_original" && <span className="text-[11px]">🏷️ original</span>}
                              {r.sha256 && <code className="text-[10px] text-slate-400" title="Huella del archivo entregado">{String(r.sha256).slice(0, 6)}…</code>}
                              {doc && <a href={doc.file_url} target="_blank" rel="noreferrer"><img src={doc.file_url} alt="" className="w-10 h-10 object-cover rounded border" /></a>}
                              {r.source_url && <a className="text-[10px] text-sky-700 underline" href={r.source_url} target="_blank" rel="noreferrer">USCIS</a>}
                            </li>
                          );
                        })}
                      </ol>
                      {docs.some((d) => d.outcome !== "accepted") && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-slate-600 mb-1">Fotos retenidas</p>
                          <div className="flex flex-wrap gap-2">
                            {docs.filter((d) => d.outcome !== "accepted").map((d) => (
                              <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" className="text-[11px] text-center">
                                <img src={d.file_url} alt="" className="w-14 h-14 object-cover rounded border" />
                                {OUTCOME[d.outcome] || d.outcome}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-6">
          {/* Review queue */}
          <section>
            <h2 className="text-lg font-semibold">Cola de revisión <span className="text-sm font-normal text-slate-500">· review queue ({queue.length})</span></h2>
            {queue.length === 0 && <p className="text-sm text-slate-500 mt-2">Nada pendiente.</p>}
            <ul className="space-y-2 mt-2">
              {queue.map((e) => {
                const [tag, cls] = CAT[e.category] || CAT.other;
                return (
                  <li key={e.id} className={`rounded-xl border bg-white p-3 shadow-sm ${e.category === "emergency" ? "border-red-400" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>{tag}</span>
                      <span className="text-[11px] text-slate-500">{fmt(e.created_date)}</span>
                    </div>
                    <p className="text-sm mt-1.5"><span className="font-medium">{e.client_first_name || nameOfCase(e.case_id)}:</span> {e.summary_es || e.summary_en}</p>
                    {e.summary_en && e.summary_es && <p className="text-xs text-slate-500 mt-0.5">{e.summary_en}</p>}
                    <button onClick={() => act("quiet", { action: "resolve", case_id: e.case_id, escalation_id: e.id })}
                      className="mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-slate-50">
                      <Check className="w-3.5 h-3.5" /> Resolver
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Invite */}
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="font-semibold flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Invitar cliente</h2>
            <p className="text-xs text-slate-500">Carpeta nunca escribe primero: usted le manda el código y el cliente escribe.</p>
            <form onSubmit={doInvite} className="flex gap-2 mt-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre (solo el primero)"
                className="flex-1 text-sm border rounded-md px-2 py-1.5" />
              <button disabled={busy === "invite"} className="text-sm px-3 py-1.5 rounded-md bg-emerald-700 text-white disabled:opacity-40">Crear</button>
            </form>
            {invite && (
              <div className="mt-3 text-sm space-y-2">
                <p>Código: <code className="font-bold">{invite.invite_code}</code></p>
                <p className="text-xs bg-stone-50 border rounded-md p-2">{inviteText}</p>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard?.writeText(inviteText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copiar mensaje
                  </button>
                  <a href={waLink} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-md border text-emerald-800">Abrir WhatsApp con el código</a>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Asistente del equipo (Roberto)</h2>
            <p className="text-xs text-slate-500">Pregúntele al agente del equipo sobre sus casos. Corre en el servidor FastAPI de Roberto; Carpeta lo llama por la función de Base44.</p>
            <div className="mt-2 max-h-56 overflow-y-auto space-y-1.5 text-sm">
              {chat.map((m, i) => (
                <div key={i} className={`rounded-lg px-2.5 py-1.5 ${m.me ? "bg-emerald-50 ml-6" : m.off ? "bg-amber-50 text-amber-900 mr-6" : "bg-slate-100 mr-6"}`}>{m.text}</div>
              ))}
              {chatBusy && <div className="text-xs text-slate-400">pensando…</div>}
            </div>
            <form onSubmit={sendChat} className="flex gap-2 mt-2">
              <input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} placeholder="Ej.: ¿Qué casos tienen documentos pendientes?"
                className="flex-1 text-sm border rounded-md px-2 py-1.5" />
              <button disabled={chatBusy} className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white disabled:opacity-40">Enviar</button>
            </form>
          </section>

          <section className="rounded-xl border bg-white p-4 text-sm text-slate-700 shadow-sm">
            <p className="font-semibold">Cómo funciona</p>
            <p className="mt-1">El paralegal hace el 80% del trabajo de juntar y revisar documentos; Carpeta lo hace más rápido y fácil de verificar, y el abogado/a solo firma. El cliente escribe el código en WhatsApp y Carpeta le pide la lista, uno por uno. El conteo viene de la base de datos, no del modelo. Toda pregunta legal pasa a la cola de revisión. Entregar descarga el paquete y borra las fotos; quedan el estado y una huella sha256.</p>
          </section>
        </aside>
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-white/95 border-t text-center text-xs text-slate-600 py-2 px-4">
        Información, no asesoría legal. El abogado/a elige el proceso y firma. · Built on <Base44Logo className="inline w-3 h-3" /> Base44
      </footer>
    </div>
  );
}
