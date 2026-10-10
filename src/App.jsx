import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Base44Logo } from "@/components/Base44Logo";
import { useLang, LangToggle } from "@/i18n";
import { MessageCircle, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, Send, Trash2, FolderOpen, UserPlus, Copy, Check, Eye, EyeOff } from "lucide-react";

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

const WF_CLS = { requested: "bg-slate-100 text-slate-600", received: "bg-sky-100 text-sky-800", review: "bg-amber-100 text-amber-900", reviewed: "bg-emerald-100 text-emerald-800", resub: "bg-orange-100 text-orange-900" };

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString(document.documentElement.lang === "es" ? "es-US" : "en-US", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

function Bar({ rows }) {
  const list = rows.length ? rows : Array.from({ length: 12 }, () => ({ status: "missing" }));
  return (
    <div className="flex gap-0.5" aria-hidden>
      {list.map((r, i) => <div key={i} className={`h-2.5 flex-1 rounded-sm ${SEG[r.status] || SEG.missing}`} title={r.label_es} />)}
    </div>
  );
}

function TeamClients({ T }) {
  const KEY = "carpeta_team_cache";
  const [data, setData] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } });
  const [offline, setOffline] = useState(false);
  const fetchIt = useCallback(async () => {
    try {
      const out = await api({ action: "team_data" });
      if (out?.ok) { setData(out); setOffline(false); try { localStorage.setItem(KEY, JSON.stringify(out)); } catch { /* ignore */ } }
      else setOffline(true);
    } catch { setOffline(true); }
  }, []);
  useEffect(() => {
    fetchIt();
    const t = setInterval(() => { if (!document.hidden) fetchIt(); }, 30000);
    window.addEventListener("focus", fetchIt);
    return () => { clearInterval(t); window.removeEventListener("focus", fetchIt); };
  }, [fetchIt]);
  const list = data?.clients || [];
  if (!list.length && !offline) return null;
  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-sm">{T.tbClients} <span className="font-normal text-slate-400">· {T.teamTag}</span></h2>
      {offline && <p className="text-xs text-amber-700 mt-1">⚠ {T.tbOffline}</p>}
      <ul className="mt-2 space-y-1.5 text-xs">{list.map((c, i) => (
        <li key={i}><b>{c.name}</b> <span className="text-slate-400">{c.phone}</span><br /><span className="text-slate-600">{[c.benefit_sought || c.case_type, c.status, c.next_hearing ? `${T.tbHearing} ${c.next_hearing}` : ""].filter(Boolean).join(" · ")}</span></li>
      ))}</ul>
    </section>
  );
}

export default function App() {
  const [lang, setLang, T] = useLang();
  const [tour, setTour] = useState(-1);
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
  const sendChat = async (e, preset) => {
    e?.preventDefault?.();
    const m = (preset ?? chatMsg).trim();
    if (!m) return;
    setChat((c) => [...c, { me: true, text: m }]);
    setChatMsg("");
    setChatBusy(true);
    try {
      const out = await api({ action: "team_chat", message: m });
      setChat((c) => [...c, { me: false, text: out?.reply_text || T.noReply, off: out?.ok === false }]);
    } catch {
      setChat((c) => [...c, { me: false, text: T.teamOff, off: true }]);
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
    // Realtime first (debounced), slow poll as a fallback: keeps a public demo under Base44's rate limit.
    let timer = null;
    const soon = () => { clearTimeout(timer); timer = setTimeout(load, 1200); };
    const subs = [db.Document, db.ChecklistItem, db.Escalation, db.Client, db.Case].map((e) => e.subscribe(soon));
    const t = setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => { clearInterval(t); clearTimeout(timer); subs.forEach((u) => typeof u === "function" && u()); };
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
  const inviteFor = (c) =>
    `Hola ${c.first_name}, soy de ${provider?.whatsapp_display_name || "la oficina de su abogado/a"}. Para mandarnos sus documentos por WhatsApp, escriba a +1 978-991-5607 el código ${c.invite_code}. Nosotros revisamos todo; no es un mensaje del gobierno.`;
  const waLink = invite ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(invite.invite_code)}` : "";

  const [showEarlier, setShowEarlier] = useState(false);
  // Puente workflow: Requested -> Received / Needs review -> Reviewed or Resubmission requested.
  const wfOf = (r, k) => {
    if (r.note_for_provider === "resubmission_requested") return "resub";
    if (r.status === "needs_retake" || r.status === "flagged") return "review";
    const heldDoc = data.docs.find((d) => d.case_id === k?.id && d.checklist_item_id === r.id && ["name_mismatch", "outside_window"].includes(d.outcome));
    const openFlag = heldDoc && data.escalations.some((e) => e.case_id === k?.id && e.status === "open" && ["name_mismatch", "outside_window"].includes(e.category));
    if (r.status === "received" || r.status === "delivered") return r.note_for_provider === "reviewed" ? "reviewed" : openFlag ? "review" : "received";
    return openFlag ? "review" : "requested";
  };
  const flagsOf = (k) => data.escalations.filter((e) => e.case_id === k?.id && e.status === "open").length;
  const daysTo = (k) => (k?.deadline ? Math.ceil((new Date(k.deadline + "T23:59:59") - Date.now()) / 86400000) : null);
  const sortedClients = data.clients.filter((c) => c.invite_code !== "DEMO01").sort((a, b) => {
    const ka = caseOf(a), kb = caseOf(b);
    const da = daysTo(ka) ?? 9999, dbb = daysTo(kb) ?? 9999;
    if (da !== dbb) return da - dbb;
    const fa = flagsOf(ka), fb = flagsOf(kb);
    if (fb !== fa) return fb - fa;
    return (ka?.items_received || 0) / (ka?.items_total || 12) - (kb?.items_received || 0) / (kb?.items_total || 12);
  });
  const answers = [];
  for (let i = 0; i < chat.length; i++) if (chat[i].me) answers.push({ q: chat[i].text, a: chat[i + 1] });
  const latest = answers[answers.length - 1];
  const earlier = answers.slice(0, -1).slice(-3).reverse();
  const accepted = data.docs.filter((d) => d.outcome === "accepted").slice(0, 8);
  const SAMPLE = [["04-lease.png", "lease"], ["07-utility-bill-sep.png", "utility_bill"], ["05-paystub-aug.png", "paystub"], ["01-I-797C-receipt-I-589.png", "i589_receipt"]];
  const labelFor = (d) => {
    const it = data.items.find((x) => x.id === d.checklist_item_id);
    return it ? (lang === "en" ? it.label_en || it.label_es : it.label_es) : d.classified_as;
  };

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      {tour >= 0 && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setTour(-1)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs text-slate-500">{tour + 1} / {T.tourSteps.length}</div>
            <h3 className="text-xl font-bold mt-1">{T.tourSteps[tour][0]}</h3>
            <p className="text-slate-700 mt-2">{T.tourSteps[tour][1]}</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setTour(tour + 1 < T.tourSteps.length ? tour + 1 : -1)} className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold">
                {tour + 1 < T.tourSteps.length ? T.next : T.done}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-amber-300 text-amber-950 text-center text-xs font-semibold py-1 px-4">{T.banner}</div>

      <header className="max-w-6xl mx-auto px-4 pt-5 pb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen className="w-7 h-7 text-emerald-700" />
            <h1 className="text-2xl font-bold tracking-tight">{T.portalTitle}</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{T.portalSub}</p>
          <p className="text-xs text-slate-500 mt-0.5">{provider ? `${provider.name} · ${provider.organization}` : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LangToggle lang={lang} setLang={setLang} t={T} />
          <button onClick={() => setTour(0)} className="text-sm px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50">❓ {T.tour}</button>
          <a href="/?stage" className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-700">{T.present}</a>
          <button onClick={load} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50"><RefreshCw className="w-4 h-4" /> {T.refresh}</button>
        </div>
      </header>

      {/* Team assistant: a work tool, not a chat */}
      <section className="max-w-6xl mx-auto px-4 mt-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{T.askLabel}</h2>
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-900 text-white">{T.teamTag}</span>
          </div>
          <form onSubmit={sendChat} className="mt-3">
            <div className="flex gap-2 mt-1">
              <input id="ask" value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} placeholder={T.teamPh}
                className="flex-1 text-base border rounded-md px-3 py-2 font-mono focus:outline-none focus:border-slate-900" />
              <button disabled={chatBusy} className="px-5 py-2 rounded-md bg-slate-900 text-white font-semibold disabled:opacity-40">{T.ask}</button>
            </div>
          </form>
          <div className="flex flex-wrap gap-2 mt-2">
            {T.examples.map((ex) => (
              <button key={ex} onClick={() => sendChat(null, ex)} disabled={chatBusy}
                className="text-xs px-2.5 py-1 rounded-full border bg-slate-50 hover:bg-slate-100 text-slate-700">{ex}</button>
            ))}
          </div>
          {(chatBusy || latest) && (
            <div className="mt-3 border-l-4 border-slate-900 bg-slate-50 rounded-r-md px-3 py-2 text-sm">
              {latest && <div className="text-xs text-slate-500 font-mono">› {latest.q}</div>}
              <div className={`mt-0.5 whitespace-pre-wrap ${latest?.a?.off ? "text-amber-800" : ""}`}>{chatBusy && (!latest || latest.a) ? T.thinking : latest?.a?.text || T.thinking}</div>
            </div>
          )}
          {earlier.length > 0 && (
            <div className="mt-2">
              <button onClick={() => setShowEarlier(!showEarlier)} className="text-xs text-slate-500 underline">{T.earlier} ({earlier.length})</button>
              {showEarlier && earlier.map((x, i) => (
                <div key={i} className="mt-1.5 text-xs border-l-2 border-slate-300 pl-2"><div className="font-mono text-slate-500">› {x.q}</div><div>{x.a?.text}</div></div>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 pb-16 grid gap-4 lg:grid-cols-3 mt-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          {/* Clients table, next move first */}
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="flex items-baseline justify-between px-4 pt-3">
              <h2 className="text-lg font-semibold">{T.clients} <span className="text-sm font-normal text-slate-500">{T.clientsSub}</span></h2>
              <span className="text-xs text-slate-500">{T.nClients(sortedClients.length)}</span>
            </div>
            {!loaded && <p className="text-sm text-slate-500 px-4 py-2">{T.loading}</p>}
            <div className="grid grid-cols-12 gap-2 px-4 pt-2 pb-1 text-[11px] uppercase tracking-wide text-slate-400">
              <div className="col-span-3">{T.colClient}</div><div className="col-span-4">{T.colProgress}</div><div className="col-span-1">{T.colFlags}</div><div className="col-span-1">{T.colLast}</div><div className="col-span-3 text-right">{T.colActions}</div>
            </div>
            <div className="divide-y">
              {sortedClients.map((c) => {
                const k = caseOf(c);
                const rows = itemsOf(k);
                const total = k?.items_total || 12;
                const got = k?.items_received || 0;
                const flags = flagsOf(k);
                const [, pill] = STATUS[c.status] || [c.status, ""];
                const isOpen = open === c.id;
                const docs = docsOf(k);
                return (
                  <div key={c.id}>
                    <div className="px-4 py-2.5 grid grid-cols-12 items-center gap-2">
                      <button onClick={() => setOpen(isOpen ? null : c.id)} className="col-span-3 text-left">
                        <div className="flex items-center gap-1 font-semibold">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}{c.first_name}
                          <span className={`ml-1 text-[10px] font-normal px-1.5 rounded-full ${pill}`}>{T.status[c.status] || c.status}</span></div>
                        <div className="text-[11px] text-slate-500 truncate pl-5">{k?.process_label}</div>
                      </button>
                      <div className="col-span-4"><Bar rows={rows} /><div className="text-xs mt-1 font-mono font-semibold">{got} {T.of} {total}</div></div>
                      <div className="col-span-1">{flags > 0 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">{flags}</span> : <span className="text-xs text-slate-300">0</span>}</div>
                      <div className="col-span-1">{(() => { const n = daysTo(k); return n === null ? <span className="text-xs text-slate-300">{T.noDeadline}</span> : <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${n < 3 ? "bg-red-100 text-red-800" : n < 7 ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{T.days(n)}</span>; })()}</div>
                      <div className="col-span-3 flex justify-end gap-1.5 flex-wrap">
                        <button disabled={!!busy || !k || c.status === "wiped"} title="Delete"
                          onClick={() => act("wipe", { action: "wipe", case_id: k.id, by: "provider" }, T.confirmWipe(c.first_name))}
                          className="text-xs px-1.5 py-1.5 rounded-md border border-red-200 text-red-700 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    {isOpen && k && (
                      <div className="px-4 pb-3 bg-stone-50">
                        <div className="flex items-center justify-between py-2">
                          <span className="text-xs text-slate-600">{k.next_appointment ? `${T.appt} ${fmt(k.next_appointment)}` : ""}</span>
                          <button onClick={() => act("quiet", { action: "set_visible", case_id: k.id, visible: !c.documents_visible_to_client })}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-white">
                            {c.documents_visible_to_client ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}{c.documents_visible_to_client ? T.clientSees : T.listHidden}
                          </button>
                        </div>
                        <ol className="grid md:grid-cols-2 gap-1.5">
                          {rows.map((r) => {
                            const doc = docs.find((d) => d.checklist_item_id === r.id && d.outcome === "accepted");
                            return (
                              <li key={r.id} className="flex items-center gap-2 text-xs bg-white rounded-md border px-2 py-1.5">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${WF_CLS[wfOf(r, k)]}`}>{T.wf[wfOf(r, k)]}</span>
                                <span className={`flex-1 ${r.required === false ? "line-through text-slate-400" : ""}`}>{lang === "en" ? r.label_en || r.label_es : r.label_es}</span>
                                <button onClick={() => act("quiet", { action: "set_required", case_id: k.id, item_id: r.id, required: r.required === false })} title={T.attorneyDecides}
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full border ${r.required === false ? "bg-white text-slate-500" : "bg-emerald-50 text-emerald-800 border-emerald-200"}`}>
                                  {r.required === false ? T.notRequested : T.requested}
                                </button>
                                {doc && <a href={doc.file_url} target="_blank" rel="noreferrer"><img src={doc.file_url} alt="" className="w-8 h-8 object-cover rounded border" /></a>}
                                {wfOf(r, k) === "review" && (
                                  <a href={`https://wa.me/?text=${encodeURIComponent(`Hola ${c.first_name}, necesitamos que nos mande otra vez: ${r.label_es}. Tómela en una mesa, con buena luz, y mándela a Carpeta (+1 978-991-5607).`)}`}
                                    target="_blank" rel="noreferrer" onClick={() => api({ action: "set_resub", case_id: k.id, item_id: r.id })}
                                    className="text-[10px] px-1.5 py-0.5 rounded border border-amber-300 text-amber-900 bg-amber-50">{T.requestResub}</a>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Documents received (from Carpeta's own records; samples if none yet) */}
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">{T.docsTitle}</h2>
            <div className="grid grid-cols-4 gap-3 mt-2">
              {(accepted.length ? accepted.map((d) => ({ url: d.file_url, label: labelFor(d), who: nameOfCase(d.case_id), sample: false }))
                : SAMPLE.map(([f, ty]) => ({ url: `/demo-docs/${f}`, label: ty, who: "", sample: true }))).map((x, i) => (
                <a key={i} href={x.url} target="_blank" rel="noreferrer" className="block rounded-lg border overflow-hidden bg-stone-50">
                  <div className="relative"><img src={x.url} alt="" className="w-full h-24 object-cover" />
                    {x.sample && <span className="absolute top-1 left-1 text-[10px] font-bold bg-amber-300 px-1.5 rounded">{T.sample}</span>}</div>
                  <div className="px-2 py-1 text-[11px]"><div className="font-medium truncate">{x.label}</div>{x.who && <div className="text-slate-500">{x.who}</div>}</div>
                </a>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">{T.queue} <span className="text-sm font-normal text-slate-500">({queue.length})</span></h2>
            {queue.length === 0 && <p className="text-sm text-slate-500 mt-2">{T.nothing}</p>}
            <ul className="space-y-2 mt-2">
              {queue.map((e) => {
                const [, cls] = CAT[e.category] || CAT.other;
                return (
                  <li key={e.id} className={`rounded-lg border p-2.5 ${e.category === "emergency" ? "border-red-400" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>{T.cat[e.category] || T.cat.other}</span>
                      <span className="text-[11px] text-slate-500">{fmt(e.created_date)}</span>
                    </div>
                    <p className="text-sm mt-1"><span className="font-medium">{e.client_first_name || nameOfCase(e.case_id)}:</span> {lang === "en" ? e.summary_en || e.summary_es : e.summary_es || e.summary_en}</p>
                    <button onClick={() => act("quiet", { action: "resolve", case_id: e.case_id, escalation_id: e.id })}
                      className="mt-1.5 flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-slate-50"><Check className="w-3.5 h-3.5" /> {T.resolve}</button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="font-semibold flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> {T.invite}</h2>
            <p className="text-xs text-slate-500">{T.inviteSub}</p>
            <form onSubmit={doInvite} className="flex gap-2 mt-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={T.namePh} className="flex-1 text-sm border rounded-md px-2 py-1.5" />
              <button disabled={busy === "invite"} className="text-sm px-3 py-1.5 rounded-md bg-emerald-700 text-white disabled:opacity-40">{T.create}</button>
            </form>
            {invite && (
              <div className="mt-3 text-sm space-y-2">
                <p>{T.code}: <code className="font-bold">{invite.invite_code}</code></p>
                <p className="text-[11px] text-slate-500">{T.inviteNote}</p>
                <p className="text-xs bg-stone-50 border rounded-md p-2">{inviteText}</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => { navigator.clipboard?.writeText(inviteText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {T.copy}</button>
                </div>
              </div>
            )}
          </section>

        </aside>
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-white/95 border-t text-center text-xs text-slate-600 py-2 px-4">
        {T.footer}
      </footer>
    </div>
  );
}
