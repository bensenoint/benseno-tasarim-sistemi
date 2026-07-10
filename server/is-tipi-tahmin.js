// server/is-tipi-tahmin.js — başlıktan iş tipi tahmini (kural sözlüğü, LLM yok).
// Sıra ÖNEMLİ: özgül kalıplar önce, genel sm-gorsel EN SONDA (post/story/görsel çok geniş).
// Slack /yeni-brief ön-doğrulama + backfill script'i paylaşır.
const KURALLAR = [
  ['sm-plan',           /(sm|i[çc]erik|sosyal medya|content)\s*(plan|takvim)|content plan/i],
  ['video-revizyon',    /video.*(revi[sz]|g[üu]ncelle)|revi[sz].*video|noise reduction/i],
  ['video-produksiyon', /video|reels|kurgu|\bedit\b|çekim|cekim|youtube|animasyon/i],
  ['ambalaj',           /ambalaj|karton kutu|packaging|kutu tasar[ıi]m/i],
  ['katalog-dokuman',   /katalog|bro[şs][üu]r|brochure|specsheet|spec sheet|dok[üu]man|compendium|one-?pager|sunum|deck|sales aid|starter kit|guide sheet|toolkit/i],
  ['giydirme',          /giydirme|cam giydirme|ara[çc] kaplama/i],
  ['mailing-tasarim',   /mail(ing)?|ho[şs] ?geldin|e-?posta|emailing/i],
  ['dergi-ilan',        /dergi.*([İIıi]lan|yay[ıi]n)|mecra|insert/i],
  ['ceviri',            /[çc]evir|lokali[sz]asyon|translation|localization/i],
  ['raporlama',         /rapor|report/i],
  ['web-site',          /web ?site|website|site yay[ıi]n|\bcms\b|b2b website/i],
  ['uygulama-yazilim',  /uygulama|mobil app|mobile app|\bapp\b|kupon|yaz[ıi]l[ıi]m|dashboard demo/i],
  ['strateji',          /strateji|ileti[şs]im plan|communication strategy|planlama(s[ıi])?$/i],
  ['fiyat-guncelleme',  /fiyat (listesi|g[üu]ncelle)|dijital imza/i],
  ['idari-operasyon',   /fatura|[öo]deme|teklif|organizasyon|ar[şs]iv|notion|dosya kontrol|b[üu]t[çc]e|maliyet|tedarik[çc]i/i],
  ['web-gorsel',        /banner|packshot|web g[öo]rsel|amazon|a plus|a\+/i],
  ['baski-pop',         /roll ?up|stant|stand|f[öo]y|kartonet|yaka kart|nfc|sticker|poster|[öo]nl[üu]k|pleksi|fotoblok|badge|kart tasar[ıi]m|zarf|masa|raf|folyo|display|kartvizit|davetiye|prescription pad|passport|pop\b/i],
  ['sm-gorsel',         /post|story|reklam g[öo]rsel|kampanya|g[öo]rsel|linkedin|instagram|\bsm\b|payla[şs][ıi]m|highlight|(babalar|anneler|sevgililer) g[üu]n|çekili[şs]|cekilis/i],
];
function tahminEt(baslik) {
  const b = String(baslik || '');
  for (const [tip, re] of KURALLAR) if (re.test(b)) return tip;
  return null;
}
module.exports = { tahminEt, KURALLAR };
