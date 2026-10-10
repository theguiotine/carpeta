import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Base44Logo } from "@/components/Base44Logo";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import { ShieldCheck, Scale, Zap, Lock, MessageCircle, FolderOpen, Database, Bot, Server } from "lucide-react";

// Big-screen presentation view: phone on the left, the live checklist in the middle,
// the review queue and a live activity feed on the right. Pure UI over Base44 realtime;
// it spends no AI credits.
const db = base44.entities;
const APP_URL = "https://carpeta-08916c4a.base44.app";
const WA = "+1 978-991-5607";

const BOT_LINE = {
  accepted: (label, n, t) => `✅ Recibido: ${label}. Ya tiene ${n} de ${t}.`,
  retake: () => "📸 La foto salió borrosa o cortada. Tómela otra vez en una mesa, con luz.",
  name_mismatch: () => "🟡 Este documento parece estar a nombre de otra persona. Se lo paso a su abogado/a.",
  outside_window: () => "🟡 Esta factura es vieja. Su abogado/a necesita una de los últimos 90 días.",
  unknown: () => "🤔 No reconocí este documento. ¿Cuál es? Responda con el número.",
};
const CAT = {
  legal_question: ["⚖️", "Pregunta legal → abogado/a"],
  emergency: ["🚨", "Emergencia"],
  name_mismatch: ["🪪", "Nombre distinto"],
  outside_window: ["📅", "Fecha vieja"],
  notice_or_deadline: ["✉️", "Carta del gobierno"],
  other: ["📝", "Para revisar"],
};
const ICON = { lease: "🏠", paystub: "💵", utility_bill: "💡", i589_receipt: "📨", passport_photo: "🖼️", school_letter: "🏫", clinic_letter: "🩺", church_letter: "⛪", prior_ead: "🪪", i589_copy: "📄" };

const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString("es-US", { hour: "numeric", minute: "2-digit" }) : "");

export default function Stage() {
  const [d, setD] = useState({ clients: [], cases: [], items: [], docs: [], esc: [] });
  const [who, setWho] = useState("MARIA1");
  const [feed, setFeed] = useState([]);
  const [flash, setFlash] = useState(null);
  const prevCount = useRef(null);

  const load = useCallback(async () => {
    const [clients, cases, items, docs, esc] = await Promise.all([
      db.Client.list(), db.Case.list(), db.ChecklistItem.list(), db.Document.list("created_date"), db.Escalation.list("-created_date"),
    ]);
    setD({ clients, cases, items, docs, esc });
  }, []);

  useEffect(() => {
    load();
    const push = (kind) => (ev) => {
      setFeed((f) => [{ id: ev.id + ev.type + Date.now(), kind, type: ev.type, data: ev.data, t: new Date().toISOString() }, ...f].slice(0, 8));
      load();
    };
    const subs = [db.Document.subscribe(push("doc")), db.ChecklistItem.subscribe(push("item")), db.Escalation.subscribe(push("esc")), db.Client.subscribe(push("client"))];
    const poll = setInterval(load, 8000); // fallback if realtime is unavailable
    return () => { subs.forEach((u) => typeof u === "function" && u()); clearInterval(poll); };
  }, [load]);

  const client = d.clients.find((c) => c.invite_code === who) || d.clients[0];
  const kase = d.cases.find((k) => k.client_id === client?.id);
  const rows = d.items.filter((i) => i.case_id === kase?.id).sort((a, b) => a.order - b.order);
  const docs = d.docs.filter((x) => x.case_id === kase?.id);
  const got = kase?.items_received || 0;
  const total = kase?.items_total || 12;
  const queue = d.esc.filter((e) => e.status === "open");

  useEffect(() => {
    if (!kase) return; // wait for real data so the first load does not fire confetti
    if (prevCount.current !== null && prevCount.current.id === kase.id && got > prevCount.current.n) {
      setFlash(Date.now());
      confetti({ particleCount: got >= total ? 260 : 60, spread: got >= total ? 120 : 55, origin: { x: 0.5, y: 0.35 }, colors: ["#10b981", "#f59e0b", "#ffffff"] });
    }
    prevCount.current = { id: kase.id, n: got };
  }, [got, total, kase]);

  // Rebuild the WhatsApp thread from what the database recorded.
  let running = 0;
  const thread = [
    { me: true, text: client?.invite_code || "", t: client?.linked_at },
    { me: false, text: `Hola ${client?.first_name || ""}, soy Carpeta, el asistente de documentos de su abogado/a. No somos abogados. Nunca escriba números de pasaporte aquí. ¿Empezamos?`, t: client?.linked_at },
    ...(client?.consent_at ? [{ me: true, text: "SÍ", t: client.consent_at }] : []),
    ...docs.flatMap((x) => {
      const slot = rows.find((r) => r.id === x.checklist_item_id);
      if (x.outcome === "accepted") running += 1;
      const line = (BOT_LINE[x.outcome] || BOT_LINE.unknown)(slot?.label_es || "", running, total);
      return [{ me: true, img: x.file_url, t: x.created_date }, { me: false, text: line, t: x.created_date }];
    }),
    ...queue.filter((e) => e.case_id === kase?.id && e.category === "legal_question").map((e) => [
      { me: true, text: e.summary_es?.replace(/^.*pregunta /i, "¿") || "¿Califico?", t: e.created_date },
      { me: false, text: "⚖️ Esa pregunta la tiene que contestar su abogado/a. Ya se la pasé.", t: e.created_date },
    ]).flat(),
  ].slice(-9);

  return (
    <div className="min-h-screen bg-[#0b1220] text-white overflow-hidden" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @keyframes pop { 0% { transform: scale(.6); opacity: 0 } 70% { transform: scale(1.08) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes slideIn { from { transform: translateX(30px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 0 rgba(16,185,129,0) } 50% { box-shadow: 0 0 40px rgba(16,185,129,.55) } }
        .pop { animation: pop .5s ease-out both } .slide { animation: slideIn .45s ease-out both } .glow { animation: glow 1.6s ease-in-out 2 }
      `}</style>

      <header className="flex items-center justify-between px-10 pt-6">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-10 h-10 text-emerald-400" />
          <div>
            <div className="text-4xl font-extrabold tracking-tight">Carpeta</div>
            <div className="text-slate-400 text-lg">Documentos de inmigración por WhatsApp · el paralegal revisa · el abogado/a firma</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {d.clients.slice(0, 4).map((c) => (
            <button key={c.id} onClick={() => setWho(c.invite_code)}
              className={`px-4 py-2 rounded-full text-lg ${c.invite_code === client?.invite_code ? "bg-emerald-500 text-black font-bold" : "bg-white/10"}`}>{c.first_name}</button>
          ))}
          <a href="/" className="ml-3 text-sm text-slate-400 underline">vista normal</a>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-8 px-10 py-6">
        {/* Phone */}
        <section className="col-span-3">
          <div className="mx-auto w-[300px] h-[600px] rounded-[44px] border-[10px] border-slate-800 bg-[#0b141a] shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-[#1f2c34] px-4 py-3 flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center"><FolderOpen className="w-5 h-5 text-black" /></div>
              <div><div className="font-semibold">Carpeta</div><div className="text-[11px] text-emerald-300">WhatsApp · {WA}</div></div>
            </div>
            <div className="flex-1 p-3 space-y-2 overflow-hidden flex flex-col justify-end" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
              {thread.map((m, i) => (
                <div key={i} className={`slide max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-snug ${m.me ? "self-end bg-[#005c4b]" : "self-start bg-[#1f2c34]"}`}>
                  {m.img ? <img src={m.img} alt="" className="w-40 h-28 object-cover rounded-md" /> : m.text}
                  <div className="text-[10px] text-slate-400 text-right mt-0.5">{hhmm(m.t)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Counter + checklist */}
        <section className="col-span-6">
          <div key={flash} className={`rounded-3xl bg-white/5 border border-white/10 p-6 ${flash ? "glow" : ""}`}>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-slate-400 text-xl">{client?.first_name} · {kase?.process_label}</div>
                <div className="flex items-baseline gap-3 mt-1">
                  <span key={got} className="pop text-[120px] leading-none font-black text-emerald-400 tabular-nums">{got}</span>
                  <span className="text-5xl text-slate-500 font-bold">de {total}</span>
                </div>
              </div>
              <div className="text-right text-slate-300 text-lg">
                {got >= total ? <span className="text-amber-300 font-bold">Recibidos · revisar</span> : <>Falta: <b>{rows.find((r) => r.required !== false && !["received", "delivered"].includes(r.status))?.label_es}</b></>}
              </div>
            </div>
            <div className="grid grid-cols-6 gap-3 mt-6">
              {rows.map((r) => {
                const done = ["received", "delivered"].includes(r.status);
                const doc = docs.find((x) => x.checklist_item_id === r.id && x.outcome === "accepted");
                return (
                  <div key={r.id + r.status} className={`${done ? "pop" : ""} relative h-28 rounded-2xl overflow-hidden border ${done ? "border-emerald-400 bg-emerald-500/15" : r.status === "needs_retake" ? "border-amber-400 bg-amber-500/10" : "border-white/10 bg-white/5"} ${r.required === false ? "opacity-30" : ""}`}>
                    {doc && <img src={doc.file_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
                    <div className="relative p-2 h-full flex flex-col justify-between">
                      <div className="text-3xl">{done ? "✅" : ICON[r.doc_type] || "📄"}</div>
                      <div className="text-[12px] leading-tight font-medium">{r.label_es}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <Pill icon={<Zap className="w-6 h-6" />} big="0" small="IA escribe el conteo · viene de la base de datos" />
            <Pill icon={<Scale className="w-6 h-6" />} big={String(d.esc.filter((e) => e.category === "legal_question").length)} small="preguntas legales enviadas al abogado/a, no contestadas por la IA" />
            <Pill icon={<Lock className="w-6 h-6" />} big="sha256" small="al entregar: solo un conteo y una huella, sin imágenes" />
          </div>
        </section>

        {/* Queue + feed + QR */}
        <section className="col-span-3 space-y-5">
          <div>
            <div className="text-slate-400 uppercase tracking-widest text-sm mb-2">Cola de revisión</div>
            <div className="space-y-2">
              {queue.slice(0, 4).map((e) => {
                const [ic, lbl] = CAT[e.category] || CAT.other;
                return (
                  <div key={e.id} className={`slide rounded-xl p-3 ${e.category === "emergency" ? "bg-red-600" : "bg-white/5 border border-white/10"}`}>
                    <div className="text-sm font-semibold">{ic} {lbl} · {e.client_first_name}</div>
                    <div className="text-[13px] text-slate-300 mt-0.5">{e.summary_es}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-slate-400 uppercase tracking-widest text-sm mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> En vivo</div>
            <div className="space-y-1 text-[13px] text-slate-300">
              {feed.length === 0 && <div className="text-slate-500">Esperando el próximo mensaje…</div>}
              {feed.map((f) => (
                <div key={f.id} className="slide">
                  {hhmm(f.t)} · {f.kind === "doc" ? `foto ${f.data?.outcome || "recibida"}` : f.kind === "esc" ? "pregunta → cola" : f.kind === "item" ? `${f.data?.label_es || "documento"}: ${f.data?.status}` : "cliente actualizado"}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black flex items-center gap-4">
            <QRCodeSVG value={APP_URL} size={110} />
            <div className="text-sm"><div className="font-bold text-base">Pruébelo</div>Abra el panel en su teléfono. WhatsApp: {WA}</div>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 inset-x-0 flex items-center justify-between px-10 py-3 bg-black/40 text-slate-300 text-sm">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5"><Base44Logo className="w-5 h-5" /> Hecho en Base44:</span>
          <span className="flex items-center gap-1"><Database className="w-4 h-4" /> 6 entidades en tiempo real</span>
          <span className="flex items-center gap-1"><Server className="w-4 h-4" /> función backend determinista</span>
          <span className="flex items-center gap-1"><Bot className="w-4 h-4" /> agente con canal WhatsApp nativo</span>
          <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4" /> acceso anónimo</span>
        </div>
        <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Información, no asesoría legal · datos ficticios</div>
      </footer>
    </div>
  );
}

function Pill({ icon, big, small }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
      <div className="text-emerald-400">{icon}</div>
      <div><div className="text-2xl font-black">{big}</div><div className="text-[12px] text-slate-400 leading-tight">{small}</div></div>
    </div>
  );
}
