import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Base44Logo } from "@/components/Base44Logo";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import { FolderOpen, Check } from "lucide-react";
import { useLang, LangToggle } from "@/i18n";

// Big-screen presentation view (Esteban's picks, Oct 10 14:21): phone on the left, progress on the right.
// Pure UI over Base44 realtime; spends no AI credits.
const db = base44.entities;
const APP_URL = "https://carpeta-08916c4a.base44.app";
const WA = "+1 978-991-5607";
const LIME = "#a3e635";

const BOT_LINE = {
  accepted: (label, n, t) => `✅ Recibido: ${label}. Ya tiene ${n} de ${t}.`,
  retake: () => "📸 La foto salió borrosa o cortada. Tómela otra vez en una mesa, con luz.",
  name_mismatch: () => "Este documento parece estar a nombre de otra persona. Se lo paso a su abogado/a.",
  outside_window: () => "Esta factura es vieja. Su abogado/a necesita una de los últimos 90 días.",
  unknown: () => "No reconocí este documento. ¿Cuál es? Responda con el número.",
};
const CHIP = {
  legal_question: ["LEGAL", "bg-red-500 text-white"],
  emergency: ["URGENTE", "bg-red-600 text-white"],
  name_mismatch: ["NOMBRE", "bg-amber-400 text-black"],
  outside_window: ["FECHA", "bg-sky-400 text-black"],
  notice_or_deadline: ["CARTA", "bg-orange-400 text-black"],
  other: ["REVISAR", "bg-slate-300 text-black"],
};
const SEG = { received: "bg-lime-400", delivered: "bg-lime-500", needs_retake: "bg-amber-400", flagged: "bg-amber-400" };
const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString("es-US", { hour: "numeric", minute: "2-digit" }) : "");
const serif = { fontFamily: "Georgia, 'Times New Roman', serif" };

// Offline replay (?stage&replay): a scripted 12-document run built in the browser, no database calls,
// so the demo survives dead wifi. Space or click starts it; it loops.
const REPLAY_ROWS = [
  ["i589_receipt", "Recibo del I-589 (aviso I-797C)", "I-589 receipt notice (I-797C)", "01-I-797C-receipt-I-589.png"],
  ["passport_photo", "Primera foto tipo pasaporte", "Passport-style photo (1 of 2)", "02-photo-1.png"],
  ["passport_photo", "Segunda foto tipo pasaporte", "Passport-style photo (2 of 2)", "03-photo-2.png"],
  ["lease", "Contrato de renta", "Lease", "04-lease.png"],
  ["paystub", "Primer talón de pago", "Pay stub (1 of 2)", "05-paystub-aug.png"],
  ["paystub", "Segundo talón de pago", "Pay stub (2 of 2)", "06-paystub-sep.png"],
  ["utility_bill", "Factura de luz o gas (de los últimos 90 días)", "Utility bill (last 90 days)", "07-utility-bill-sep.png"],
  ["school_letter", "Carta de la escuela", "School letter", "08-school-letter.png"],
  ["clinic_letter", "Carta de la clínica", "Clinic letter", "09-clinic-letter.png"],
  ["church_letter", "Carta de la iglesia o parroquia", "Church or parish letter", "10-church-letter.png"],
  ["prior_ead", "Permiso de trabajo anterior (si tiene)", "Prior work permit (if any)", "11-prior-EAD.png"],
  ["i589_copy", "Copia del I-589 (primera página)", "I-589 copy (first page)", "12-I-589-first-page.png"],
];
function replayData(step) {
  const t0 = Date.now() - 60000;
  const ts = (i) => new Date(t0 + i * 4000).toISOString();
  const items = REPLAY_ROWS.map((r, i) => ({ id: "r" + i, case_id: "rc", order: i + 1, doc_type: r[0], label_es: r[1], label_en: r[2], status: i < step ? "received" : "missing" }));
  const docs = REPLAY_ROWS.slice(0, step).map((r, i) => ({ id: "d" + i, case_id: "rc", checklist_item_id: "r" + i, outcome: "accepted", file_url: "/demo-docs/" + r[3], created_date: ts(i) }));
  const esc = step >= 6 ? [{ id: "e1", case_id: "rc", category: "legal_question", status: "open", summary_es: "¿Califico para la residencia? (pasado al abogado/a)", summary_en: "Does she qualify for a green card? (sent to the attorney)", created_date: ts(6) }] : [];
  return {
    clients: [{ id: "rcl", first_name: "María", invite_code: "MARIA1", linked_at: ts(-2), consent_at: ts(-1) }],
    cases: [{ id: "rc", client_id: "rcl", process_label: "Permiso de trabajo (asilo pendiente), I-765 (c)(8)", items_total: 12, items_received: step }],
    items, docs, esc,
  };
}
const IS_REPLAY = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("replay");

export default function Stage() {
  const [lang, setLang, T] = useLang();
  const [d, setD] = useState({ clients: [], cases: [], items: [], docs: [], esc: [] });
  const [who, setWho] = useState("MARIA1");
  const [pulse, setPulse] = useState(0);
  const prev = useRef(null);

  const load = useCallback(async () => {
    const [clients, cases, items, docs, esc] = await Promise.all([
      db.Client.list(), db.Case.list(), db.ChecklistItem.list(), db.Document.list("created_date"), db.Escalation.list("-created_date"),
    ]);
    setD({ clients, cases, items, docs, esc });
  }, []);

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!IS_REPLAY) return;
    REPLAY_ROWS.forEach((r) => { const im = new Image(); im.src = "/demo-docs/" + r[3]; }); // preload
    const start = (e) => { if (!e || e.type === "click" || e.code === "Space") { setPlaying(true); setStep(0); } };
    window.addEventListener("keydown", start);
    window.addEventListener("click", start);
    return () => { window.removeEventListener("keydown", start); window.removeEventListener("click", start); };
  }, []);
  useEffect(() => {
    if (!IS_REPLAY || !playing) return;
    const t = setTimeout(() => setStep((n) => (n >= 12 ? 0 : n + 1)), step >= 12 ? 7000 : 2600);
    return () => clearTimeout(t);
  }, [IS_REPLAY, playing, step]);
  useEffect(() => { if (IS_REPLAY) setD(replayData(step)); }, [step]);

  useEffect(() => {
    if (IS_REPLAY) return;
    load();
    let timer = null;
    const soon = () => { clearTimeout(timer); timer = setTimeout(load, 800); }; // one reload per burst of events
    const subs = [db.Document, db.ChecklistItem, db.Escalation, db.Client, db.Case].map((e) => e.subscribe(soon));
    const poll = setInterval(() => { if (!document.hidden) load(); }, 30000); // fallback if realtime is unavailable
    return () => { subs.forEach((u) => typeof u === "function" && u()); clearInterval(poll); clearTimeout(timer); };
  }, [load]);

  const client = d.clients.find((c) => c.invite_code === who) || d.clients[0];
  const kase = d.cases.find((k) => k.client_id === client?.id);
  const rows = d.items.filter((i) => i.case_id === kase?.id).sort((a, b) => a.order - b.order);
  const docs = d.docs.filter((x) => x.case_id === kase?.id);
  const got = kase?.items_received || 0;
  const total = kase?.items_total || 12;
  const queue = d.esc.filter((e) => e.status === "open" && e.case_id === kase?.id);

  useEffect(() => {
    if (!kase) return;
    if (prev.current && prev.current.id === kase.id && got > prev.current.n) {
      setPulse(Date.now());
      if (got >= total) confetti({ particleCount: 260, spread: 120, origin: { x: 0.65, y: 0.35 }, colors: [LIME, "#ffffff", "#0b1a33"] });
    }
    prev.current = { id: kase.id, n: got };
  }, [got, total, kase]);

  const resolve = async (e) => {
    if (IS_REPLAY) return;
    await base44.functions.invoke("carpeta-api", { action: "resolve", case_id: e.case_id, escalation_id: e.id });
    load();
  };

  let running = 0;
  const thread = [
    { me: true, text: client?.invite_code || "", t: client?.linked_at },
    { me: false, text: `Hola ${client?.first_name || ""}, soy Carpeta, el asistente de documentos de su abogado/a. No somos abogados. ¿Empezamos?`, t: client?.linked_at },
    ...(client?.consent_at ? [{ me: true, text: "SÍ", t: client.consent_at }] : []),
    ...docs.flatMap((x) => {
      const slot = rows.find((r) => r.id === x.checklist_item_id);
      if (x.outcome === "accepted") running += 1;
      return [{ me: true, img: x.file_url, t: x.created_date }, { me: false, text: (BOT_LINE[x.outcome] || BOT_LINE.unknown)(slot?.label_es || "", running, total), t: x.created_date }];
    }),
  ].slice(-7);

  return (
    <div className="min-h-screen bg-[#0b1a33] text-white">
      <style>{`
        @keyframes pulseOnce { 0% { box-shadow: 0 0 0 0 rgba(163,230,53,.6) } 100% { box-shadow: 0 0 0 28px rgba(163,230,53,0) } }
        .pulse-once { animation: pulseOnce 1.1s ease-out 1 }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        .fade-up { animation: fadeUp .4s ease-out both }
      `}</style>

      {IS_REPLAY && !playing && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-lime-400 text-black text-sm font-semibold px-4 py-1.5 rounded-full">Replay · press Space or click to start</div>
      )}
      <header className="px-12 pt-8">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-10 h-10" style={{ color: LIME }} />
          <h1 className="text-5xl" style={serif}>Carpeta</h1>
          <div className="ml-auto"><LangToggle lang={lang} setLang={setLang} t={T} dark /></div>
        </div>
        <p className="text-2xl mt-2" style={serif}>{T.stageH1}</p>
        <p className="text-base text-slate-400 mt-1">{T.stageSub}</p>
      </header>

      <main className="grid grid-cols-12 gap-12 px-12 py-6 pb-28">
        {/* Left: phone + review strip */}
        <section className="col-span-5 flex flex-col items-center gap-5">
          <div className="w-[300px] h-[470px] rounded-[44px] border-[10px] border-[#14284d] bg-[#ece5dd] shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-[#075e54] px-4 py-3 flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center"><FolderOpen className="w-5 h-5 text-[#075e54]" /></div>
              <div><div className="font-semibold">Carpeta</div><div className="text-[11px] text-green-100">{WA}</div></div>
            </div>
            <div className="flex-1 p-3 space-y-2 overflow-hidden flex flex-col justify-end">
              {thread.map((m, i) => (
                <div key={i} className={`fade-up max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-snug text-black shadow-sm ${m.me ? "self-end bg-[#dcf8c6]" : "self-start bg-white"}`}>
                  {m.img ? <img src={m.img} alt="" className="w-40 h-28 object-cover rounded" /> : m.text}
                  <div className="text-[10px] text-slate-500 text-right mt-0.5">{hhmm(m.t)}</div>
                </div>
              ))}
            </div>
          </div>
          {queue.length > 0 && (
            <div className="w-full max-w-[460px] space-y-2">
              {queue.slice(0, 3).map((e) => {
                const [, cls] = CHIP[e.category] || CHIP.other;
                const chip = T.chip[e.category] || T.chip.other;
                return (
                  <div key={e.id} className="fade-up flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${cls}`}>{chip}</span>
                    <span className="flex-1 text-sm text-slate-200 truncate">{lang === "en" ? e.summary_en || e.summary_es : e.summary_es}</span>
                    <button onClick={() => resolve(e)} className="text-xs px-2 py-1 rounded-md border border-white/20 hover:bg-white/10">{T.resolve}</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: the bar, the label, the rows */}
        <section className="col-span-7">
          <div className="text-slate-400 text-lg">{client?.first_name} · {kase?.process_label}</div>
          <div key={pulse} className={`mt-4 rounded-2xl p-2 ${pulse ? "pulse-once" : ""}`}>
            <div className="flex gap-1.5">
              {rows.map((r) => (
                <div key={r.id} className={`h-6 flex-1 rounded-md transition-colors duration-700 ${SEG[r.status] || "bg-white/10"} ${r.required === false ? "opacity-20" : ""}`} />
              ))}
            </div>
          </div>
          <div className="mt-3 text-4xl" style={serif}>
            <span style={{ color: LIME }} className="font-bold">{got}</span> {T.of} {total} {got >= total && <span className="text-2xl text-amber-300 ml-3">{T.receivedReview}</span>}
          </div>

          <ul className="mt-6 grid grid-cols-2 gap-x-10 gap-y-2.5 text-lg">
            {rows.map((r) => {
              const done = ["received", "delivered"].includes(r.status);
              return (
                <li key={r.id} className={`flex items-center gap-3 ${r.required === false ? "opacity-30 line-through" : ""}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${done ? "border-lime-400 bg-lime-400" : r.status === "needs_retake" ? "border-amber-400" : "border-white/30"}`}>
                    {done && <Check className="w-3.5 h-3.5 text-[#0b1a33]" strokeWidth={3} />}
                  </span>
                  <span className={done ? "text-white" : "text-slate-400"}>{lang === "en" ? r.label_en || r.label_es : r.label_es}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="fixed bottom-0 inset-x-0 flex items-center justify-between gap-6 px-12 py-3 bg-black/30 text-slate-300 text-sm">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1.5 rounded"><QRCodeSVG value={APP_URL} size={56} /></div>
          <div><div className="text-white font-semibold">{T.tryIt} · {WA}</div><div className="text-slate-400 text-xs">{APP_URL.replace("https://", "")}</div></div>
        </div>
        <div className="flex items-center gap-2">
          {d.clients.slice(0, 4).map((c) => (
            <button key={c.id} onClick={() => setWho(c.invite_code)}
              className={`px-3 py-1 rounded-full text-xs ${c.invite_code === client?.invite_code ? "bg-lime-400 text-black font-semibold" : "bg-white/10"}`}>{c.first_name}</button>
          ))}
        </div>
        <div className="flex items-center gap-2"><Base44Logo className="w-5 h-5" /> {T.stageFooter}</div>
      </footer>
    </div>
  );
}
