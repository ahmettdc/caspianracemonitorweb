/* ============================================================
   confirm — uygulama içi onay/uyarı/istem penceresi (native window.confirm/
   alert/prompt yerine, arayüzle uyumlu modal). Tek <ConfirmHost/> App kökünde
   mount edilir; buradaki fonksiyonlar ona mesaj geçip Promise döndürür.
     confirmDialog(msg|opts) → Promise<boolean>
     alertDialog(msg|opts)   → Promise<true>   (tek buton)
     promptDialog(opts)      → Promise<string|null>
   opts: { title?, message, confirmText?, cancelText?, danger?, variant?,
           defaultValue?, placeholder? }
   ============================================================ */
let emit = null;

export function _bindConfirm(fn) {
  emit = fn;
  return () => { if (emit === fn) emit = null; };
}

export function confirmDialog(opts) {
  const o = typeof opts === "string" ? { message: opts } : (opts || {});
  return new Promise((resolve) => {
    // host mount değilse güvenli varsayılan: prompt→null, alert→true (tek buton onayı), diğer→false
    if (typeof emit !== "function") { resolve(o.variant === "prompt" ? null : o.variant === "alert" ? true : false); return; }
    emit({ ...o, resolve });
  });
}

export function alertDialog(opts) {
  const o = typeof opts === "string" ? { message: opts } : (opts || {});
  return confirmDialog({ ...o, variant: "alert" });
}

export function promptDialog(opts) {
  const o = typeof opts === "string" ? { message: opts } : (opts || {});
  return confirmDialog({ ...o, variant: "prompt" });
}
