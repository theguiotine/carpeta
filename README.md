# Carpeta: document intake over WhatsApp, with the lawyer in the loop

**Live demo (published from Base44):** https://carpeta-08916c4a.base44.app
Built at the Latinos x AI Hackathon, Columbia, Sat Oct 10 2026. All code was written during the event (first commit after 11:15). **All data in the demo is fictional.**

## What it does

María (34, Honduras, asylum pending, little English) has to send her lawyer twelve documents for a work-permit filing. Today she guesses from WhatsApp groups and TikTok, and her lawyer chases her by phone.

With Carpeta, her provider (an attorney, an accredited representative, or a free legal-aid clinic) gives her a 6-character code. She texts it to Carpeta on WhatsApp, the app she already uses. Then:

1. Carpeta says who it works for, that it is not a lawyer, and never to type ID numbers. She answers SÍ.
2. She sends photos one at a time. Each one is classified and filed into a named slot on the provider's own checklist. She gets **"✅ Recibido: Contrato de renta. Lleva 4 de 12."** The count comes from database rows, never from model text.
3. A blurry, cut-off or glare photo gets a specific retake line, up to 3 tries, then "bring the original to your appointment".
4. A document in someone else's name, or a utility bill outside the 90-day window, is held for the provider and not counted.
5. Any legal question ("¿Califico?", "¿Puedo viajar?") gets a fixed refusal and lands on the provider's page as a one-line escalation. Emergencies (ICE at the door) get a fixed safety message and are pinned in red.
6. **ENTREGAR** emails the packet index to the provider, then deletes the photos; only status, time and a sha256 fingerprint remain. **BORRAR TODO** wipes everything she sent.

The provider sees every client on one page: progress bar "N de 12", status, open questions, and ENTREGAR / BORRAR buttons.

## The legal line (unauthorized practice of law)

The assistant only repeats what the provider's case record already says. It never says who qualifies, which form to file, or what a government letter means; the provider picks the process. Every USCIS-required item links its uscis.gov source and the date it was read. Free to the client, adults only, no ID-number fields anywhere in the schema.

## Honest privacy notes

- WhatsApp Business traffic is decrypted by Meta at its endpoint and held up to 30 days. We do not call this "end-to-end encrypted".
- Photos are read by Base44's LLM provider for classification; its retention was not verified.
- ENTREGAR and BORRAR delete our records. Whether a deleted file's URL stops resolving at the storage layer is being tested; until then we say "we delete our records", not "nothing is retained".
- What we cannot delete: the copy in her own WhatsApp.

## Base44 coverage scorecard (the 20% "thoughtful use")

| Base44 feature | Used for | Proof |
|---|---|---|
| Entities with references | Provider → Client → Case → ChecklistItem / Document / Escalation | `base44/entities/*.jsonc` |
| Row-level security | Public read for the fictional demo page; writes admin-only (backend functions run as service role) | `rls` in every entity file |
| Backend function | `carpeta-api`: deterministic count, filing rules, ENTREGAR, BORRAR TODO, seed | `base44/functions/carpeta-api/entry.ts` |
| Core integration: InvokeLLM | Classifies each photo with a JSON schema that has **no number fields** | `action: "file"` in the function |
| Core integration: SendEmail | ENTREGAR packet to the provider | `action: "deliver"` |
| AI agent with guidelines | "carpeta", Spanish-first, calls the backend function, reads ChecklistItem/Case | `base44/agents/carpeta.jsonc` |
| Native WhatsApp channel | The client's whole flow | Agent → WhatsApp tab |
| Anonymous access | Clients chat without a Base44 account | Agent → Guidelines → Allow anonymous access (ON) |
| Agent memory, user scope | Remembers only her invite code and first name | `memory_config` |
| Published site | Provider page, live link above | `npx base44 deploy` |
| CLI from a public repo | Everything deployed with `npx base44 deploy` from this repo | this repo |
| Logs | Function logs during testing | `npx base44 logs --function carpeta-api` |

## Credit budget (Free plan + hackathon coupon: 100 integration credits, 125 message credits)

Costs from docs.base44.com (Credits page and AI agents page, read Sat Oct 10 2026); per-run totals are our estimates, not measurements.

| Item | Estimate |
|---|---|
| One photo over WhatsApp: relay in + out (~2), agent turn (~3), InvokeLLM (~1) | ~6 |
| Opening (hola, code, SÍ) | ~15 |
| Full 12-photo run + one refusal + ENTREGAR | ~95 |
| 3-photo rehearsal | ~33 |

**100 integration credits cover about one full run.** So: logic is tested by calling the backend function directly (database reads and writes are free); WhatsApp rehearsals use 3 photos; the full 12-photo run happens once and is recorded as the demo video; the stage demo replays it. CLI deploys and manual edits are not listed as credit costs.

## Run it

```bash
npm install
npx base44 login
npx base44 build && npx base44 deploy --yes
```

Seed the fictional demo data by calling `carpeta-api` with `{"action":"seed","provider_email":"<your inbox>"}`.

## Roadmap

SMS (Twilio) and email as second channels with the same invite code; the provider's own checklist editor; production login with row-level access per provider; a data-processing agreement and storage held by the clinic.
