// Carpeta backend: the deterministic layer. The assistant calls this function and sends
// `reply_text` back unchanged, so every count ("3 de 12") comes from database rows, never
// from model text. Actions: link, consent, progress, file, escalate, deliver, wipe, seed.
import { createClientFromRequest } from "npm:@base44/sdk";

const DOC_TYPES = [
  "i589_receipt", "passport_photo", "lease", "paystub", "utility_bill",
  "school_letter", "clinic_letter", "church_letter", "prior_ead", "i589_copy",
];
const RETAKE_FLAGS = ["blurry", "cut_off", "glare"];
const ADDRESS_WINDOW_DAYS = 90; // the provider's setting, not a USCIS rule

const RETAKE_LINES: Record<string, string> = {
  blurry: "La foto salió borrosa. Póngala en una mesa, con luz de arriba, sin flash, y tómela otra vez.",
  cut_off: "La foto salió cortada. Que se vean las cuatro esquinas del papel y tómela otra vez.",
  glare: "La foto tiene un reflejo de luz. Muévala un poco para que no brille y tómela otra vez.",
};

const ESCALATION_REPLIES: Record<string, string> = {
  legal_question:
    "Esa pregunta la tiene que contestar su abogado/a, porque depende de su caso. Ya se la pasé y le avisará. Mientras tanto, seguimos con sus documentos.",
  notice_or_deadline: "Recibí la carta. Se la paso a su abogado/a ahora para que la revise.",
  emergency:
    "Llame a su abogado/a ahora. Si no contesta: línea de la Oficina para Nuevos Americanos de NY, 1-800-566-7636. Si ICE está en la puerta: no abra, pida que pasen la orden firmada por un juez por debajo de la puerta, y tiene derecho a guardar silencio.",
  other: "Se lo paso a su abogado/a para que lo revise.",
};

const ITEM_TEMPLATE = [
  ["i589_receipt", "i589_receipt", "Recibo del I-589 (aviso I-797C)", "I-589 receipt notice (I-797C)", "USCIS", "Es la carta de USCIS que llegó por correo después de pedir asilo. Arriba dice I-797C."],
  ["passport_photo_1", "passport_photo", "Primera foto tipo pasaporte", "Passport-style photo (1 of 2)", "USCIS", "Una foto a color, fondo blanco. Tráigala también en papel a la cita."],
  ["passport_photo_2", "passport_photo", "Segunda foto tipo pasaporte", "Passport-style photo (2 of 2)", "USCIS", "La segunda foto, igual a la primera."],
  ["lease", "lease", "Contrato de renta", "Lease", "FIRM", "El contrato del lugar donde vive, la página con su nombre y la dirección."],
  ["paystub_1", "paystub", "Primer talón de pago", "Pay stub (1 of 2)", "FIRM", "El papel que viene con el pago. Su abogado/a lo pidió para su expediente."],
  ["paystub_2", "paystub", "Segundo talón de pago", "Pay stub (2 of 2)", "FIRM", "El talón de pago más reciente."],
  ["utility_bill", "utility_bill", "Factura de luz o gas (de los últimos 90 días)", "Utility bill (last 90 days)", "FIRM", "Una factura reciente con su nombre y dirección."],
  ["school_letter", "school_letter", "Carta de la escuela", "School letter", "FIRM", "Una carta de la escuela de sus hijos, si la tiene."],
  ["clinic_letter", "clinic_letter", "Carta de la clínica", "Clinic letter", "FIRM", "Una carta de la clínica donde la atienden. No hace falta información médica."],
  ["church_letter", "church_letter", "Carta de la iglesia o parroquia", "Church or parish letter", "FIRM", "Una carta de su iglesia o de una organización de la comunidad."],
  ["prior_ead", "prior_ead", "Permiso de trabajo anterior (si tiene)", "Prior work permit (if any)", "USCIS", "La tarjeta de permiso de trabajo anterior, frente."],
  ["i589_copy", "i589_copy", "Copia del I-589 (primera página)", "I-589 copy (first page)", "FIRM", "La primera página de su solicitud de asilo."],
];
// "¿Dónde lo consigo?": step-by-step help for finding each document on her own phone or
// by asking the right person. Data, not agent prose: served by action "howto" word for word.
// Rails: never asks for a password, a code or an ID number, never logs in for her.
const SAFETY_LINE = "Nunca le voy a pedir su contraseña ni los códigos que le lleguen por mensaje. No los mande aquí.";
const FORGOT_PASSWORD =
  "Si no recuerda la contraseña: en la pantalla de entrada toque \"¿Olvidó su contraseña?\" (o \"Forgot password\"). Le llega un código por mensaje de texto o correo; escríbalo solo en esa app, nunca aquí.";
const HOWTO: Record<string, string[]> = {
  i589_receipt: [
    "Busque una carta de USCIS que llegó por correo después de pedir asilo. Arriba dice \"I-797C, Notice of Action\".",
    "Si no la encuentra, su abogado/a casi siempre tiene una copia. Responda AYUDA y se lo pregunto.",
    "Si tiene cuenta en my.uscis.gov, entre y busque \"Documents\" o \"Notices\": ahí está la misma carta.",
  ],
  passport_photo: [
    "Puede tomarse las fotos en una farmacia (CVS, Walgreens) pidiendo \"passport photos\".",
    "Pida dos fotos iguales. Tome una foto de las fotos en una mesa y mándemela.",
    "Guarde las fotos de papel para llevarlas a su cita.",
  ],
  lease: [
    "Busque el contrato que firmó cuando se mudó.",
    "Si no lo tiene, pídale una copia al dueño o al manager. Puede mandarle este texto: \"Hola, ¿me puede mandar una copia de mi contrato de renta? Gracias.\"",
    "Si se lo mandan por correo o WhatsApp, reenvíemelo aquí.",
  ],
  paystub: [
    "Es el papel o el correo que le dan con cada pago.",
    "Si su trabajo usa una app de pagos (por ejemplo ADP o Paychex), ábrala y busque \"Pay statements\" o \"Recibos\"; tome captura de pantalla del más reciente.",
    FORGOT_PASSWORD,
  ],
  utility_bill: [
    "Abra la app o la página de su compañía de luz o gas (por ejemplo Con Edison o National Grid).",
    "Toque \"Billing\" o \"Facturas\" y abra la factura más reciente. Tome captura de pantalla de la página con su nombre y dirección.",
    FORGOT_PASSWORD,
    "Si no tiene cuenta, la factura de papel que llega por correo también sirve.",
  ],
  school_letter: [
    "Pida en la oficina principal (\"main office\") de la escuela una carta que diga que su hijo/a está inscrito/a.",
    "Puede decir: \"Necesito una carta de inscripción para mi abogado/a de inmigración.\"",
    "Cuando se la den, tome la foto en una mesa con buena luz.",
  ],
  clinic_letter: [
    "Pida en la recepción de la clínica una carta que diga que usted es paciente desde cierta fecha.",
    "No hace falta información médica; solo su nombre y desde cuándo la atienden.",
  ],
  church_letter: [
    "Pídale al padre, pastor o a la oficina de la parroquia una carta que diga que usted participa en la comunidad y desde cuándo.",
    "Si va a un grupo comunitario, también sirve una carta de ellos.",
  ],
  prior_ead: [
    "Si alguna vez tuvo permiso de trabajo, es una tarjeta de plástico que dice \"Employment Authorization Card\".",
    "Tome foto del frente en una mesa. Si nunca tuvo uno, responda NO TENGO y se lo aviso a su abogado/a.",
  ],
  i589_copy: [
    "Es la primera página de su solicitud de asilo. Su abogado/a o la organización que le ayudó a llenarla suele tener una copia.",
    "Si no la tiene, responda AYUDA y se lo pregunto a su abogado/a.",
  ],
};
const howtoText = (docType: string, label: string) => {
  const steps = HOWTO[docType] || ["Pregúntele a su abogado/a. Responda AYUDA y se lo paso."];
  return `Cómo conseguir: ${label}\n` + steps.map((s, i) => `${i + 1}. ${s}`).join("\n") + `\n\n${SAFETY_LINE}`;
};

const USCIS_SOURCE = "https://www.uscis.gov/i-765";
const SOURCE_READ = "2026-10-10";

const now = () => new Date().toISOString();
const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
const ok = (body: Record<string, unknown>) => Response.json({ ok: true, ...body });
const fail = (reply_text: string, extra: Record<string, unknown> = {}) => Response.json({ ok: false, reply_text, ...extra });
const ID_NUMBER = /\d{7,}/;

async function sha256Hex(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    const buf = await res.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole.entities;
  const input = await req.json().catch(() => ({}));
  const action = String(input.action || "");

  async function loadByCode(code: string) {
    const clean = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const clients = await db.Client.filter({ invite_code: clean });
    const client = clients[0];
    if (!client) return null;
    const kase = (await db.Case.filter({ client_id: client.id }))[0];
    const provider = client.provider_id ? await db.Provider.get(client.provider_id) : null;
    return { client, kase, provider };
  }

  async function loadByCase(caseId: string) {
    const kase = await db.Case.get(caseId);
    const client = await db.Client.get(kase.client_id);
    const provider = client.provider_id ? await db.Provider.get(client.provider_id) : null;
    return { client, kase, provider };
  }

  async function items(caseId: string) {
    const rows = await db.ChecklistItem.filter({ case_id: caseId });
    return rows.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  }

  async function recount(caseId: string) {
    const rows = await items(caseId);
    const required = rows.filter((r: any) => r.required !== false);
    const received = required.filter((r: any) => r.status === "received" || r.status === "delivered").length;
    await db.Case.update(caseId, { items_received: received, items_total: required.length });
    return { rows, received, total: required.length };
  }

  function missingLine(rows: any[], max = 3) {
    const missing = rows.filter((r: any) => r.required !== false && !["received", "delivered"].includes(r.status));
    if (!missing.length) return "";
    const named = missing.slice(0, max).map((r: any) => r.label_es).join(", ");
    return missing.length > max ? `${named} y ${missing.length - max} más` : named;
  }

  async function escalate(ctx: any, category: string, summary_es: string, summary_en: string) {
    const clean = (s: string) => (ID_NUMBER.test(s || "") ? "(texto retirado: contenía un número)" : (s || "").slice(0, 140));
    await db.Escalation.create({
      case_id: ctx.kase.id,
      client_first_name: ctx.client.first_name,
      category,
      summary_es: clean(summary_es),
      summary_en: clean(summary_en),
      status: "open",
    });
  }

  const touch = (client: any) => db.Client.update(client.id, { last_activity_at: now() });

  // ---------- seed (fictional demo data only) ----------
  if (action === "seed") {
    const existing = await db.Provider.filter({ name: "Lcda. Ana Ejemplo" });
    if (existing.length && !input.force) return ok({ reply_text: "Seed already present", provider_id: existing[0].id });
    const provider = await db.Provider.create({
      name: "Lcda. Ana Ejemplo",
      organization: "Ejemplo Immigration Law, PLLC (ficticio)",
      kind: "attorney",
      email: String(input.provider_email || ""),
      whatsapp_display_name: "Oficina de la Lcda. Ejemplo",
    });
    const people = [
      { first_name: "María", invite_code: "MARIA1", name_on_documents: "MARIA ELENA CRUZ MEJIA", status: "invited", received: 0 },
      { first_name: "Lucía", invite_code: "LUCIA7", name_on_documents: "LUCIA ROSA EJEMPLO", status: "active", received: 7 },
      { first_name: "José", invite_code: "JOSE42", name_on_documents: "JOSE LUIS EJEMPLO", status: "invited", received: 0 },
    ];
    for (const p of people) {
      const client = await db.Client.create({
        provider_id: provider.id, first_name: p.first_name, invite_code: p.invite_code,
        name_on_documents: p.name_on_documents, language: "es", status: p.status,
        last_activity_at: now(),
      });
      const kase = await db.Case.create({
        client_id: client.id,
        process_label: "Permiso de trabajo (asilo pendiente), I-765 (c)(8)",
        next_appointment: "2026-10-22T10:00:00-04:00",
        items_total: 12, items_received: p.received,
      });
      await db.ChecklistItem.bulkCreate(ITEM_TEMPLATE.map((t, i) => ({
        case_id: kase.id, order: i + 1, key: t[0], doc_type: t[1], label_es: t[2], label_en: t[3],
        requested_by: t[4], how_to_get_es: t[5], required: true, type: "photo",
        source_url: t[4] === "USCIS" ? USCIS_SOURCE : "", source_read_date: t[4] === "USCIS" ? SOURCE_READ : "",
        status: i < p.received ? "received" : "missing",
        received_at: i < p.received ? now() : undefined,
        sha256: i < p.received ? "demo-seed-" + t[0] : undefined,
        retake_count: 0,
      })));
      if (p.first_name === "José") {
        await db.Escalation.create({
          case_id: kase.id, client_first_name: "José", category: "legal_question",
          summary_es: "José pregunta si puede viajar a su país mientras el caso está pendiente.",
          summary_en: "José asks whether he can travel to his home country while the case is pending.",
          status: "open",
        });
      }
    }
    return ok({ reply_text: "Seeded 3 fictional clients", provider_id: provider.id });
  }

  // ---------- invite a new client (from the paralegal page) ----------
  if (action === "invite") {
    const first = String(input.first_name || "").trim().split(/\s+/)[0].slice(0, 30);
    if (!first) return fail("Falta el nombre.");
    const provider = (await db.Provider.list())[0];
    const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let tries = 0; tries < 5; tries++) {
      code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPH[b % ALPH.length]).join("");
      if (!(await db.Client.filter({ invite_code: code })).length) break;
    }
    const client = await db.Client.create({
      provider_id: provider?.id, first_name: first, invite_code: code, language: "es", status: "invited",
      name_on_documents: String(input.name_on_documents || "").toUpperCase(), last_activity_at: now(),
    });
    const kase = await db.Case.create({
      client_id: client.id, process_label: String(input.process_label || "Permiso de trabajo (asilo pendiente), I-765 (c)(8)"),
      items_total: 12, items_received: 0,
    });
    await db.ChecklistItem.bulkCreate(ITEM_TEMPLATE.map((t, i) => ({
      case_id: kase.id, order: i + 1, key: t[0], doc_type: t[1], label_es: t[2], label_en: t[3],
      requested_by: t[4], how_to_get_es: howtoText(t[1], t[2]), required: true, type: "photo",
      source_url: t[4] === "USCIS" ? USCIS_SOURCE : "", source_read_date: t[4] === "USCIS" ? SOURCE_READ : "",
      status: "missing", retake_count: 0,
    })));
    return ok({ invite_code: code, first_name: first, reply_text: `Código para ${first}: ${code}` });
  }

  // ---------- actions keyed by invite code (WhatsApp / web chat) or case id (provider page) ----------
  const ctx = input.case_id ? await loadByCase(String(input.case_id)) : await loadByCode(String(input.invite_code || ""));
  if (!ctx || !ctx.kase) return fail("No encontré ese código. Revíselo en el mensaje de su abogado/a.");
  const { client, kase, provider } = ctx;
  const office = provider?.whatsapp_display_name || provider?.name || "su abogado/a";

  if (client.status === "wiped" && action !== "link") {
    return fail("Este expediente ya fue borrado. Si necesita empezar de nuevo, pida un código nuevo a su abogado/a.");
  }

  if (action === "link") {
    await db.Client.update(client.id, { linked_at: client.linked_at || now(), last_activity_at: now(), status: client.status === "invited" ? "active" : client.status });
    return ok({
      first_name: client.first_name,
      reply_text: `Hola ${client.first_name}, soy Carpeta, el asistente de documentos de ${office}. No somos abogados. Su abogado/a revisa todo. Esto no es asesoría legal. Le ayudo a juntar los documentos de su lista y le paso a su abogado/a cualquier pregunta. Nunca escriba números de pasaporte, A-number ni seguro social aquí. ¿Empezamos? Responda SÍ.`,
    });
  }

  if (action === "consent") {
    await db.Client.update(client.id, { consent_at: now(), last_activity_at: now() });
  }

  if (action === "progress" || action === "consent") {
    const { rows, received, total } = await recount(kase.id);
    const rest = missingLine(rows);
    const when = kase.next_appointment
      ? new Date(kase.next_appointment).toLocaleString("es-US", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })
      : "";
    let reply = `Ya tiene ${received} de ${total}.`;
    if (rest) reply += ` Faltan: ${rest}.`;
    if (action === "consent") reply += " Mándeme una foto a la vez, en una mesa, con buena luz.";
    if (when && input.include_appointment) reply += ` Su cita es el ${when}.`;
    return ok({ received, total, reply_text: reply });
  }

  if (action === "howto") {
    const rows = await items(kase.id);
    const pick = input.item_number
      ? rows.find((r: any) => r.order === Number(input.item_number))
      : rows.find((r: any) => r.doc_type === input.doc_type || r.key === input.doc_type);
    if (!pick) {
      const list = rows.map((r: any) => `${r.order}. ${r.label_es}`).join("\n");
      return ok({ reply_text: `¿Cuál documento? Responda con el número:\n${list}` });
    }
    await touch(client);
    return ok({ reply_text: howtoText(pick.doc_type, pick.label_es) });
  }

  if (action === "set_visible") {
    await db.Client.update(client.id, { documents_visible_to_client: !!input.visible });
    return ok({ reply_text: input.visible ? "Visible para el cliente" : "Oculto para el cliente" });
  }

  if (action === "resolve") {
    const e = await db.Escalation.get(String(input.escalation_id || ""));
    if (!e || e.case_id !== kase.id) return fail("No encontré esa alerta.");
    await db.Escalation.update(e.id, { status: "closed" });
    return ok({ reply_text: "Resuelto" });
  }

  if (action === "refresh_howto") {
    const rows = await items(kase.id);
    for (const r of rows) await db.ChecklistItem.update(r.id, { how_to_get_es: howtoText(r.doc_type, r.label_es) });
    return ok({ reply_text: `Updated ${rows.length} items` });
  }

  if (action === "escalate") {
    const category = ESCALATION_REPLIES[input.category] ? String(input.category) : "other";
    await escalate(ctx, category, String(input.summary_es || ""), String(input.summary_en || ""));
    await touch(client);
    return ok({ reply_text: ESCALATION_REPLIES[category] });
  }

  if (action === "file") {
    const fileUrl = String(input.file_url || "");
    if (!fileUrl) return fail("No recibí la foto. Intente mandarla otra vez.");
    let rows = await items(kase.id);
    const forced = input.item_number ? rows.find((r: any) => r.order === Number(input.item_number)) : null;

    let cls: any = input.cached_classification || null;
    // Optional external classifier (e.g. the team's FastAPI service). Set the secret
    // EXTERNAL_CLASSIFIER_URL; it receives {file_url, doc_types} and returns the same JSON shape.
    const external = Deno.env.get("EXTERNAL_CLASSIFIER_URL");
    if (!cls && !forced && external) {
      try {
        const res = await fetch(external, {
          method: "POST",
          headers: { "content-type": "application/json", "x-carpeta-key": Deno.env.get("EXTERNAL_CLASSIFIER_KEY") || "" },
          body: JSON.stringify({ file_url: fileUrl, doc_types: DOC_TYPES }),
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) cls = await res.json();
      } catch { /* fall back to InvokeLLM */ }
    }
    if (!cls && !forced) {
      cls = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt:
          "You classify ONE photo of a document for an immigration document checklist. " +
          "Return the document type, your confidence 0-1, photo-quality problems, the full name of the person the document belongs to exactly as printed (or empty), and the document's issue or billing date as YYYY-MM-DD (or empty). " +
          "Never return any ID, case, receipt, account or A-number. Types: i589_receipt = USCIS I-797C receipt notice for an I-589; passport_photo = a passport-style photo; lease = residential lease; paystub = pay stub; utility_bill = electric/gas/water bill; school_letter; clinic_letter; church_letter = church/parish/community letter; prior_ead = employment authorization card; i589_copy = page of Form I-589; unknown = anything else.",
        file_urls: [fileUrl],
        response_json_schema: {
          type: "object",
          properties: {
            classified_as: { type: "string", enum: [...DOC_TYPES, "unknown"] },
            confidence: { type: "number" },
            quality_flags: { type: "array", items: { type: "string", enum: ["blurry", "cut_off", "glare", "not_a_document", "screenshot"] } },
            name_on_document: { type: "string" },
            document_date: { type: "string" },
          },
          required: ["classified_as", "confidence", "quality_flags"],
        },
      });
    }
    const type = forced ? forced.doc_type : String(cls?.classified_as || "unknown");
    const flags: string[] = forced ? [] : (cls?.quality_flags || []);
    const docName = norm(cls?.name_on_document || "");
    const nameMatch = !docName ? "unreadable" : docName === norm(client.name_on_documents || "") ? "yes" : "no";

    const docRow = await db.Document.create({
      case_id: kase.id, file_url: fileUrl, classified_as: type,
      confidence: Number(cls?.confidence ?? 1), quality_flags: flags,
      name_matches_client: nameMatch, document_date: String(cls?.document_date || ""),
    });
    await touch(client);

    const ofType = rows.filter((r: any) => r.doc_type === type);
    const openSlot = forced || ofType.find((r: any) => ["missing", "needs_retake", "flagged"].includes(r.status)) || ofType[0];

    // 1. photo quality
    const bad = flags.find((f) => RETAKE_FLAGS.includes(f));
    if (bad && openSlot) {
      const tries = (openSlot.retake_count || 0) + 1;
      await db.Document.update(docRow.id, { outcome: "retake", checklist_item_id: openSlot.id });
      if (tries >= 3) {
        await db.ChecklistItem.update(openSlot.id, { retake_count: tries, status: "needs_retake", type: "bring_original" });
        return ok({ reply_text: `No pude leer bien esta foto después de 3 intentos. Tráigala en original a su cita. (${openSlot.label_es})` });
      }
      await db.ChecklistItem.update(openSlot.id, { retake_count: tries, status: "needs_retake" });
      return ok({ reply_text: `${RETAKE_LINES[bad]} (intento ${tries} de 3)` });
    }

    // 2. unknown or low confidence
    if (type === "unknown" || !openSlot || (!forced && Number(cls?.confidence ?? 0) < 0.7)) {
      await db.Document.update(docRow.id, { outcome: "unknown" });
      const missing = rows.filter((r: any) => !["received", "delivered"].includes(r.status));
      const list = missing.map((r: any) => `${r.order}. ${r.label_es}`).join("\n");
      return ok({ reply_text: `No reconocí este documento. ¿Cuál es? Responda con el número:\n${list}`, document_id: docRow.id });
    }

    // 3. name mismatch: held for the provider, not counted
    if (nameMatch === "no") {
      await db.Document.update(docRow.id, { outcome: "name_mismatch", checklist_item_id: openSlot.id });
      await escalate(ctx, "name_mismatch",
        `Documento (${openSlot.label_es}) a nombre de otra persona.`,
        `${openSlot.label_en} appears to be in someone else's name. Held, not counted.`);
      return ok({ reply_text: "Este documento parece estar a nombre de otra persona. Lo marqué para que su abogado/a lo revise. ¿Es suyo? Si no, mándeme el suyo." });
    }

    // 4. address proof outside the provider's window
    if (type === "utility_bill" && cls?.document_date) {
      const age = (Date.now() - new Date(cls.document_date).getTime()) / 86400000;
      if (age > ADDRESS_WINDOW_DAYS) {
        await db.Document.update(docRow.id, { outcome: "outside_window", checklist_item_id: openSlot.id });
        await escalate(ctx, "outside_window",
          `Factura fechada ${cls.document_date}, fuera de los últimos ${ADDRESS_WINDOW_DAYS} días.`,
          `Utility bill dated ${cls.document_date}, outside the ${ADDRESS_WINDOW_DAYS}-day window. Not counted.`);
        return ok({ reply_text: `Esta factura es de ${cls.document_date}. Su abogado/a necesita una de los últimos ${ADDRESS_WINDOW_DAYS} días. ¿Tiene una más reciente?` });
      }
    }

    // 5. accepted: the count comes from rows
    const sha = await sha256Hex(fileUrl);
    await db.ChecklistItem.update(openSlot.id, { status: "received", received_at: now(), sha256: sha || "unavailable", type: "photo" });
    await db.Document.update(docRow.id, { outcome: "accepted", checklist_item_id: openSlot.id });
    const { received, total } = await recount(kase.id);
    if (received >= total) {
      await db.Client.update(client.id, { status: "complete" });
      return ok({ received, total, reply_text: `✅ Recibido: ${openSlot.label_es}. Ya tiene ${received} de ${total}: recibidos, falta que la oficina los revise. Para enviárselos ahora escriba ENTREGAR.` });
    }
    return ok({ received, total, reply_text: `✅ Recibido: ${openSlot.label_es}. Ya tiene ${received} de ${total}.` });
  }

  if (action === "deliver") {
    if (!provider?.email) return fail("No se pudo entregar todavía; su abogado/a no tiene correo configurado.");
    const rows = await items(kase.id);
    const docs = await db.Document.filter({ case_id: kase.id });
    const accepted = docs.filter((d: any) => d.outcome === "accepted");
    const openEsc = await db.Escalation.filter({ case_id: kase.id, status: "open" });
    const { received, total } = await recount(kase.id);
    const lines = rows.map((r: any) => {
      const doc = accepted.find((d: any) => d.checklist_item_id === r.id);
      const link = doc ? ` — <a href="${doc.file_url}">archivo</a>` : "";
      return `<li>${r.order}. ${r.label_es} [${r.requested_by}]: <b>${r.status}</b>${r.sha256 ? ` · sha256 ${String(r.sha256).slice(0, 12)}…` : ""}${link}</li>`;
    }).join("");
    const esc = openEsc.map((e: any) => `<li>[${String(e.category).toUpperCase()}] ${e.summary_en || e.summary_es}</li>`).join("");
    // Export before wipe: a dated log of every upload and what happened to it (kept by the provider).
    const ny = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
    const log = [...docs].sort((a: any, b: any) => String(a.created_date).localeCompare(String(b.created_date))).map((d: any) => {
      const slot = rows.find((r: any) => r.id === d.checklist_item_id);
      return `<tr><td>${ny(d.created_date)}</td><td>${d.classified_as || ""}</td><td>${slot ? slot.label_en : "-"}</td><td>${d.outcome || ""}</td><td>${(d.quality_flags || []).join(", ")}</td><td><a href="${d.file_url}">image</a></td></tr>`;
    }).join("");
    const body =
      `<p><b>Demo, datos ficticios.</b> Carpeta packet for ${client.first_name} (${kase.process_label}).</p>` +
      `<p>${received} of ${total} received.</p><ol>${lines}</ol>` +
      (esc ? `<p>Open questions and flags:</p><ul>${esc}</ul>` : "") +
      `<p><b>Upload log</b> (every photo received, in order; export kept by the office before Carpeta deletes its copies):</p><table border="1" cellpadding="4" style="border-collapse:collapse;font-size:12px"><tr><th>Received (ET)</th><th>Classified as</th><th>Slot</th><th>Outcome</th><th>Photo flags</th><th>Image</th></tr>${log}</table>` +
      `<p>Download the images from the links above before filing; Carpeta deletes its records after this email.</p>` +
      `<p>Fee note for the provider (I-765 (c)(8)): $560 if postmarked by Thu Oct 15 2026; $570 from Fri Oct 16 2026. Confirm on federalregister.gov.</p>` +
      `<p>For the paralegal: review the flags above. For the attorney: sign off before filing. Information, not legal advice; the attorney picks the process.</p>`;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: provider.email,
        subject: `Documentos de ${client.first_name}: ${received} de ${total}`,
        body,
        from_name: "Carpeta",
      });
    } catch (e) {
      await escalate(ctx, "other", "La entrega por correo falló; no se borró nada.", "Email delivery failed; nothing was deleted.");
      return fail("No se pudo entregar todavía; lo intentamos de nuevo.", { error: String(e) });
    }
    // Only after the email returned: drop the temporary rows, keep status + hash.
    for (const d of docs) await db.Document.delete(d.id);
    for (const r of rows) if (r.status === "received") await db.ChecklistItem.update(r.id, { status: "delivered" });
    await db.Case.update(kase.id, { delivered_at: now() });
    await db.Client.update(client.id, { status: "delivered", last_activity_at: now() });
    return ok({
      reply_text: `Entregado a ${office}: ${received} documentos. Borramos sus fotos de nuestro sistema. Puede borrar también este chat de su teléfono: mantenga presionado el chat y toque Eliminar.`,
    });
  }

  if (action === "wipe") {
    const docs = await db.Document.filter({ case_id: kase.id });
    for (const d of docs) await db.Document.delete(d.id);
    const rows = await items(kase.id);
    for (const r of rows) {
      if (r.status !== "delivered") await db.ChecklistItem.update(r.id, { status: "wiped", sha256: "", received_at: null });
    }
    const escs = await db.Escalation.filter({ case_id: kase.id });
    for (const e of escs) await db.Escalation.update(e.id, { summary_es: "(borrado)", summary_en: "(deleted)", provider_reply_es: "", status: "closed" });
    await db.Case.update(kase.id, { wiped_at: now(), wiped_by: input.by === "provider" ? "provider" : "client" });
    await db.Client.update(client.id, { status: "wiped", last_activity_at: now() });
    return ok({
      reply_text: "Borramos todo lo que nos mandó. Lo que ya se le había entregado a su abogado/a queda con su abogado/a. Para borrar este chat de su teléfono: mantenga presionado el chat y toque Eliminar.",
    });
  }

  return fail("Acción desconocida.");
}
