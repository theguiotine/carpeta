// Phone gallery of the fictional test documents: tap one, long-press to save, then send it to
// Carpeta on WhatsApp. Every image is watermarked FICTICIO · DEMO.
const DOCS = [
  ["01-I-797C-receipt-I-589.png", "Recibo I-797C"], ["02-photo-1.png", "Foto 1"], ["03-photo-2.png", "Foto 2"],
  ["04-lease.png", "Contrato de renta"], ["05-paystub-aug.png", "Talón agosto"], ["06-paystub-sep.png", "Talón septiembre"],
  ["07-utility-bill-sep.png", "Factura de luz"], ["08-school-letter.png", "Carta escuela"], ["09-clinic-letter.png", "Carta clínica"],
  ["10-church-letter.png", "Carta iglesia"], ["11-prior-EAD.png", "Permiso anterior"], ["12-I-589-first-page.png", "I-589 pág. 1"],
  ["P1-photofix-blurry-797C.png", "Prueba: borrosa"], ["P2-photofix-cropped-797C.png", "Prueba: cortada"], ["P3-photofix-glare-797C.png", "Prueba: reflejo"],
  ["T1-TRAP-paystub-other-name.png", "Trampa: otro nombre"], ["T2-TRAP-utility-bill-old.png", "Trampa: factura vieja"],
];

const REAL = {"04-lease.png": "lease.png", "05-paystub-aug.png": "paystub-aug.png", "06-paystub-sep.png": "paystub-sep.png", "07-utility-bill-sep.png": "utility-bill.png"};
const url = (f) => (REAL[f] ? `/samples/${REAL[f]}` : `/demo-docs/${f}`);

export default function Docs() {
  return (
    <div className="min-h-screen bg-stone-50 p-4">
      <div className="bg-amber-300 text-amber-950 text-center text-xs font-semibold py-1 px-2 rounded mb-3">Documentos ficticios para la demo · fictional test documents</div>
      <h1 className="text-xl font-bold">Documentos de prueba</h1>
      <p className="text-sm text-slate-600 mb-3">Toque uno, mantenga presionada la imagen y guárdela. Luego mándela a Carpeta por WhatsApp: <b>+1 978-991-5607</b>.</p>
      <div className="grid grid-cols-2 gap-3">
        {DOCS.map(([f, label]) => (
          <a key={f} href={url(f)} className="block bg-white rounded-xl border overflow-hidden shadow-sm">
            <img src={url(f)} alt={label} className="w-full h-32 object-cover" loading="lazy" />
            <div className="text-xs font-medium p-2">{label}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
