import { useState, useEffect } from "react";

// All UI strings for the paralegal portal and the stage view. Adding a language = adding one key here.
// The client-facing product text (WhatsApp replies, the invite message, the phone mock bubbles) stays Spanish.
export const STRINGS = {
  en: {
    banner: "Demo · all data is fictional",
    portalTitle: "Carpeta · Paralegal inbox",
    portalSub: "Clients send documents over WhatsApp, the paralegal reviews, the attorney signs off.",
    present: "▶ Presentation mode",
    refresh: "Refresh",
    teamTitle: "Team assistant (Roberto)",
    teamTag: "Team internal use",
    teamSub: "Ask the team's agent about your cases. It runs on Roberto's FastAPI server; Carpeta calls it through the Base44 function.",
    teamPh: "e.g. Which cases have missing documents?",
    send: "Send",
    thinking: "thinking…",
    noReply: "(no reply)",
    teamOff: "Roberto's assistant is offline right now.",
    clients: "Clients", clientsSub: "· documents pending", nClients: (n) => `${n} clients`, loading: "Loading…",
    of: "of", deliver: "Deliver",
    confirmDeliver: (n) => `Download ${n}'s packet, deliver it, and delete Carpeta's copies of the photos?`,
    confirmWipe: (n) => `Delete everything ${n} sent?`,
    appt: "appointment", clientSees: "Client can see their list", listHidden: "List hidden from client",
    attorneyDecides: "The attorney decides whether this document is requested from this client",
    requested: "requested", notRequested: "not requested", tries: "tries", original: "bring original",
    fingerprint: "Fingerprint of the delivered file", held: "Held photos",
    queue: "Review queue", queueSub: "", nothing: "Nothing pending.", resolve: "Resolve",
    invite: "Invite client", inviteSub: "Carpeta never writes first: you send the code and the client writes.",
    namePh: "First name only", create: "Create", code: "Code", copy: "Copy message", openWa: "Open WhatsApp with the code",
    inviteNote: "Message to the client (in Spanish):",
    how: "How it works",
    howBody: "The paralegal does 80% of the work of gathering and checking documents; Carpeta makes it faster and easier to verify, and the attorney only signs. The client types the code in WhatsApp and Carpeta asks for the list, one document at a time. The count comes from the database, not the model. Every legal question goes to the review queue. Deliver downloads the packet and deletes the photos; only the status and a sha256 fingerprint remain.",
    footer: "Information, not legal advice. The attorney picks the process and signs. · Built on",
    status: { invited: "Invited", active: "Active", complete: "Received, review", delivered: "Delivered", wiped: "Deleted" },
    cat: { emergency: "Emergency", legal_question: "Legal question", notice_or_deadline: "Letter / deadline", name_mismatch: "Name mismatch", outside_window: "Old date", other: "Other" },
    outcome: { accepted: "accepted", retake: "retake", name_mismatch: "name mismatch", outside_window: "old date", unknown: "unclassified" },
    chip: { legal_question: "LEGAL", emergency: "URGENT", name_mismatch: "NAME", outside_window: "DATE", notice_or_deadline: "LETTER", other: "REVIEW" },
    stageH1: "Your immigration documents, over WhatsApp, with your attorney beside you.",
    stageSub: "Sus documentos de inmigración, por WhatsApp, con su abogado/a al lado.",
    receivedReview: "received · review",
    tryIt: "Try it",
    stageFooter: "Built on Base44 · information, not legal advice · fictional data",
    normalView: "normal view",
    moreLangs: "more languages soon",
    tour: "Tour", next: "Next", done: "Done",
    tourSteps: [
      ["Inbox", "Each client has a 12-segment bar. Green segments are documents received over WhatsApp; the count comes from the database, not the AI."],
      ["To review", "Flags land in the review queue: legal questions the assistant refused to answer, names that don't match, bills that are too old. Resolve each one."],
      ["Requested / not requested", "Open a client to see the 12 items. The attorney decides what is asked for: switch any item between requested and not requested, and the count adjusts."],
      ["Done, send it", "Deliver downloads a dated packet for the office, then deletes Carpeta's copies of the photos. Only the status and a fingerprint remain."],
    ],
    tbTitle: "Team backend (Roberto)", tbSub: "Read-only view of Roberto's FastAPI data. Phones show the last 4 digits only.", tbClients: "Clients", tbQueue: "Review queue", tbDocs: "Documents", tbNone: "None yet.", tbOffline: "Offline, showing cached data", tbUpdated: "Updated", tbHearing: "hearing",
  },
  es: {
    banner: "Demo · todos los datos son ficticios",
    portalTitle: "Carpeta · Bandeja del paralegal",
    portalSub: "Los clientes mandan documentos por WhatsApp, el paralegal revisa, el abogado/a firma.",
    present: "▶ Modo presentación",
    refresh: "Actualizar",
    teamTitle: "Asistente del equipo (Roberto)",
    teamTag: "Uso interno del equipo",
    teamSub: "Pregúntele al agente del equipo sobre sus casos. Corre en el servidor FastAPI de Roberto; Carpeta lo llama por la función de Base44.",
    teamPh: "Ej.: ¿Qué casos tienen documentos pendientes?",
    send: "Enviar",
    thinking: "pensando…",
    noReply: "(sin respuesta)",
    teamOff: "El asistente de Roberto está desconectado ahora mismo.",
    clients: "Clientes", clientsSub: "· documentos pendientes", nClients: (n) => `${n} clientes`, loading: "Cargando…",
    of: "de", deliver: "Entregar",
    confirmDeliver: (n) => `¿Descargar el paquete de ${n}, entregarlo y borrar las fotos de Carpeta?`,
    confirmWipe: (n) => `¿Borrar todo lo que ${n} mandó?`,
    appt: "cita", clientSees: "El cliente ve su lista", listHidden: "Lista oculta al cliente",
    attorneyDecides: "El abogado/a decide si se pide este documento a este cliente",
    requested: "se pide", notRequested: "no se pide", tries: "intentos", original: "traer original",
    fingerprint: "Huella del archivo entregado", held: "Fotos retenidas",
    queue: "Cola de revisión", queueSub: "", nothing: "Nada pendiente.", resolve: "Resolver",
    invite: "Invitar cliente", inviteSub: "Carpeta nunca escribe primero: usted le manda el código y el cliente escribe.",
    namePh: "Nombre (solo el primero)", create: "Crear", code: "Código", copy: "Copiar mensaje", openWa: "Abrir WhatsApp con el código",
    inviteNote: "Mensaje para el cliente:",
    how: "Cómo funciona",
    howBody: "El paralegal hace el 80% del trabajo de juntar y revisar documentos; Carpeta lo hace más rápido y fácil de verificar, y el abogado/a solo firma. El cliente escribe el código en WhatsApp y Carpeta le pide la lista, uno por uno. El conteo viene de la base de datos, no del modelo. Toda pregunta legal pasa a la cola de revisión. Entregar descarga el paquete y borra las fotos; quedan el estado y una huella sha256.",
    footer: "Información, no asesoría legal. El abogado/a elige el proceso y firma. · Hecho en",
    status: { invited: "Invitado", active: "Activo", complete: "Recibidos, revisar", delivered: "Entregado", wiped: "Borrado" },
    cat: { emergency: "Emergencia", legal_question: "Pregunta legal", notice_or_deadline: "Carta / plazo", name_mismatch: "Nombre distinto", outside_window: "Fecha vieja", other: "Otro" },
    outcome: { accepted: "aceptado", retake: "repetir foto", name_mismatch: "nombre distinto", outside_window: "fecha vieja", unknown: "sin clasificar" },
    chip: { legal_question: "LEGAL", emergency: "URGENTE", name_mismatch: "NOMBRE", outside_window: "FECHA", notice_or_deadline: "CARTA", other: "REVISAR" },
    stageH1: "Sus documentos de inmigración, por WhatsApp, con su abogado/a al lado.",
    stageSub: "Your immigration documents, over WhatsApp, with your attorney beside you.",
    receivedReview: "recibidos · revisar",
    tryIt: "Pruébelo",
    stageFooter: "Hecho en Base44 · información, no asesoría legal · datos ficticios",
    normalView: "vista normal",
    moreLangs: "más idiomas pronto",
    tour: "Recorrido", next: "Siguiente", done: "Listo",
    tourSteps: [
      ["Bandeja", "Cada cliente tiene una barra de 12 partes. Las verdes son documentos recibidos por WhatsApp; el conteo viene de la base de datos, no de la IA."],
      ["Para revisar", "Las alertas llegan a la cola de revisión: preguntas legales que el asistente no contestó, nombres que no coinciden, facturas muy viejas. Resuelva cada una."],
      ["Se pide / no se pide", "Abra un cliente para ver los 12 documentos. El abogado/a decide qué se pide: cambie cualquier documento entre se pide y no se pide, y el conteo se ajusta."],
      ["Listo, entréguelo", "Entregar descarga un paquete con fecha para la oficina y luego borra las copias de las fotos en Carpeta. Solo quedan el estado y una huella."],
    ],
    tbTitle: "Backend del equipo (Roberto)", tbSub: "Vista de solo lectura de los datos del FastAPI de Roberto. Los teléfonos muestran solo los últimos 4 dígitos.", tbClients: "Clientes", tbQueue: "Cola de revisión", tbDocs: "Documentos", tbNone: "Nada todavía.", tbOffline: "Sin conexión, mostrando datos guardados", tbUpdated: "Actualizado", tbHearing: "audiencia",
  },
};

const KEY = "carpeta_lang";
function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && STRINGS[saved]) return saved;
  } catch { /* storage blocked: fall through */ }
  const nav = (typeof navigator !== "undefined" && navigator.language) || "en";
  return nav.toLowerCase().startsWith("es") ? "es" : "en";
}

export function useLang() {
  const [lang, setLang] = useState(initial);
  useEffect(() => {
    try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
    document.documentElement.lang = lang;
  }, [lang]);
  return [lang, setLang, STRINGS[lang]];
}

export function LangToggle({ lang, setLang, dark = false, t }) {
  const base = dark ? "border-white/20" : "border-slate-300";
  return (
    <div className="flex items-center gap-2">
      <div className={`flex rounded-md border ${base} overflow-hidden text-xs font-semibold`} role="group" aria-label="Language">
        {Object.keys(STRINGS).map((l) => (
          <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
            className={`px-2.5 py-1 ${lang === l ? (dark ? "bg-lime-400 text-black" : "bg-slate-900 text-white") : dark ? "text-slate-300" : "text-slate-600 bg-white"}`}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <span className={`text-[10px] ${dark ? "text-slate-500" : "text-slate-400"}`}>{t.moreLangs}</span>
    </div>
  );
}
