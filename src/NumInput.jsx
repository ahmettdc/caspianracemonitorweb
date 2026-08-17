import { useState, useRef, useEffect } from "react";

/* Ondalık-güvenli sayı girişi: kontrollü METİN tutar (type="number" değil), böylece
   alan boşaltılabilir ve "0.85" gibi ondalıklar sıfıra snap etmeden yazılabilir.
   Dışarıya her zaman bir SAYI yayar (boş/"." → 0). Virgül de nokta olarak kabul edilir. */
export default function NumInput({ value, onNum, ...rest }) {
  const [txt, setTxt] = useState(value == null ? "" : String(value));
  const emitted = useRef(value);
  useEffect(() => {
    if (value !== emitted.current) { emitted.current = value; setTxt(value == null ? "" : String(value)); }
  }, [value]);
  return (
    <input type="text" inputMode="decimal" value={txt} {...rest}
      onChange={(e) => {
        const v = e.target.value.replace(",", ".");
        if (v !== "" && !/^\d*\.?\d*$/.test(v)) return;   // yalnız rakam + tek nokta
        setTxt(v);
        const n = (v === "" || v === ".") ? 0 : parseFloat(v);
        if (!Number.isNaN(n)) { emitted.current = n; onNum(n); }
      }} />
  );
}
