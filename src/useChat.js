/* ============================================================
   useChat — sohbet kanalları: abonelik, okunmamış sayacı, ses, okundu takibi
   ------------------------------------------------------------
   App.jsx'ten çıkarıldı (Tanrı-bileşen borcunu azaltan dilim). Davranış BİREBİR
   korunur — mantık ve bağımlılık dizileri aynen taşındı.

   Kanallar: 🌍 Genel (globalChat) + 🏢 Takım (teams/{tid}/chat) + 🏁 Yarış
   (teams/{tid}/raceChat/{rid}, kendi sekmesinde). Açık olmayan kanallar da dinlenir
   (okunmamış rozeti için). Okundu bilgisi localStorage'da (rm_chat_seen_v2).

   Girdi: { user, userName, curTeam, curRace, races, tab, chatSound }
     (chatSound + sesi aç/kapa App'te kalır; buraya yalnız okunur girer).
   Çıktı (App render'ının kullandığı yüzey):
     { chatOpen, setChatOpen, chatChan, setChatChan, chatChans, raceChan,
       chatAll, chatText, setChatText, doSendTo, curChan, chatEndRef, raceEndRef,
       unreadOf, chatUnread, raceUnread }. */
import { useState, useEffect, useRef, useMemo } from "react";
import { sendChat, watchChat } from "./storage";
import { chatBeep } from "./sound";

export function useChat({ user, userName, curTeam, curRace, races, tab, chatSound }) {
  const prevUnreadRef = useRef(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatChan, setChatChan] = useState("team");
  const [chatAll, setChatAll] = useState({});   // { path: [mesajlar] }
  const [chatText, setChatText] = useState("");
  const [chatSeen, setChatSeen] = useState(() => {   // { path: sonGörülenTs }
    try { return JSON.parse(localStorage.getItem("rm_chat_seen_v2") || "{}"); }
    catch { return {}; }
  });
  const chatEndRef = useRef(null);
  const raceEndRef = useRef(null);

  /* Kanallar. Yazma yetkisi role bağlı değil — sürücüler de konuşur.
     Pencerede genel + takım; yarış sohbeti kendi sekmesinde. */
  const chatChans = useMemo(() => {
    const out = [{ id: "global", lbl: "Genel", ico: "🌍", path: "globalChat" }];
    if (curTeam) out.push({ id: "team", lbl: "Takım", ico: "🏢",
      path: `teams/${curTeam}/chat` });
    return out;
  }, [curTeam]);

  const raceChan = useMemo(() => (curTeam && curRace
    ? { id: "race", ico: "🏁", lbl: races[curRace]?.name || "",
      path: `teams/${curTeam}/raceChat/${curRace}` }
    : null), [curTeam, curRace, races]);

  const allChans = useMemo(() => (raceChan ? [...chatChans, raceChan] : chatChans),
    [chatChans, raceChan]);

  /* açık olmayan kanalları da dinliyoruz — okunmamış sayacı için */
  useEffect(() => {
    if (!user) { setChatAll({}); return undefined; }
    const offs = allChans.map((c) =>
      watchChat(c.path, (msgs) => setChatAll((a) => ({ ...a, [c.path]: msgs }))));
    return () => offs.forEach((f) => f && f());
  }, [user, allChans]);

  /* seçili kanal kaybolursa (yarıştan çıkınca) geçerli bir kanala düş */
  useEffect(() => {
    if (!chatChans.some((c) => c.id === chatChan)) {
      setChatChan(chatChans[chatChans.length - 1]?.id || "global");
    }
  }, [chatChans, chatChan]);

  const curChan = chatChans.find((c) => c.id === chatChan) || chatChans[0];
  const chatMsgs = (curChan && chatAll[curChan.path]) || [];
  const unreadOf = (c) => ((chatAll[c.path] || [])
    .filter((m) => (m.at || 0) > (chatSeen[c.path] || 0) && m.uid !== user?.uid).length);
  const chatUnread = chatChans.reduce((a, c) => a + unreadOf(c), 0);
  const raceUnread = raceChan ? unreadOf(raceChan) : 0;

  /* yeni mesaj sesi: toplam okunmamış ARTTIĞINDA çal.
     İlk yüklemede çalmaz (önceki değer bilinmeden karşılaştırma yapılmaz);
     kendi mesajların unreadOf'ta zaten sayılmıyor. */
  useEffect(() => {
    const total = chatUnread + raceUnread;
    if (prevUnreadRef.current !== null
        && total > prevUnreadRef.current && chatSound) chatBeep();
    prevUnreadRef.current = total;
  }, [chatUnread, raceUnread, chatSound]);

  /* yarış sekmesi açıkken o kanalı okundu say */
  useEffect(() => {
    if (tab !== "rchat" || !raceChan) return;
    const ms = chatAll[raceChan.path] || [];
    const last = ms.length ? (ms[ms.length - 1].at || 0) : 0;
    if (last && (chatSeen[raceChan.path] || 0) < last) {
      const next = { ...chatSeen, [raceChan.path]: last };
      setChatSeen(next);
      try { localStorage.setItem("rm_chat_seen_v2", JSON.stringify(next)); }
      catch { /* yoksay */ }
    }
    raceEndRef.current?.scrollIntoView({ block: "end" });
  }, [tab, raceChan, chatAll, chatSeen]);

  useEffect(() => {
    /* v2.0: tam sayfa sohbet (tab==="chat") de modal gibi "okundu" işaretler —
       rozet tam sayfada da temizlensin (chatOpen yalnız modal kabuğunda true olur). */
    if ((!chatOpen && tab !== "chat") || !curChan) return;
    const last = chatMsgs.length ? (chatMsgs[chatMsgs.length - 1].at || 0) : Date.now();
    if ((chatSeen[curChan.path] || 0) < last) {
      const next = { ...chatSeen, [curChan.path]: last };
      setChatSeen(next);
      try { localStorage.setItem("rm_chat_seen_v2", JSON.stringify(next)); }
      catch { /* yoksay */ }
    }
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chatOpen, tab, chatMsgs, curChan, chatSeen]);

  const doSendTo = async (chan) => {
    const v = chatText.trim();
    if (!v || !chan) return;
    setChatText("");
    try { await sendChat(chan.path, user, userName, v); }
    catch (e) { console.warn("mesaj gönderilemedi:", e?.message); }
  };

  return { chatOpen, setChatOpen, chatChan, setChatChan, chatChans, raceChan,
    chatAll, chatText, setChatText, doSendTo, curChan, chatEndRef, raceEndRef,
    unreadOf, chatUnread, raceUnread };
}
