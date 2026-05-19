import { useState, useEffect, useCallback, createContext, useContext } from "react";
import emailjs from "@emailjs/browser";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";

const EMAILJS_SERVICE_ID          = "service_waepieg";
const EMAILJS_TEMPLATE_ID         = "template_llqsrma";
const EMAILJS_TEMPLATE_COMMENT_ID = "template_fn72tzf";
const EMAILJS_PUBLIC_KEY          = "29sTJ6oyeV1NH7r3W";
const CLIENT_EMAIL                = "mgasiorowskikontakt@gmail.com";
/* === SUPABASE CONFIG ===
   Utwórz darmowe konto na supabase.com, a następnie wklej w Vercel:
     Settings → Environment Variables:
       VITE_SUPABASE_URL      = https://xxxxxxxxxxxx.supabase.co
       VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   W panelu Supabase uruchom w SQL Editor:
     create table kv_store (
       key text primary key,
       value jsonb,
       updated_at timestamptz default now()
     );
     alter table kv_store enable row level security;
     create policy "public_read"   on kv_store for select using (true);
     create policy "public_insert" on kv_store for insert with check (true);
     create policy "public_update" on kv_store for update using (true);
*/
const STORAGE_KEY  = "treningtracker-reports-v5";
const COMMENTS_KEY = "treningtracker-comments-v2";
const SB_URL = import.meta.env.VITE_SUPABASE_URL      ?? "";
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const SB_HEADERS = {
  apikey:        SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};
async function storageGet(key) {
  try {
    if (!SB_URL || !SB_KEY) return null;
    const res = await fetch(
      `${SB_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`,
      { headers: SB_HEADERS }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows.length > 0 ? rows[0].value : null;
  } catch { return null; }
}
async function storageSet(key, value) {
  try {
    if (!SB_URL || !SB_KEY) return false;
    const res = await fetch(`${SB_URL}/rest/v1/kv_store`, {
      method:  "POST",
      headers: { ...SB_HEADERS, Prefer: "resolution=merge-duplicates" },
      body:    JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
    });
    return res.ok;
  } catch { return false; }
}
/* === IMAGE COMPRESSION === */
async function compressImage(file, maxWidthPx = 1200, qualityJpeg = 0.72) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(1, maxWidthPx / img.width);
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", qualityJpeg));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
/* === DEFAULTS === */
const defaultForm = {
  data: new Date().toISOString().split("T")[0],
  sredniaTygodnia: "", pas: "", zdjecia: "",
  treningiWykonane: "", treningiPlan: "", sila: "",
  sen: "", senJakosc: "", zarwanaNoc: "",
  dietaTrzymanie: "", bialko: "", kreatyna: "", kcal: "",
  energia: "", stres: "", bol: "", bolMiejsce: "",
  progres: "", odczucieTreningu: "", dietaOpis: "", zgloszenie: "",
  // Obwody — sekcja rozwijana
  klatka: "", ramie: "", przedramie: "", udo: "", lydka: "", barki: "",
  // Metadane obwodów
  obwodyNotatka: "", obwodyZdjecia: [], obwodyDataOstatnich: "",
};
/* === THEME === */
const DARK_T = {
  bg:"#07090f",surface:"rgba(255,255,255,0.038)",surfaceHover:"rgba(255,255,255,0.062)",
  border:"rgba(255,255,255,0.09)",borderBright:"rgba(255,255,255,0.16)",
  headerBg:"rgba(7,9,15,0.95)",inputBg:"rgba(255,255,255,0.055)",inputBorder:"rgba(255,255,255,0.1)",
  cyan:"#00d4ff",lime:"#a3e635",amber:"#fbbf24",violet:"#a78bfa",rose:"#fb7185",emerald:"#34d399",
  text:"#f0f4f8",textSub:"#94a3b8",textMuted:"#4b5968",radius:14,
};
const LIGHT_T = {
  bg:"#f1f5f9",surface:"#ffffff",surfaceHover:"#f8fafc",
  border:"rgba(0,0,0,0.09)",borderBright:"rgba(0,0,0,0.18)",
  headerBg:"rgba(255,255,255,0.96)",inputBg:"#f8fafc",inputBorder:"rgba(0,0,0,0.12)",
  cyan:"#0891b2",lime:"#65a30d",amber:"#d97706",violet:"#7c3aed",rose:"#e11d48",emerald:"#059669",
  text:"#0f172a",textSub:"#475569",textMuted:"#94a3b8",radius:14,
};
const QUOTES = [
  { text:"Wszyscy chcą być kulturystami, ale nikt nie chce dźwigać wielkich ciężarów.", author:"Ronnie Coleman" },
  { text:"Ostatnie trzy lub cztery powtórzenia to te, dzięki którym mięśnie rosną. Ten obszar bólu dzieli mistrza od kogoś, kto nim nie jest.", author:"Arnold Schwarzenegger" },
  { text:"Dyscyplina to robienie tego, czego nienawidzisz, tak jakbyś to kochał.", author:"Tom Platz" },
  { text:"Nie trenuję, żeby być 'fit'. Trenuję, żeby dominować.", author:"Dorian Yates" },
  { text:"Nie ma lipy! Trzeba trenować, a nie szukać wymówek.", author:"Robert Burneika" },
  { text:"Samo się nie zrobi. Trzeba zapierniczać, żeby coś osiągnąć.", author:"Mariusz Pudzianowski" },
  { text:"Ciężka praca bije talent, gdy talent nie pracuje ciężko.", author:"Kai Greene" },
  { text:"Twój umysł jest granicą. Dopóki umysł widzi fakt, że możesz coś zrobić, zrobisz to.", author:"Arnold Schwarzenegger" },
  { text:"Dyscyplina to robienie tego, na co nie masz ochoty, by osiągnąć to, na czym Ci zależy.", author:"Michał Karmowski" },
  { text:"Ból jest przejściowy. Rezygnacja trwa wiecznie.", author:"Flex Wheeler" },
  { text:"Kulturystyka to nie jest sport na 2 godziny dziennie. To jest styl życia 24/7.", author:"Radosław Słodkiewicz" },
  { text:"Zwycięstwo to nie wszystko, to jedyna rzecz.", author:"Jay Cutler" },
  { text:"Nie ma czegoś takiego jak przetrenowanie, jest tylko niedożywienie i brak snu.", author:"Rich Piana" },
  { text:"Siła nie pochodzi z wygrywania. Twoje zmagania budują twoją siłę.", author:"Arnold Schwarzenegger" },
  { text:"Charakter buduje się wtedy, gdy kończy się komfort, a zaczyna walka.", author:"Radosław Słodkiewicz" },
  { text:"Jeśli chcesz być najlepszy, musisz robić rzeczy, których inni nie chcą robić.", author:"Michael Hearn" },
  { text:"Ból mija, duma zostaje na zawsze.", author:"Mateusz Janusz" },
  { text:"Sukces nie polega na byciu najlepszym. Polega na byciu lepszym niż byłeś wczoraj.", author:"Chris Bumstead" },
  { text:"Porażka to tylko opcja, której nie biorę pod uwagę.", author:"Lee Haney" },
  { text:"Nie szukaj motywacji. Szukaj powodu, dla którego zacząłeś.", author:"Michał Karmowski" },
  { text:"Zrób to, czego się boisz, a strach zniknie.", author:"Kevin Levrone" },
  { text:"Wielkość to kwestia wyboru, a nie przypadku.", author:"Phil Heath" },
  { text:"Nienawidziłem każdej minuty treningu, ale mówiłem: nie rezygnuj. Cierp teraz i żyj resztę życia jako mistrz.", author:"Lou Ferrigno" },
  { text:"Musisz widzieć cel, zanim go osiągniesz.", author:"Frank Zane" },
  { text:"W tym sporcie nie ma dróg na skróty. Albo dajesz z siebie 100%, albo marnujesz czas.", author:"Robert Piotrkowicz" },
];
const ThemeCtx = createContext(true);
const useT = () => { const dark = useContext(ThemeCtx); return dark ? DARK_T : LIGHT_T; };
const CSS = `@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;600&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} body{font-family:'Bricolage Grotesque',sans-serif;} input,textarea,button,select{font-family:'Bricolage Grotesque',sans-serif;} input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;} input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.4);} ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px;} .fi{background:rgba(255,255,255,0.055);border:1.5px solid rgba(255,255,255,0.1);border-radius:12px;color:#f0f4f8;padding:12px 16px;font-size:15px;width:100%;outline:none;transition:border-color .18s,box-shadow .18s;} .fi:focus{border-color:rgba(0,212,255,0.6);box-shadow:0 0 0 3px rgba(0,212,255,0.1);} .fi::placeholder{color:rgba(148,163,184,0.4);} .fi.err{background:rgba(251,113,133,0.07);border-color:rgba(251,113,133,0.5);} textarea.fi{resize:vertical;line-height:1.6;} .light .fi{background:#f8fafc;border:1.5px solid rgba(0,0,0,0.12);color:#0f172a;} .light .fi:focus{border-color:rgba(8,145,178,0.6);box-shadow:0 0 0 3px rgba(8,145,178,0.1);} .light .fi::placeholder{color:rgba(100,116,139,0.5);} .light .fi.err{background:rgba(225,29,72,0.05);border-color:rgba(225,29,72,0.4);} .light input[type=date]::-webkit-calendar-picker-indicator{filter:none;} .light ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);} .tab-pill{padding:8px 20px;border-radius:100px;border:none;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.05em;transition:all .18s;} .tab-pill.on{background:#00d4ff;color:#07090f;box-shadow:0 0 18px rgba(0,212,255,0.3);} .tab-pill.off{background:rgba(255,255,255,0.06);color:#4b5968;} .tab-pill.off:hover{background:rgba(255,255,255,0.1);color:#64748b;} .light .tab-pill.on{background:#0891b2;color:#fff;} .light .tab-pill.off{background:rgba(0,0,0,0.06);color:#94a3b8;} .light .tab-pill.off:hover{background:rgba(0,0,0,0.1);color:#64748b;} .sc{background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.08);border-radius:14px;padding:10px 8px;text-align:center;transition:border-color .18s,background .18s;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;gap:0;} .sc:hover{border-color:rgba(255,255,255,0.16);background:rgba(255,255,255,0.06);} .light .sc{background:#f8fafc;border:1.5px solid rgba(0,0,0,0.08);} .light .sc:hover{border-color:rgba(0,0,0,0.16);background:#f1f5f9;} .comment-ghost{font-size:12px;padding:6px 16px;border-radius:100px;border:1.5px dashed rgba(167,139,250,0.3);background:transparent;color:#4b5968;cursor:pointer;transition:all .18s;font-weight:600;} .comment-ghost:hover{border-color:rgba(167,139,250,0.6);color:#a78bfa;} .light .comment-ghost{color:#94a3b8;} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} .fade-up{animation:fadeUp .3s ease both;} @keyframes successPop{0%{transform:scale(.92);opacity:0}60%{transform:scale(1.03)}100%{transform:scale(1);opacity:1}} .success-pop{animation:successPop .45s cubic-bezier(.34,1.4,.64,1) both;} @keyframes shimmer{0%,100%{opacity:1}50%{opacity:.6}} .shimmer{animation:shimmer 2s ease infinite;} .delta{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:2px 7px;border-radius:100px;} .delta.up{background:rgba(163,230,53,0.15);color:#a3e635;} .delta.down{background:rgba(251,113,133,0.15);color:#fb7185;} .delta.same{background:rgba(148,163,184,0.1);color:#64748b;}`;
/* === UTILS === */
const MONTHS_PL = ["sty","lut","mar","kwi","maj","cze","lip","sie","wrz","paź","lis","gru"];
const weekRange = d => {
  if (!d) return "–";
  const end = new Date(d); const start = new Date(end); start.setDate(end.getDate()-6);
  const sm = MONTHS_PL[start.getMonth()]; const em = MONTHS_PL[end.getMonth()];
  if (start.getMonth()===end.getMonth()) return `${start.getDate()}–${end.getDate()} ${em}`;
  return `${start.getDate()} ${sm} – ${end.getDate()} ${em}`;
};
const parseDieta = v => { if (!v) return null; if (v==="90-100%") return 9; if (v==="60-80%") return 7; if (v==="<60%") return 4; const n=parseInt(v); return isNaN(n)?null:Math.round(n/10); };
const ENERGIA_EMOJI   = {"2":"🪫","4":"😪","6":"😐","8":"😊","10":"🔥"};
const ENERGIA_LABEL   = {"2":"Bez energii","4":"Słabo","6":"Przeciętnie","8":"Dobrze","10":"Pełen mocy"};
const SENJAKOSC_EMOJI = {"2":"😵","4":"😫","6":"😑","8":"🙂","10":"😴"};
const STRES_LABEL     = {"2":"Niski","5":"Średni","8":"Wysoki"};
const SILA_LABEL      = {"⬆️":"Wzrost","➖":"Stagnacja","⬇️":"Spadek"};
const displayEnergia = v => v ? (ENERGIA_EMOJI[v]   || `${v}/10`) : "–";
const displaySen     = v => v ? (SENJAKOSC_EMOJI[v] || `${v}/10`) : "–";
const displayStres   = v => v ? (STRES_LABEL[v]     || `${v}/10`) : "–";
const displaySila    = v => v ? (SILA_LABEL[v]      || v)         : "–";
const proteinColor   = (v,T) => { if (v===null||isNaN(v)) return T.textMuted; if (v<1.6) return T.rose; if (v<2.0) return "#f97316"; return T.emerald; };
const useScoreColor  = () => { const T=useT(); return v => { if (v==null) return T.textMuted; if (v>=8) return T.lime; if (v>=6) return T.amber; if (v>=4) return "#f97316"; return T.rose; }; };
function generateCSV(reports) {
  const cols = ["data","sredniaTygodnia","waga","pas","zdjecia","klatka","ramie","przedramie","udo","lydka","barki","obwodyNotatka","treningiWykonane","treningiPlan","sila","sen","senJakosc","zarwanaNoc","dietaTrzymanie","bialko","kcal","kreatyna","energia","stres","bol","bolMiejsce","progres","odczucieTreningu","dietaOpis","zgloszenie"];
  const hdrs = ["Data","Śr. wagi","Waga","Talia cm","Foto","Klatka cm","Ramię cm","Przedramię cm","Udo cm","Łydka cm","Barki cm","Notatka pomiarowa","Treningi","Plan","Siła","Sen h","Sen jakość","Zarwana noc","Dieta","Białko g/kg","Kcal","Kreatyna g","Energia","Stres","Ból","Gdzie","Progres","Odczucie","Dieta opis","Zgłoszenie"];
  const esc = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
  const rows = [...reports].sort((a,b)=>new Date(a.data)-new Date(b.data)).map(r => cols.map(c=>esc(r[c])).join(","));
  return [hdrs.join(","), ...rows].join("\n");
}
/* === COMPONENTS === */
function Field({ label, hint, children }) {
  const T = useT();
  return (
    <div style={{ marginBottom:20 }}>
      <label style={{ fontSize:11,color:T.textMuted,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700 }}>
        {label}{hint && <span style={{ color:T.textMuted,fontSize:10,marginLeft:6,textTransform:"none",letterSpacing:0,fontWeight:500 }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}
function StatCard({ label, value, sub, color, val2, label2, color2 }) {
  const T = useT();
  const str  = (!value  || value  === "brak info") ? "–" : String(value);
  const str2 = (!val2   || val2   === "brak info") ? null : String(val2);
  const isEmoji  = str  !== "–" && /^\p{Emoji}/u.test(str);
  const isEmoji2 = str2 && /^\p{Emoji}/u.test(str2);
  const fs  = isEmoji  ? 30 : str.length===1  ? 26 : str.length<=2  ? 22 : str.length<=3 ? 20 : str.length<=5 ? 16 : 12;
  const fs2 = isEmoji2 ? 22 : str2 && str2.length===1 ? 20 : str2 && str2.length<=3 ? 16 : 12;
  return (
    <div className="sc">
      <div style={{ fontSize:fs,fontWeight:800,color:str==="–"?T.textMuted:(color||T.text),lineHeight:1,fontFamily:isEmoji?"inherit":"'JetBrains Mono',monospace",letterSpacing:isEmoji?0:"-0.02em" }}>{str}</div>
      {sub && str!=="–" && <div style={{ fontSize:9,color:color||T.textSub,marginTop:3,fontWeight:600,lineHeight:1 }}>{sub}</div>}
      <div style={{ fontSize:9,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.09em",marginTop:5,fontWeight:700,lineHeight:1.2 }}>{label}</div>
      {str2 && (
        <>
          <div style={{ width:"36%",height:1,background:T.border,margin:"6px auto 5px" }} />
          <div style={{ fontSize:fs2,fontWeight:800,color:color2||T.textSub,lineHeight:1,fontFamily:isEmoji2?"inherit":"'JetBrains Mono',monospace",letterSpacing:isEmoji2?0:"-0.02em" }}>{str2}</div>
          <div style={{ fontSize:9,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.09em",marginTop:4,fontWeight:700,lineHeight:1.2 }}>{label2}</div>
        </>
      )}
    </div>
  );
}
function LabelSelect({ value, onChange, options, hasError }) {
  const T = useT();
  return (
    <div style={{ display:"flex",gap:8,flexWrap:"wrap",padding:hasError?8:0,borderRadius:10,border:hasError?`1.5px solid ${T.rose}66`:"none",background:hasError?`${T.rose}0d`:"transparent" }}>
      {options.map(o => {
        const active = value===o.val;
        return <button key={o.val} onClick={()=>onChange(o.val)} style={{ flex:1,padding:"11px 8px",borderRadius:12,border:`1.5px solid ${active?T.cyan+"99":T.border}`,cursor:"pointer",fontSize:13,fontWeight:active?700:500,background:active?`${T.cyan}18`:T.surface,color:active?T.cyan:T.textMuted,transition:"all .15s ease" }}>{o.label}</button>;
      })}
    </div>
  );
}
function EmojiSelect({ value, onChange, options, hasError }) {
  const T = useT();
  return (
    <div style={{ display:"flex",gap:6,padding:hasError?8:0,borderRadius:10,border:hasError?`1.5px solid ${T.rose}66`:"none",background:hasError?`${T.rose}0d`:"transparent" }}>
      {options.map(o => {
        const active = value===o.val;
        return <button key={o.val} onClick={()=>onChange(o.val)} style={{ flex:1,height:o.label?66:52,borderRadius:14,border:`2px solid ${active?T.cyan+"99":T.borderBright}`,cursor:"pointer",fontSize:o.label?20:24,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:active?`${T.cyan}20`:T.surface,transform:active?"scale(1.12)":"scale(1)",transition:"all .15s cubic-bezier(.34,1.56,.64,1)",filter:active?"none":"grayscale(30%)" }}>{o.emoji}{o.label&&<span style={{fontSize:8,color:active?T.cyan:T.textMuted,fontWeight:700,letterSpacing:"0.03em",textTransform:"uppercase",lineHeight:1}}>{o.label}</span>}</button>;
      })}
    </div>
  );
}
function StepCard({ num, icon, title, color, children }) {
  const T = useT(); const c = color||T.cyan;
  return (
    <div style={{ background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:20,boxShadow:`0 1px 4px ${T.border}`,padding:"20px 20px 16px",marginBottom:12,position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${c}55,transparent)` }} />
      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:18,paddingBottom:12,borderBottom:`1px solid ${T.border}` }}>
        <div style={{ width:32,height:32,borderRadius:10,fontSize:16,background:`${c}18`,border:`1.5px solid ${c}33`,display:"flex",alignItems:"center",justifyContent:"center" }}>{icon}</div>
        <div>
          <div style={{ fontSize:10,color:T.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em" }}>Krok {num}</div>
          <div style={{ fontSize:15,fontWeight:800,color:T.text,letterSpacing:"-0.01em" }}>{title}</div>
        </div>
      </div>
      {children}
    </div>
  );
}
function Row2({ children }) { return <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>{children}</div>; }
function AdherenceBar({ done, plan }) {
  const T = useT(); const pct = plan>0?Math.min(100,Math.round((done/plan)*100)):0; const c = pct>=100?T.lime:pct>=75?T.amber:T.rose;
  return (
    <div style={{ background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:12,padding:"12px 16px",marginBottom:20 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
        <span style={{ fontSize:12,color:T.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em" }}>Realizacja planu</span>
        <span style={{ fontSize:18,fontWeight:800,color:c,fontFamily:"'JetBrains Mono',monospace" }}>{pct}%</span>
      </div>
      <div style={{ height:6,background:"rgba(255,255,255,0.07)",borderRadius:4,overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${pct}%`,background:c,borderRadius:4,boxShadow:`0 0 8px ${c}60`,transition:"width .4s ease" }} />
      </div>
      <div style={{ fontSize:11,color:T.textMuted,marginTop:6 }}>{done}/{plan} sesji {pct>=100?"🔥 Pełna realizacja!":pct>=75?"👍 Dobra robota":"💪 Daj z siebie więcej"}</div>
    </div>
  );
}
function MetaPill({ icon, val, color }) {
  const T = useT();
  return <span style={{ display:"inline-flex",alignItems:"center",gap:4,background:T.surface,border:`1px solid ${T.border}`,padding:"3px 10px",borderRadius:100,fontSize:12,color:color||T.textMuted }}>{icon} {val}</span>;
}
function ChartCard({ title, accent, children }) {
  const T = useT();
  return (
    <div style={{ background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:18,padding:"18px 20px",marginBottom:12,position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${accent}55,transparent)` }} />
      <div style={{ fontSize:11,fontWeight:700,color:accent,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em" }}>{title}</div>
      {children}
    </div>
  );
}
function CSVModal({ reports, onClose }) {
  const T = useT(); const csv = generateCSV(reports); const [copied,setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(csv); } catch { const t=document.getElementById("csv-ta"); if(t){t.select();document.execCommand("copy");} }
    setCopied(true); setTimeout(()=>setCopied(false),3000);
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",backdropFilter:"blur(10px)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={onClose}>
      <div style={{ background:T.bg==="#07090f"?"#0b0e18":"#fff",border:`1.5px solid ${T.border}`,borderRadius:20,padding:24,width:"100%",maxWidth:560,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 32px 80px rgba(0,0,0,0.7)",animation:"fadeUp .3s ease both" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16 }}>
          <div><div style={{ fontWeight:800,fontSize:17,color:T.text }}>Eksport danych (CSV)</div><div style={{ fontSize:12,color:T.textMuted,marginTop:3 }}>Skopiuj do Excel / Google Sheets</div></div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,color:T.textSub,fontSize:14,cursor:"pointer",width:34,height:34 }}>✕</button>
        </div>
        <textarea id="csv-ta" readOnly value={csv} style={{ flex:1,minHeight:200,maxHeight:300,background:"rgba(255,255,255,0.03)",border:"1.5px solid rgba(255,255,255,0.07)",borderRadius:10,color:"#64748b",padding:"12px 14px",fontSize:11,fontFamily:"monospace",resize:"none",outline:"none",lineHeight:1.6 }} />
        <div style={{ display:"flex",gap:10,marginTop:14 }}>
          <button onClick={copy} style={{ flex:1,padding:"12px",background:copied?"rgba(163,230,53,0.15)":"linear-gradient(135deg,#00d4ff,#0ea5e9)",border:copied?"1.5px solid rgba(163,230,53,0.4)":"none",borderRadius:12,color:copied?T.lime:"#fff",fontSize:14,fontWeight:700,cursor:"pointer" }}>{copied?"✅ Skopiowano!":"📋 Kopiuj"}</button>
          <button onClick={onClose} style={{ padding:"12px 18px",background:"rgba(255,255,255,0.05)",border:"1.5px solid rgba(255,255,255,0.09)",borderRadius:12,color:T.textMuted,fontSize:14,fontWeight:600,cursor:"pointer" }}>Zamknij</button>
        </div>
      </div>
    </div>
  );
}
function FullReportBlock({ r, label, dimmed, comments={} }) {
  const T = useT(); const scoreColor = useScoreColor();
  const [expanded,setExpanded] = useState(!dimmed); const fade = dimmed?T.textMuted:undefined;
  return (
    <div style={{ background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:18,padding:"16px 18px",marginBottom:12,opacity:dimmed?0.65:1 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,cursor:"pointer" }} onClick={()=>setExpanded(e=>!e)}>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ background:dimmed?"rgba(71,85,105,0.2)":"rgba(0,212,255,0.12)",color:dimmed?T.textMuted:T.cyan,padding:"3px 10px",borderRadius:100,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",border:`1px solid ${dimmed?"rgba(71,85,105,0.3)":"rgba(0,212,255,0.22)"}` }}>{label}</span>
          <span style={{ fontWeight:800,fontSize:14,color:dimmed?T.textMuted:T.text }}>{weekRange(r.data)}</span>
        </div>
        <span style={{ color:T.textMuted,fontSize:12 }}>{expanded?"▲":"▼"}</span>
      </div>
      <div style={{ fontSize:9,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:6,paddingLeft:2 }}>🏆 Wyniki</div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14 }}>
        {(()=>{
          const hasPas = r.pas && r.pas !== "brak info";
          return (
            <StatCard label="Waga" value={(r.sredniaTygodnia||r.waga)||"–"} sub={(r.sredniaTygodnia||r.waga) ? "kg" : undefined} color={fade||T.cyan} val2={hasPas ? r.pas : undefined} label2="Talia cm" color2={fade||T.violet} />
          );
        })()}
        <StatCard label="Trening" value={r.treningiWykonane&&r.treningiPlan ? `${r.treningiWykonane}/${r.treningiPlan}` : "–"} sub={r.treningiWykonane&&r.treningiPlan ? "sesji" : undefined} color={fade||T.violet} val2={r.sila ? (r.sila==="⬆️"?"↑":r.sila==="⬇️"?"↓":"→") : undefined} label2="siła" color2={fade||(r.sila==="⬆️"?T.lime:r.sila==="⬇️"?T.rose:T.textSub)} />
        <StatCard label="Dieta" value={r.dietaTrzymanie==="90-100%"?"Clean":r.dietaTrzymanie==="60-80%"?"Mixed":r.dietaTrzymanie==="<60%"?"Dirty":"–"} color={fade||(r.dietaTrzymanie==="90-100%"?T.lime:r.dietaTrzymanie==="60-80%"?T.amber:r.dietaTrzymanie?T.rose:undefined)} val2={r.kcal&&r.kcal!=="brak info" ? r.kcal : undefined} label2="kcal" color2={fade||T.amber} />
      </div>
      <div style={{ fontSize:9,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:6,paddingLeft:2 }}>💤 Samopoczucie</div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14 }}>
        <StatCard label="Sen jakość" value={displaySen(r.senJakosc)} color={fade||scoreColor(parseInt(r.senJakosc))} val2={r.sen ? `${r.sen}h` : undefined} label2="długość" color2={fade||T.emerald} />
        <StatCard label="Energia" value={displayEnergia(r.energia)} sub={r.energia?ENERGIA_LABEL[r.energia]:undefined} color={fade||scoreColor(parseInt(r.energia))} />
        <StatCard label="Stres" value={displayStres(r.stres)} color={fade||scoreColor(10-(r.stres==="2"?2:r.stres==="5"?5:8))} />
      </div>
      <div style={{ fontSize:9,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:6,paddingLeft:2 }}>🥗 Dieta / Suplementacja</div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
        {(()=>{
          const raw=r.bialko;
          if(!raw||raw==="brak info") return <StatCard label="Białko g/kg" value="–" />;
          const v=parseFloat(raw);
          const col=fade||proteinColor(isNaN(v)?null:v,T);
          const lvl=isNaN(v)?undefined:v<1.6?"za mało":v<2.0?"dobry":"optymalny";
          return <StatCard label="Białko g/kg" value={raw} sub={lvl} color={col} />;
        })()}
        <StatCard label="Kreatyna" value={!r.kreatyna||r.kreatyna==="brak info" ? "–" : `${r.kreatyna}g`} color={fade||(!r.kreatyna||r.kreatyna==="brak info" ? undefined : T.amber)} />
        <StatCard label="Zarwana noc" value={r.zarwanaNoc==="TAK"?"😵":r.zarwanaNoc==="NIE"?"✅":"–"} sub={r.zarwanaNoc==="TAK"?"Tak":r.zarwanaNoc==="NIE"?"Nie":undefined} color={fade||(r.zarwanaNoc==="TAK"?T.rose:r.zarwanaNoc==="NIE"?T.emerald:undefined)} />
      </div>
      {r.zarwanaNoc==="TAK" && <div style={{ marginTop:10,background:"rgba(251,113,133,0.06)",border:"1.5px solid rgba(251,113,133,0.22)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#fda4af" }}>🌙 Zarwana noc w tym tygodniu</div>}
      {r.bol==="TAK" && <div style={{ marginTop:10,background:"rgba(251,113,133,0.08)",border:"1.5px solid rgba(251,113,133,0.25)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#fda4af" }}>⚠️ Ból: <strong style={{ color:T.rose }}>{r.bolMiejsce}</strong></div>}
      {expanded&&(r.progres||r.odczucieTreningu||r.dietaOpis||r.zgloszenie)&&(
        <div style={{ marginTop:14,background:"rgba(255,255,255,0.025)",border:`1.5px solid ${T.border}`,borderRadius:14,padding:"14px 16px" }}>
          <div style={{ fontSize:10,color:T.cyan,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:12 }}>Feedback klienta</div>
          {[["progres","💪 Progres"],["odczucieTreningu","🏋 Odczucie"],["dietaOpis","🥗 Dieta"],["zgloszenie","📝 Zgłoszenie"]].filter(([k])=>r[k]).map(([k,l])=>(
            <div key={k} style={{ marginBottom:10 }}>
              <div style={{ fontSize:10,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:13,color:"#cbd5e1",lineHeight:1.6 }}>{r[k]}</div>
            </div>
          ))}
        </div>
      )}
      {expanded&&comments[r.id]&&(
        <div style={{ marginTop:10,background:"rgba(167,139,250,0.07)",border:"1.5px solid rgba(167,139,250,0.22)",borderRadius:14,padding:"14px 16px" }}>
          <div style={{ fontSize:10,color:T.violet,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:8 }}>Komentarz trenera</div>
          <div style={{ fontSize:13,color:"#cbd5e1",lineHeight:1.7,whiteSpace:"pre-wrap" }}>{comments[r.id]}</div>
        </div>
      )}
    </div>
  );
}
/* === MANDATORY MEASUREMENTS LOGIC === */
function shouldShowMandatoryMeasurements(reports) {
  const withObwody = [...reports]
    .filter(r => r.klatka || r.ramie || r.udo)
    .sort((a, b) => new Date(b.data) - new Date(a.data));
  if (withObwody.length === 0) return true;
  const lastDate = new Date(withObwody[0].data);
  const diffDays = (new Date() - lastDate) / (1000 * 60 * 60 * 24);
  return diffDays >= 28;
}
function ClientForm({ onSave, onExit, reports = [] }) {
  const T = useT();
  const [form,setForm] = useState(defaultForm);
  const [errors,setErrors] = useState({});
  const [saving,setSaving] = useState(false);
  const [saved,setSaved] = useState(false);
  const [savedDate,setSavedDate] = useState("");
  const [quote,setQuote] = useState(null);
  const [storageOk,setStorageOk] = useState(null);
  const isMandatoryCycle = shouldShowMandatoryMeasurements(reports);
  const [obwodyOpen, setObwodyOpen] = useState(isMandatoryCycle);
  const [showObwodyWarning, setShowObwodyWarning] = useState(false);
  const set = useCallback((k,v) => { setForm(f => ({ ...f, [k]:v })); setErrors(e => ({ ...e, [k]:false })); }, []);
  const required = ["data","sredniaTygodnia","treningiWykonane","treningiPlan","sen","senJakosc","dietaTrzymanie","energia","stres"];
  const validate = () => {
    const errs = {};
    required.forEach(k => { if (!form[k] || String(form[k]).trim()==="") errs[k]=true; });
    if (form.bol==="TAK" && !form.bolMiejsce.trim()) errs.bolMiejsce=true;
    if (form.dietaTrzymanie==="90-100%" && !form.bialko) errs.bialko=true;
    if (form.dietaTrzymanie==="90-100%" && !form.kcal) errs.kcal=true;
    setErrors(errs); return Object.keys(errs).length===0;
  };
  const doSave = async () => {
    setSaving(true);
    const report = { ...form, pas:form.pas||"brak info", bialko:form.bialko||"brak info", kcal:form.kcal||"brak info", kreatyna:form.kreatyna||"brak info", id: Date.now(), savedAt: new Date().toISOString() };
    const existing = (await storageGet(STORAGE_KEY)) ?? [];
    const updated  = [...existing.filter(r => r.id !== report.id), report];
    const ok = await storageSet(STORAGE_KEY, updated);
    setStorageOk(ok===true);
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          data:              report.data,
          sredniaTygodnia:   report.sredniaTygodnia,
          pas:               report.pas,
          treningiWykonane:  report.treningiWykonane,
          treningiPlan:      report.treningiPlan,
          sila:              report.sila || "—",
          sen:               report.sen,
          senJakosc:         report.senJakosc,
          zarwanaNoc:        report.zarwanaNoc || "NIE",
          dietaTrzymanie:    report.dietaTrzymanie,
          bialko:            report.bialko,
          kcal:              report.kcal,
          kreatyna:          report.kreatyna,
          energia:           report.energia,
          stres:             report.stres,
          bol:               report.bol || "NIE",
          bolMiejsce:        report.bolMiejsce || "—",
          progres:           report.progres || "—",
          odczucieTreningu:  report.odczucieTreningu || "—",
          dietaOpis:         report.dietaOpis || "—",
          zgloszenie:        report.zgloszenie || "—",
          klatka:            report.klatka || "—",
          ramie:             report.ramie || "—",
          przedramie:        report.przedramie || "—",
          udo:               report.udo || "—",
          lydka:             report.lydka || "—",
          barki:             report.barki || "—",
          obwodyNotatka:     report.obwodyNotatka || "—",
        },
        EMAILJS_PUBLIC_KEY
      );
    } catch (e) {
      console.error("EmailJS error:", e);
    }
    if (onSave) onSave(report);
    const p = form.data.split("-");
    setSavedDate(`${p[2]}.${p[1]}.${p[0]}`);
    setQuote(QUOTES[Math.floor(Math.random()*QUOTES.length)]);
    setErrors({});
    setForm({ ...defaultForm, data: new Date().toISOString().split("T")[0] });
    setSaving(false); setSaved(true);
  };
  const handleSaveForce = async () => {
    setShowObwodyWarning(false);
    await doSave();
  };
  const handleSubmit = async () => {
    if (!validate()) { window.scrollTo({top:0,behavior:"smooth"}); return; }
    if (isMandatoryCycle && obwodyOpen) {
      const obwodyFilled = form.klatka && form.ramie && form.udo && form.barki && form.lydka && form.przedramie;
      if (!obwodyFilled) {
        setShowObwodyWarning(true);
        return;
      }
    }
    await doSave();
  };
  const errCount = Object.values(errors).filter(Boolean).length;
  const errFields = { data:"Data",sredniaTygodnia:"Waga",treningiWykonane:"Sesje wykonane",treningiPlan:"Plan sesji",sen:"Długość snu",senJakosc:"Jakość snu",dietaTrzymanie:"Kontrola diety",energia:"Energia",stres:"Stres",bolMiejsce:"Gdzie boli" };
  const inp = k => `fi${errors[k]?" err":""}`;
  if (saved) return (
    <div style={{ maxWidth:480,margin:"0 auto",textAlign:"center",padding:"48px 20px" }}>
      <div className="success-pop" style={{ background:`linear-gradient(145deg,${T.lime}18,${T.cyan}12)`,border:`1.5px solid ${T.lime}59`,borderRadius:24,padding:"36px 28px" }}>
        <div style={{ fontSize:48,marginBottom:12 }}>🎯</div>
        <div style={{ fontSize:11,fontWeight:800,color:T.lime,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:8 }}>Raport wysłany!</div>
        <div style={{ fontSize:28,fontWeight:800,color:T.text,fontFamily:"'JetBrains Mono',monospace",marginBottom:8 }}>{savedDate}</div>
        <div style={{ fontSize:12,color:T.textMuted,marginBottom:16 }}>Mariusz zobaczy Twoje dane i wróci z feedbackiem</div>
        <div style={{ fontSize:11,marginBottom:20,color:storageOk===true?T.emerald:"#fbbf24",fontWeight:600 }}>{storageOk===true?"💾 Dane zapisane trwale w bazie":"⚠️ Dane zapisane tylko w tej sesji"}</div>
        {quote && (
          <div style={{ background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:18,padding:"22px 20px",textAlign:"left",position:"relative" }}>
            <div style={{ fontSize:56,lineHeight:1,color:T.cyan,opacity:0.25,fontFamily:"Georgia,serif",position:"absolute",top:8,left:16,fontWeight:900,userSelect:"none" }}>"</div>
            <div style={{ fontSize:16,fontWeight:700,color:T.text,lineHeight:1.6,letterSpacing:"-0.01em",paddingTop:18,paddingLeft:4,fontStyle:"italic" }}>{quote.text}</div>
            <div style={{ marginTop:16,paddingTop:14,borderTop:`1px solid ${T.border}`,fontSize:12,fontWeight:700,color:T.cyan,letterSpacing:"0.04em",textTransform:"uppercase" }}>— {quote.author}</div>
          </div>
        )}
        <button onClick={onExit} style={{ marginTop:24,padding:"13px 36px",background:`linear-gradient(135deg,${T.violet},${T.cyan})`,border:"none",borderRadius:100,color:"#07090f",fontSize:13,fontWeight:800,cursor:"pointer",letterSpacing:"0.04em",boxShadow:`0 0 24px ${T.violet}44` }}>Wyjście →</button>
      </div>
    </div>
  );
  return (
    <div style={{ maxWidth:480,margin:"0 auto" }}>
      <div style={{ textAlign:"center",marginBottom:22 }}>
        <div style={{ fontSize:22,fontWeight:800,color:T.text,letterSpacing:"-0.02em" }}>Tygodniowy raport</div>
        <div style={{ fontSize:12,color:T.textMuted,marginTop:4 }}>Uzupełnij dane za miniony tydzień</div>
      </div>
      {errCount>0&&(<div style={{ background:"rgba(251,113,133,0.08)",border:`1.5px solid ${T.rose}40`,borderRadius:12,padding:"12px 16px",marginBottom:14 }}><div style={{ display:"flex",alignItems:"center",gap:8,fontSize:13,color:T.rose,fontWeight:700,marginBottom:6 }}>⚠️ Uzupełnij wymagane pola:</div><div style={{ fontSize:12,color:T.textSub,lineHeight:1.8 }}>{Object.entries(errors).filter(([,v])=>v).map(([k])=>errFields[k]||k).join(" · ")}</div></div>)}
      <StepCard num="1" icon="📏" title="Pomiary ciała" color={T.cyan}>
        <Field label="Data zakończenia tygodnia">
          <input type="date" value={form.data} onChange={e=>set("data",e.target.value)} className={inp("data")} style={{ WebkitAppearance:"none" }} />
        </Field>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Field label="Średnia waga (kg)">
            <input type="number" step="0.1" placeholder="np. 82.5"
              value={form.sredniaTygodnia}
              onChange={e=>set("sredniaTygodnia",e.target.value)}
              className={inp("sredniaTygodnia")} />
          </Field>
          <Field label="Talia (cm)">
            <input type="number" step="0.5" placeholder="np. 84"
              value={form.pas}
              onChange={e=>set("pas",e.target.value)}
              className="fi" />
          </Field>
        </div>
        {/* Toggle obwodów */}
        <div
          onClick={() => setObwodyOpen(o => !o)}
          style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            marginTop:14, marginBottom: obwodyOpen ? 12 : 0,
            padding:"10px 14px",
            background: isMandatoryCycle ? `${T.amber}14` : T.surface,
            border:`1.5px solid ${isMandatoryCycle ? T.amber+"55" : T.border}`,
            borderRadius:12, cursor:"pointer", transition:"all .15s"
          }}
        >
          <div style={{ fontSize:13, fontWeight:700,
            color: isMandatoryCycle ? T.amber : T.textSub,
            display:"flex", alignItems:"center", gap:8 }}>
            {isMandatoryCycle ? "⚠️" : "📐"}
            {isMandatoryCycle
              ? "Obwody ciała — wymagane co 4 tygodnie"
              : (obwodyOpen ? "Obwody ciała — zwiń" : "Obwody ciała — rozwiń")}
          </div>
          <span style={{ color:T.textMuted, fontSize:12, transition:"transform .2s",
            display:"inline-block", transform: obwodyOpen ? "rotate(180deg)" : "none" }}>▾</span>
        </div>
        {/* Sekcja obwodów — rozwijana */}
        {obwodyOpen && (
          <div>
            <div style={{
              fontSize:12, background:`${T.cyan}10`, color:T.cyan,
              border:`0.5px solid ${T.cyan}33`, borderRadius:10,
              padding:"8px 12px", marginBottom:12,
              display:"flex", alignItems:"center", gap:8
            }}>
              ⏰ Mierz rano, na czczo, przed treningiem — zawsze o tej samej porze
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { key:"klatka",     label:"Klatka piersiowa",  hint:"Poziomo na wys. sutków, na wydechu, mięśnie rozluźnione." },
                { key:"ramie",      label:"Ramię (biceps)",     hint:"Najszersze miejsce przy napiętym, zgiętym bicepsie." },
                { key:"przedramie", label:"Przedramię",         hint:"Tuż poniżej łokcia, przy zaciśniętej pięści." },
                { key:"udo",        label:"Udo",                hint:"Tuż pod pośladkiem, ciężar rozłożony równomiernie." },
                { key:"lydka",      label:"Łydka",              hint:"Stojąc prosto, najszerszy punkt mięśnia brzuchatego." },
                { key:"barki",      label:"Barki",              hint:"Najszersze miejsce obręczy barkowej — środkowe aktony." },
              ].map(({ key, label, hint }) => (
                <div key={key} style={{
                  background:T.surface, border:`1.5px solid ${T.border}`,
                  borderRadius:12, padding:"10px 12px"
                }}>
                  <div style={{ fontSize:11, fontWeight:700, color: isMandatoryCycle ? T.amber : T.textSub,
                    textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>
                    {label}{isMandatoryCycle && <span style={{ color:T.rose }}> *</span>}
                  </div>
                  <div style={{ fontSize:10, color:T.textMuted, lineHeight:1.4, marginBottom:8 }}>{hint}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <input type="number" step="0.5" placeholder="—"
                      value={form[key]} onChange={e=>set(key, e.target.value)}
                      className="fi" style={{ padding:"8px 10px", fontSize:14, fontWeight:700 }} />
                    <span style={{ fontSize:12, color:T.textMuted, flexShrink:0 }}>cm</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Upload zdjęć */}
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.textSub,
                textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
                📷 Zdjęcia progress
                <span style={{ fontSize:10, fontWeight:400, color:T.textMuted,
                  textTransform:"none", letterSpacing:0 }}> — opcjonalne · auto-kompresja</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                {["przód","bok","tył"].map((lbl, idx) => {
                  const existing = form.obwodyZdjecia?.[idx];
                  return (
                    <label key={lbl} style={{
                      aspectRatio:"3/4", background: existing ? "transparent" : T.surface,
                      border:`1.5px dashed ${T.border}`, borderRadius:12,
                      display:"flex", flexDirection:"column", alignItems:"center",
                      justifyContent:"center", gap:4, cursor:"pointer", overflow:"hidden",
                      position:"relative"
                    }}>
                      {existing
                        ? <img src={existing} alt={lbl} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        : <>
                            <span style={{ fontSize:22 }}>📷</span>
                            <span style={{ fontSize:11, color:T.textMuted }}>{lbl}</span>
                          </>
                      }
                      <input type="file" accept="image/*" style={{ display:"none" }}
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const compressed = await compressImage(file);
                          const newArr = [...(form.obwodyZdjecia?.length ? form.obwodyZdjecia : [null, null, null])];
                          newArr[idx] = compressed;
                          set("obwodyZdjecia", newArr);
                        }} />
                    </label>
                  );
                })}
              </div>
            </div>
            {/* Notatka */}
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.textSub,
                textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>
                📝 Notatka do pomiaru
                <span style={{ fontSize:10, fontWeight:400, color:T.textMuted,
                  textTransform:"none", letterSpacing:0 }}> — opcjonalna</span>
              </div>
              <textarea
                rows={2} placeholder="np. byłem nabity wodą po solonej kolacji..."
                value={form.obwodyNotatka} onChange={e=>set("obwodyNotatka",e.target.value)}
                className="fi" style={{ resize:"none" }} />
            </div>
          </div>
        )}
      </StepCard>
      <StepCard num="2" icon="⚡" title="Jak się czujesz?" color={T.amber}>
        <Field label="Poziom energii"><EmojiSelect value={form.energia} onChange={v=>set("energia",v)} hasError={errors.energia} options={[{val:"2",emoji:"🪫",label:"Bez energii"},{val:"4",emoji:"😪",label:"Słabo"},{val:"6",emoji:"😐",label:"Przeciętnie"},{val:"8",emoji:"😊",label:"Dobrze"},{val:"10",emoji:"🔥",label:"Pełen mocy"}]} /></Field>
        <Field label="Poziom stresu"><LabelSelect value={form.stres} onChange={v=>set("stres",v)} hasError={errors.stres} options={[{val:"2",label:"Niski"},{val:"5",label:"Średni"},{val:"8",label:"Wysoki"}]} /></Field>
        <Field label="Ból / kontuzja"><LabelSelect value={form.bol} onChange={v=>set("bol",v)} options={[{val:"NIE",label:"Brak"},{val:"TAK",label:"Mam ból"}]} /></Field>
        {form.bol==="TAK"&&<Field label="Gdzie boli?"><input placeholder="np. lewe kolano, bark..." value={form.bolMiejsce} onChange={e=>set("bolMiejsce",e.target.value)} className={inp("bolMiejsce")} /></Field>}
      </StepCard>
      <StepCard num="3" icon="😴" title="Sen i regeneracja" color={T.emerald}>
        <Field label="Długość snu">
          <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:5,padding:errors.sen?8:0,borderRadius:10,border:errors.sen?"1.5px solid rgba(251,113,133,0.4)":"none",background:errors.sen?"rgba(251,113,133,0.04)":"transparent" }}>
            {["5","5.5","6","6.5","7","7.5","8","8.5","9","9.5","10",">10"].map(h=>{
              const active=form.sen===h;
              return <button key={h} onClick={()=>set("sen",h)} style={{ width:"100%",height:38,padding:"0 4px",borderRadius:10,cursor:"pointer",fontSize:12,fontWeight:active?800:600,background:active?`${T.cyan}18`:T.surface,border:`1.5px solid ${active?T.cyan+"99":T.border}`,color:active?T.cyan:T.textSub,boxShadow:active?`0 0 12px ${T.cyan}33`:"none",transition:"all .15s cubic-bezier(.34,1.4,.64,1)",transform:active?"scale(1.08)":"scale(1)" }}>{h}h</button>;
            })}
          </div>
        </Field>
        <Field label="Jakość snu"><EmojiSelect value={form.senJakosc} onChange={v=>set("senJakosc",v)} hasError={errors.senJakosc} options={[{val:"2",emoji:"😵"},{val:"4",emoji:"😫"},{val:"6",emoji:"😑"},{val:"8",emoji:"🙂"},{val:"10",emoji:"😴"}]} /><div style={{ display:"flex",justifyContent:"space-between",marginTop:5,fontSize:10,color:T.textMuted,padding:"0 4px" }}><span>bardzo źle</span><span>świetnie</span></div></Field>
        <Field label="Zarwana noc w tym tygodniu?">
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            {[{val:"NIE",label:"Nie"},{val:"TAK",label:"Tak"}].map(o=>{ const active=form.zarwanaNoc===o.val; const ac=o.val==="TAK"?T.rose:T.emerald; return <button key={o.val} onClick={()=>set("zarwanaNoc",o.val)} style={{ padding:"11px 8px",borderRadius:12,cursor:"pointer",border:`1.5px solid ${active?ac+"99":T.border}`,background:active?`${ac}18`:T.surface,color:active?ac:T.textMuted,fontSize:13,fontWeight:active?700:500,transition:"all .15s ease" }}>{o.label}</button>; })}
          </div>
        </Field>
      </StepCard>
      <StepCard num="4" icon="🏋" title="Trening" color={T.violet}>
        <Row2>
          <Field label="Wykonane sesje"><input type="number" min="0" placeholder="np. 3" value={form.treningiWykonane} onChange={e=>set("treningiWykonane",e.target.value)} className={inp("treningiWykonane")} /></Field>
          <Field label="Plan sesji"><input type="number" min="0" placeholder="np. 4" value={form.treningiPlan} onChange={e=>set("treningiPlan",e.target.value)} className={inp("treningiPlan")} /></Field>
        </Row2>
        <Field label="Odczucie siły"><EmojiSelect value={form.sila} onChange={v=>set("sila",v)} options={[{val:"⬆️",emoji:"💪"},{val:"➖",emoji:"😐"},{val:"⬇️",emoji:"😓"}]} /><div style={{ display:"flex",justifyContent:"space-between",marginTop:5,fontSize:10,color:T.textMuted,padding:"0 4px" }}><span>wzrost</span><span style={{ textAlign:"center",flex:1 }}>stagnacja</span><span>spadek</span></div></Field>
      </StepCard>
      <StepCard num="5" icon="🥗" title="Dieta" color={T.cyan}>
        <Field label="Kontrola diety">
          <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
            {[{val:"90-100%",label:"A – Clean",desc:"Ważyłem i mierzyłem wszystko",badge:"A",bColor:T.lime},{val:"60-80%",label:"B – Mixed",desc:"Ważyłem + szacowałem na oko",badge:"B",bColor:T.amber},{val:"<60%",label:"C – Dirty",desc:"Nie dbałem o tracking",badge:"C",bColor:T.rose}].map(o=>{ const active=form.dietaTrzymanie===o.val; return (<div key={o.val} onClick={()=>set("dietaTrzymanie",o.val)} style={{ padding:"11px 14px",borderRadius:12,cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .15s",background:active?`${T.cyan}14`:T.surface,border:`1.5px solid ${active?T.cyan+"59":errors.dietaTrzymanie?T.rose+"59":T.border}` }}><div style={{ width:28,height:28,borderRadius:8,flexShrink:0,background:active?`${o.bColor}22`:T.surface,border:`1.5px solid ${active?o.bColor:"transparent"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:active?o.bColor:T.textMuted }}>{o.badge}</div><div><div style={{ fontSize:14,fontWeight:700,color:active?T.cyan:T.text }}>{o.label}</div><div style={{ fontSize:11,color:T.textMuted,marginTop:2 }}>{o.desc}</div></div></div>); })}
          </div>
        </Field>
        <Field label="Kreatyna (g)"><input type="number" min="0" max="50" step="0.5" placeholder="np. 5" value={form.kreatyna} onChange={e=>set("kreatyna",e.target.value)} className="fi" /></Field>
        <div style={{ overflow:"hidden", maxHeight:form.dietaTrzymanie==="<60%"||!form.dietaTrzymanie?"0px":"200px", opacity:form.dietaTrzymanie==="<60%"||!form.dietaTrzymanie?0:1, marginTop:form.dietaTrzymanie==="<60%"||!form.dietaTrzymanie?0:12, transition:"max-height .35s cubic-bezier(.4,0,.2,1), opacity .25s ease, margin-top .35s" }}>
          <Field label={<span>Białko (g/kg){form.dietaTrzymanie==="90-100%"&&<span style={{marginLeft:8,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:100,background:`${T.cyan}18`,color:T.cyan}}>wymagane</span>}{form.dietaTrzymanie==="60-80%"&&<span style={{marginLeft:8,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:100,background:"rgba(148,163,184,0.1)",color:T.textMuted}}>opcjonalne</span>}</span>}>
            <input type="number" min="0" max="5" step="0.1" placeholder={form.dietaTrzymanie==="60-80%"?"Szacunkowo... np. 1.8":"np. 2.0"} value={form.bialko} onChange={e=>set("bialko",e.target.value)} className={`fi${errors.bialko?" err":""}`} />
          </Field>
        </div>
        <div style={{ overflow:"hidden", maxHeight:form.dietaTrzymanie==="90-100%"?"120px":"0px", opacity:form.dietaTrzymanie==="90-100%"?1:0, marginTop:form.dietaTrzymanie==="90-100%"?12:0, transition:"max-height .35s cubic-bezier(.4,0,.2,1), opacity .25s ease, margin-top .35s" }}>
          <Field label={<span>Kcal<span style={{marginLeft:8,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:100,background:`${T.cyan}18`,color:T.cyan}}>wymagane</span></span>}>
            <input type="number" min="0" max="10000" step="50" placeholder="np. 3200" value={form.kcal} onChange={e=>set("kcal",e.target.value)} className={`fi${errors.kcal?" err":""}`} />
          </Field>
        </div>
      </StepCard>
      <StepCard num="6" icon="💬" title="Feedback dla trenera" color={T.violet}>
        <Field label="Progres siłowy"><textarea rows={2} placeholder="np. bench +2.5kg, squaty bez zmian" value={form.progres} onChange={e=>set("progres",e.target.value)} className="fi" style={{ resize:"vertical",lineHeight:1.6 }} /></Field>
        <Field label="Odczucie treningów"><textarea rows={2} placeholder="łatwiej / trudniej / normalnie..." value={form.odczucieTreningu} onChange={e=>set("odczucieTreningu",e.target.value)} className="fi" style={{ resize:"vertical",lineHeight:1.6 }} /></Field>
        <Field label="Dieta – jak się jadło"><textarea rows={2} placeholder="np. trudno z białkiem w pracy..." value={form.dietaOpis} onChange={e=>set("dietaOpis",e.target.value)} className="fi" style={{ resize:"vertical",lineHeight:1.6 }} /></Field>
        <Field label="Coś do zgłoszenia"><textarea rows={2} placeholder="wyjazd, impreza, stres w pracy..." value={form.zgloszenie} onChange={e=>set("zgloszenie",e.target.value)} className="fi" style={{ resize:"vertical",lineHeight:1.6 }} /></Field>
      </StepCard>
      <div style={{ display:"flex",justifyContent:"center",marginBottom:32 }}>
        <button onClick={handleSubmit} disabled={saving} style={{ minWidth:220,padding:"14px 40px",borderRadius:100,border:`2px solid ${T.violet}`,background:"transparent",color:T.violet,fontSize:15,fontWeight:700,cursor:saving?"not-allowed":"pointer",letterSpacing:"-0.01em",transition:"all .18s ease",boxShadow:"0 0 20px rgba(167,139,250,0.15)",opacity:saving?0.5:1 }}>{saving?"Wysyłam...":"Wyślij raport"}</button>
      </div>
      {/* Modal ostrzeżenia o brakujących obwodach */}
      {showObwodyWarning && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
          display:"flex", alignItems:"center", justifyContent:"center",
          zIndex:1000, padding:20
        }}>
          <div style={{
            background:T.bg, border:`1.5px solid ${T.amber}55`,
            borderRadius:18, padding:"28px 24px", maxWidth:380, width:"100%"
          }}>
            <div style={{ fontSize:36, textAlign:"center", marginBottom:12 }}>⚠️</div>
            <div style={{ fontSize:18, fontWeight:800, color:T.amber,
              textAlign:"center", marginBottom:10 }}>
              To jest ważne!
            </div>
            <div style={{ fontSize:13, color:T.textSub, lineHeight:1.7,
              textAlign:"center", marginBottom:20 }}>
              Pomiary co 4 tygodnie to <strong style={{ color:T.amber }}>kluczowy wskaźnik realnego progresu</strong>.
              Bez nich ocena skuteczności planu staje się znacznie trudniejsza.
              <br /><br />
              Możesz pominąć — ale robisz to <strong style={{ color:T.rose }}>na własną odpowiedzialność</strong>.
              Grozi to spowolnieniem realnego progresu.
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <button
                onClick={() => { setShowObwodyWarning(false); setObwodyOpen(true); }}
                style={{
                  padding:"12px", borderRadius:12, border:"none",
                  background:`${T.amber}22`, color:T.amber,
                  fontSize:14, fontWeight:700, cursor:"pointer"
                }}>
                ✏️ Chcę wypełnić pomiary
              </button>
              <button
                onClick={handleSaveForce}
                style={{
                  padding:"12px", borderRadius:12,
                  border:`1.5px solid ${T.rose}44`,
                  background:"transparent", color:T.rose,
                  fontSize:13, fontWeight:600, cursor:"pointer"
                }}>
                Pomijam na własną odpowiedzialność
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function TrainerDashboard({ reports, onUpdateReports, comments, onUpdateComments }) {
  const T = useT(); const scoreColor = useScoreColor();
  const sorted = [...reports].sort((a,b)=>new Date(a.data)-new Date(b.data));
  const last = sorted[sorted.length-1];
  const prev = sorted.length>=2 ? sorted[sorted.length-2] : null;
  const [editingId,setEditingId] = useState(null);
  const [draftComment,setDraftComment] = useState("");
  const [savingCmt,setSavingCmt] = useState(false);
  const [savedCmtId,setSavedCmtId] = useState(null);
  const [showCSV,setShowCSV] = useState(false);
  const [clearConfirm,setClearConfirm] = useState(false);
  const [clearConfirm2,setClearConfirm2] = useState(false);
  const [activeTab,setActiveTab] = useState("overview");
  const [deleteConfirm,setDeleteConfirm] = useState(null);
  const [deleteConfirm2,setDeleteConfirm2] = useState(null);
  const clearAll = useCallback(async () => { await onUpdateReports([]); setClearConfirm(false); setClearConfirm2(false); }, [onUpdateReports]);
  const deleteReport = useCallback(async id => { const filtered = reports.filter(r=>r.id!==id); await onUpdateReports(filtered); const upd = { ...comments }; delete upd[id]; await onUpdateComments(upd); setDeleteConfirm(null); setDeleteConfirm2(null); }, [reports, comments, onUpdateReports, onUpdateComments]);
  const saveComment = useCallback(async id => {
    if (!draftComment.trim()) return;
    setSavingCmt(true);
    const upd = { ...comments, [id]: draftComment };
    await onUpdateComments(upd);
    try {
      const rep = reports.find(r => r.id === id);
      const dateParts = rep?.data?.split("-") || [];
      const dateFormatted = dateParts.length===3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : (rep?.data || "—");
      // Wykres radarowy — znajdź poprzedni raport
      const sortedAll = [...reports].sort((a,b) => new Date(a.data)-new Date(b.data));
      const repIdx = sortedAll.findIndex(r => r.id === id);
      const prevRep = repIdx > 0 ? sortedAll[repIdx - 1] : null;
      const radarVals = r => r ? [
        parseInt(r.energia) || 0,
        parseInt(r.senJakosc) || 0,
        Math.max(0, 10 - (parseInt(r.stres) || 0)),
        parseDieta(r.dietaTrzymanie) ?? 0,
        r.treningiPlan ? Math.min(10, Math.round((parseInt(r.treningiWykonane)/parseInt(r.treningiPlan))*10)) : 0,
      ] : null;
      const currVals = radarVals(rep);
      const prevVals = radarVals(prevRep);
      const chartConfig = {
        type: "radar",
        data: {
          labels: ["Energia","Jakość snu","Brak stresu","Dieta","Trening"],
          datasets: [
            ...(prevVals ? [{label:"Poprzedni tydzień",data:prevVals,borderColor:"#818cf8",backgroundColor:"rgba(129,140,248,0.15)",pointBackgroundColor:"#818cf8",borderDash:[5,3],borderWidth:2}] : []),
            {label:"Ostatni tydzień",data:currVals,borderColor:"#f97316",backgroundColor:"rgba(249,115,22,0.2)",pointBackgroundColor:"#f97316",borderWidth:2},
          ],
        },
        options: { scale: { ticks: { beginAtZero: true, max: 10, stepSize: 2 } } },
      };
      // Pobierz krótki URL z QuickChart API (unika problemów z długim URL w EmailJS)
      let radarChartUrl = "";
      try {
        const qcRes = await fetch("https://quickchart.io/chart/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chart: chartConfig, width: 500, height: 380, backgroundColor: "white" }),
        });
        const qcData = await qcRes.json();
        radarChartUrl = qcData.url || "";
      } catch (qcErr) {
        console.error("QuickChart API error:", qcErr);
      }
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_COMMENT_ID,
        {
          to_email:          CLIENT_EMAIL,
          data:              dateFormatted,
          comment:           draftComment,
          radarChartUrl:     radarChartUrl,
          waga:              rep?.sredniaTygodnia || rep?.waga || "—",
          pas:               rep?.pas             || "—",
          zdjecia:           rep?.zdjecia         || "—",
          treningiWykonane:  rep?.treningiWykonane || "—",
          treningiPlan:      rep?.treningiPlan     || "—",
          sila:              rep?.sila             || "—",
          sen:               rep?.sen              || "—",
          senJakosc:         rep?.senJakosc        || "—",
          zarwanaNoc:        rep?.zarwanaNoc       || "NIE",
          dietaTrzymanie:    rep?.dietaTrzymanie   || "—",
          bialko:            rep?.bialko           || "—",
          kcal:              rep?.kcal             || "—",
          kreatyna:          rep?.kreatyna         || "—",
          energia:           rep?.energia          || "—",
          stres:             rep?.stres            || "—",
          bol:               rep?.bol              || "NIE",
          bolMiejsce:        rep?.bolMiejsce       || "—",
          progres:           rep?.progres          || "—",
          odczucieTreningu:  rep?.odczucieTreningu || "—",
          dietaOpis:         rep?.dietaOpis        || "—",
          zgloszenie:        rep?.zgloszenie       || "—",
          klatka:            rep?.klatka           || "—",
          ramie:             rep?.ramie            || "—",
          przedramie:        rep?.przedramie       || "—",
          udo:               rep?.udo              || "—",
          lydka:             rep?.lydka            || "—",
          barki:             rep?.barki            || "—",
          obwodyNotatka:     rep?.obwodyNotatka    || "—",
        },
        EMAILJS_PUBLIC_KEY
      );
    } catch (e) {
      console.error("EmailJS comment error:", e);
    }
    setEditingId(null);
    setDraftComment("");
    setSavedCmtId(id);
    setTimeout(()=>setSavedCmtId(null), 3000);
    setSavingCmt(false);
  }, [draftComment, comments, onUpdateComments, reports]);
  const delComment = useCallback(async id => { const upd = { ...comments }; delete upd[id]; await onUpdateComments(upd); }, [comments, onUpdateComments]);
  const tooltipStyle = { background:T.bg==="#07090f"?"#0b0e18":"#ffffff",border:`1.5px solid ${T.border}`,borderRadius:10,color:T.text,fontSize:12,boxShadow:"0 8px 32px rgba(0,0,0,0.18)" };
  const gridStroke = T.bg==="#07090f"?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.08)";
  const tickStyle = { fill:T.textSub,fontSize:11 };
  const weightData = sorted.filter(r=>r.sredniaTygodnia||r.waga).map(r=>({name:r.data?.slice(5),val:parseFloat(r.sredniaTygodnia||r.waga)}));
  const pasData = sorted.filter(r=>r.pas).map(r=>({name:r.data?.slice(5),val:parseFloat(r.pas)}));
  const wellnessData = sorted.map(r=>({name:r.data?.slice(5),Energia:parseInt(r.energia)||null,Sen:parseInt(r.senJakosc)||null,Stres:parseInt(r.stres)||null,Dieta:parseDieta(r.dietaTrzymanie)}));
  const trainingData = sorted.filter(r=>r.treningiWykonane).map(r=>({name:r.data?.slice(5),Wykonane:parseInt(r.treningiWykonane)||0,Plan:parseInt(r.treningiPlan)||0}));
  const radarData = last ? [
    {subject:"Energia",val:parseInt(last.energia)||0,prev:prev?(parseInt(prev.energia)||0):null},
    {subject:"Jakość snu",val:parseInt(last.senJakosc)||0,prev:prev?(parseInt(prev.senJakosc)||0):null},
    {subject:"Brak stresu",val:Math.max(0,10-(parseInt(last.stres)||0)),prev:prev?Math.max(0,10-(parseInt(prev.stres)||0)):null},
    {subject:"Dieta",val:parseDieta(last.dietaTrzymanie)??0,prev:prev?(parseDieta(prev.dietaTrzymanie)??0):null},
    {subject:"Trening",val:last.treningiPlan?Math.min(10,Math.round((parseInt(last.treningiWykonane)/parseInt(last.treningiPlan))*10)):0,prev:prev&&prev.treningiPlan?Math.min(10,Math.round((parseInt(prev.treningiWykonane)/parseInt(prev.treningiPlan))*10)):null},
  ] : [];
  if (reports.length===0) return (<div style={{ textAlign:"center",padding:"80px 20px" }}><div style={{ fontSize:56,marginBottom:16 }}>📭</div><div style={{ fontSize:18,fontWeight:800,color:T.text }}>Brak raportów</div><div style={{ fontSize:13,color:T.textMuted,marginTop:6 }}>Poczekaj aż Marcel wyśle pierwszy raport</div></div>);
  return (
    <div style={{ maxWidth:720,margin:"0 auto" }}>
      {showCSV && <CSVModal reports={reports} onClose={()=>setShowCSV(false)} />}
      <div style={{ display:"flex",gap:6,marginBottom:14,background:"rgba(255,255,255,0.04)",padding:5,borderRadius:14,border:`1.5px solid ${T.border}` }}>
        {[["overview","📊 Przegląd"],["charts","📈 Wykresy"],["history","📋 Historia"],["measurements","📐 Pomiary"]].map(([id,label])=>(<button key={id} className={`tab-pill ${activeTab===id?"on":"off"}`} onClick={()=>setActiveTab(id)} style={{ flex:1 }}>{label}</button>))}
      </div>
      {activeTab==="overview"&&(
        <div className="fade-up">
          {last&&<FullReportBlock r={last} label="Ostatni tydzień" dimmed={false} comments={comments} />}
          {prev&&<FullReportBlock r={prev} label="-1 tydzień" dimmed={true} comments={comments} />}
          {last&&(
            <div style={{ background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:18,padding:"18px 20px",marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:700,color:T.amber,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.1em" }}>🎯 Stan ogólny – porównanie tygodni</div>
              <div style={{ display:"flex",gap:16,marginBottom:8,flexWrap:"wrap" }}>
                <div style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#e2e8f0" }}><svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={T.amber} strokeWidth="2.5"/></svg>Ostatni tydzień</div>
                {prev&&<div style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#a5b4fc" }}><svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke="#818cf8" strokeWidth="2" strokeDasharray="4 3"/></svg>Poprzedni tydzień</div>}
              </div>
              <ResponsiveContainer width="100%" height={240}><RadarChart data={radarData}><PolarGrid stroke={gridStroke} /><PolarAngleAxis dataKey="subject" tick={tickStyle} />{prev&&<Radar dataKey="prev" stroke="#818cf8" fill="#818cf8" fillOpacity={0.12} strokeWidth={2} strokeDasharray="5 3" />}<Radar dataKey="val" stroke={T.amber} fill={T.amber} fillOpacity={0.22} strokeWidth={2.5} /></RadarChart></ResponsiveContainer>
            </div>
          )}
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            <button onClick={()=>setShowCSV(true)} style={{ flex:1,minWidth:140,padding:"12px",background:"rgba(255,255,255,0.05)",border:`1.5px solid ${T.border}`,borderRadius:12,color:T.textSub,fontSize:13,fontWeight:700,cursor:"pointer" }}>📊 Eksportuj CSV</button>
            {!clearConfirm&&<button onClick={()=>setClearConfirm(true)} style={{ padding:"12px 16px",background:"rgba(251,113,133,0.07)",border:"1.5px solid rgba(251,113,133,0.2)",borderRadius:12,color:T.rose,fontSize:13,fontWeight:700,cursor:"pointer" }}>🗑 Wyczyść bazę</button>}
            {clearConfirm&&!clearConfirm2&&(<div style={{ display:"flex",alignItems:"center",gap:8,background:"rgba(251,113,133,0.08)",border:"1.5px solid rgba(251,113,133,0.3)",borderRadius:12,padding:"10px 14px" }}><span style={{ fontSize:12,color:T.rose,fontWeight:700 }}>Usunąć wszystkie?</span><button onClick={()=>setClearConfirm2(true)} style={{ padding:"5px 14px",borderRadius:100,border:"none",background:"rgba(251,113,133,0.2)",color:T.rose,fontSize:12,fontWeight:800,cursor:"pointer" }}>Tak</button><button onClick={()=>setClearConfirm(false)} style={{ padding:"5px 12px",borderRadius:100,border:"1.5px solid rgba(255,255,255,0.1)",background:"transparent",color:T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer" }}>Nie</button></div>)}
            {clearConfirm2&&(<div style={{ display:"flex",alignItems:"center",gap:8,background:"rgba(251,113,133,0.1)",border:"1.5px solid rgba(251,113,133,0.4)",borderRadius:12,padding:"10px 14px" }}><span style={{ fontSize:12,color:T.rose,fontWeight:800 }}>Na pewno?</span><button onClick={clearAll} style={{ padding:"5px 16px",borderRadius:100,border:"none",background:T.rose,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer" }}>Usuń</button><button onClick={()=>{ setClearConfirm(false); setClearConfirm2(false); }} style={{ padding:"5px 12px",borderRadius:100,border:"1.5px solid rgba(255,255,255,0.1)",background:"transparent",color:T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer" }}>Anuluj</button></div>)}
          </div>
        </div>
      )}
      {activeTab==="charts"&&(
        <div className="fade-up">
          {weightData.length>=1&&<ChartCard title="⚖️ Trend wagi (kg)" accent={T.cyan}><ResponsiveContainer width="100%" height={170}><LineChart data={weightData}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke}/><XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false}/><YAxis tick={tickStyle} domain={["auto","auto"]} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle}/><Line type="monotone" dataKey="val" stroke={T.cyan} strokeWidth={2.5} dot={{fill:T.cyan,r:5,strokeWidth:0}} activeDot={{r:7,fill:T.cyan}} name="Waga (kg)"/></LineChart></ResponsiveContainer></ChartCard>}
          {pasData.length>=1&&<ChartCard title="📏 Trend pasa (cm)" accent={T.violet}><ResponsiveContainer width="100%" height={150}><LineChart data={pasData}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke}/><XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false}/><YAxis tick={tickStyle} domain={["auto","auto"]} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle}/><Line type="monotone" dataKey="val" stroke={T.violet} strokeWidth={2.5} dot={{fill:T.violet,r:5,strokeWidth:0}} name="Pas (cm)"/></LineChart></ResponsiveContainer></ChartCard>}
          {wellnessData.length>=1&&(<ChartCard title="⚡ Wellbeing — Energia / Sen / Stres / Dieta" accent={T.emerald}><div style={{ display:"flex",gap:14,marginBottom:12,flexWrap:"wrap" }}>{[["Energia",T.amber],["Sen",T.emerald],["Stres",T.rose],["Dieta",T.cyan]].map(([n,c])=><div key={n} style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,color:T.textMuted }}><div style={{ width:22,height:3,background:c,borderRadius:2 }}/>{n}</div>)}</div><ResponsiveContainer width="100%" height={190}><LineChart data={wellnessData}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke}/><XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false}/><YAxis tick={tickStyle} domain={[0,10]} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle}/><Line type="monotone" dataKey="Energia" stroke={T.amber} strokeWidth={2} dot={{r:4,fill:T.amber,strokeWidth:0}} connectNulls/><Line type="monotone" dataKey="Sen" stroke={T.emerald} strokeWidth={2} dot={{r:4,fill:T.emerald,strokeWidth:0}} connectNulls/><Line type="monotone" dataKey="Stres" stroke={T.rose} strokeWidth={2} dot={{r:4,fill:T.rose,strokeWidth:0}} connectNulls/><Line type="monotone" dataKey="Dieta" stroke={T.cyan} strokeWidth={2} dot={{r:4,fill:T.cyan,strokeWidth:0}} connectNulls/></LineChart></ResponsiveContainer></ChartCard>)}
          {trainingData.length>=1&&<ChartCard title="🏋 Treningi — wykonane vs plan" accent={T.violet}><ResponsiveContainer width="100%" height={160}><BarChart data={trainingData} barCategoryGap="35%"><CartesianGrid strokeDasharray="3 3" stroke={gridStroke}/><XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false}/><YAxis tick={tickStyle} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="Plan" fill={T.bg==="#07090f"?"rgba(167,139,250,0.15)":"rgba(124,58,237,0.1)"} radius={[6,6,0,0]}/><Bar dataKey="Wykonane" fill={T.violet} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></ChartCard>}
        </div>
      )}
      {activeTab==="measurements"&&(
        <div className="fade-up">
          {/* Karty KPI — ostatnie wartości */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:16 }}>
            {[
              { key:"sredniaTygodnia", label:"Waga", unit:"kg" },
              { key:"pas",             label:"Talia", unit:"cm" },
              { key:"klatka",          label:"Klatka", unit:"cm" },
              { key:"ramie",           label:"Ramię", unit:"cm" },
            ].map(({ key, label, unit }) => {
              const reportsWithVal = sorted.filter(r => r[key] && r[key] !== "brak info" && !isNaN(parseFloat(r[key])));
              const lastVal  = reportsWithVal.at(-1)?.[key];
              const firstVal = reportsWithVal.at(0)?.[key];
              const diff = lastVal && firstVal && lastVal !== firstVal ? (parseFloat(lastVal) - parseFloat(firstVal)).toFixed(1) : null;
              return (
                <div key={key} style={{
                  background:T.surface, border:`1.5px solid ${T.border}`,
                  borderRadius:12, padding:"10px 12px"
                }}>
                  <div style={{ fontSize:10, color:T.textMuted, marginBottom:4,
                    textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>
                    {label}
                  </div>
                  <div style={{ fontSize:20, fontWeight:800, color:T.text }}>
                    {lastVal || "–"} <span style={{ fontSize:11, fontWeight:400 }}>{lastVal ? unit : ""}</span>
                  </div>
                  {diff && (
                    <div style={{ fontSize:11, fontWeight:700, marginTop:2,
                      color: parseFloat(diff) < 0 ? T.lime : T.rose }}>
                      {parseFloat(diff) > 0 ? "+" : ""}{diff} {unit}
                      <span style={{ fontSize:9, fontWeight:400, color:T.textMuted, marginLeft:3 }}>od 1. pomiaru</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Tabela historii obwodów */}
          <div style={{
            background:T.surface, border:`1.5px solid ${T.border}`,
            borderRadius:16, padding:"16px 18px", marginBottom:14, overflowX:"auto"
          }}>
            <div style={{ fontSize:10, fontWeight:700, color:T.violet,
              textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>
              Historia pomiarów
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr>
                  {["Data","Waga","Talia","Klatka","Ramię","Przeds.","Udo","Łydka","Barki"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"4px 8px",
                      color:T.textMuted, fontWeight:700, fontSize:10,
                      textTransform:"uppercase", letterSpacing:"0.06em",
                      borderBottom:`1px solid ${T.border}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...sorted].reverse()
                  .filter(r => r.klatka || r.ramie || r.pas)
                  .map((r, i, arr) => {
                    const prev2 = arr[i + 1];
                    const delta = (key) => {
                      if (!r[key] || !prev2?.[key]) return null;
                      return (parseFloat(r[key]) - parseFloat(prev2[key])).toFixed(1);
                    };
                    const cell = (key) => {
                      const val = r[key];
                      const d = delta(key);
                      if (!val || val === "brak info") return <td style={{ padding:"6px 8px", color:T.textMuted, opacity:0.4 }}>—</td>;
                      return (
                        <td style={{ padding:"6px 8px", color:T.text }}>
                          {val}
                          {d && (
                            <span style={{ fontSize:10, fontWeight:700, marginLeft:4,
                              color: parseFloat(d) < 0 ? T.lime : T.rose }}>
                              {parseFloat(d) > 0 ? "▲" : "▼"}{Math.abs(d)}
                            </span>
                          )}
                        </td>
                      );
                    };
                    return (
                      <tr key={r.id} style={{ borderBottom:`0.5px solid ${T.border}` }}>
                        <td style={{ padding:"6px 8px", color:T.textMuted, fontWeight:600, whiteSpace:"nowrap" }}>
                          {r.data?.slice(5)}
                        </td>
                        {cell("sredniaTygodnia")}
                        {cell("pas")}
                        {cell("klatka")}
                        {cell("ramie")}
                        {cell("przedramie")}
                        {cell("udo")}
                        {cell("lydka")}
                        {cell("barki")}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {/* Wykres trendu talii */}
          {pasData.length >= 1 && (
            <ChartCard title="📏 Trend talii (cm)" accent={T.violet}>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={pasData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke}/>
                  <XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false}/>
                  <YAxis tick={tickStyle} domain={["auto","auto"]} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={tooltipStyle}/>
                  <Line type="monotone" dataKey="val" stroke={T.violet}
                    strokeWidth={2.5} dot={{fill:T.violet,r:5,strokeWidth:0}} name="Talia (cm)"/>
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
          {/* Galeria zdjęć progress */}
          {sorted.filter(r => r.obwodyZdjecia?.some(Boolean)).length > 0 && (
            <div style={{
              background:T.surface, border:`1.5px solid ${T.border}`,
              borderRadius:16, padding:"16px 18px", marginBottom:14
            }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted,
                textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>
                📷 Zdjęcia progress
              </div>
              <div style={{ display:"flex", gap:10, overflowX:"auto" }}>
                {[...sorted]
                  .filter(r => r.obwodyZdjecia?.some(Boolean))
                  .reverse()
                  .map(r => (
                    <div key={r.id} style={{ flexShrink:0, width:80 }}>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:2, marginBottom:4 }}>
                        {(r.obwodyZdjecia || []).map((src, i) => (
                          src
                            ? <img key={i} src={src} alt=""
                                style={{ width:"100%", aspectRatio:"3/4", objectFit:"cover", borderRadius:6 }} />
                            : <div key={i} style={{ width:"100%", aspectRatio:"3/4",
                                background:T.border, borderRadius:6, opacity:0.3 }} />
                        ))}
                      </div>
                      <div style={{ fontSize:10, color:T.textMuted, textAlign:"center" }}>
                        {r.data?.slice(5)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {/* Notatki do pomiarów */}
          {sorted.filter(r => r.obwodyNotatka).length > 0 && (
            <div style={{
              background:T.surface, border:`1.5px solid ${T.border}`,
              borderRadius:16, padding:"16px 18px"
            }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.textMuted,
                textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>
                📝 Notatki do pomiarów
              </div>
              {[...sorted].filter(r => r.obwodyNotatka).reverse().map(r => (
                <div key={r.id} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:10, color:T.textMuted, marginBottom:3, fontWeight:700 }}>
                    {r.data?.slice(5)}
                  </div>
                  <div style={{
                    background:`${T.violet}0a`, border:`0.5px solid ${T.violet}22`,
                    borderLeft:`2px solid ${T.violet}66`,
                    borderRadius:"0 10px 10px 0", padding:"8px 12px",
                    fontSize:12, color:T.textSub, fontStyle:"italic", lineHeight:1.6
                  }}>
                    {r.obwodyNotatka}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab==="history"&&(
        <div className="fade-up">
          <div style={{ background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:18,padding:"18px 20px" }}>
            {[...sorted].reverse().map((r,i,arr)=>(
              <div key={r.id} style={{ borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none",paddingBottom:18,marginBottom:18 }}>
                {r.bol==="TAK"&&<div style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:700,color:T.rose,background:`${T.rose}14`,border:`0.5px solid ${T.rose}44`,borderRadius:8,padding:"5px 10px",marginBottom:8 }}>⚠️ ból — {r.bolMiejsce||"zgłoszony"}</div>}
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:8 }}>
                  <span style={{ fontWeight:800,fontSize:16,color:T.text,fontFamily:"'JetBrains Mono',monospace",flexShrink:0 }}>{weekRange(r.data)}</span>
                  <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                    {/* foto badge — zawsze widoczny */}
                    <span style={{ fontSize:10,fontWeight:700,padding:"3px 0",width:64,textAlign:"center",borderRadius:6,
                      background:r.zdjecia==="TAK"?`${T.emerald}18`:"transparent",
                      color:r.zdjecia==="TAK"?T.emerald:T.textMuted,
                      border:r.zdjecia==="TAK"?`0.5px solid ${T.emerald}44`:`0.5px dashed ${T.border}`,
                      opacity:r.zdjecia==="TAK"?1:0.45 }}>📷 foto</span>
                    {/* dieta badge — zawsze widoczny */}
                    {(()=>{
                      const d = r.dietaTrzymanie;
                      const isClean = d==="90-100%", isMix = d==="60-80%", isDirty = d==="<60%";
                      const col = isClean?T.emerald:isMix?T.amber:isDirty?T.rose:T.textMuted;
                      const lbl = isClean?"🥗 Clean":isMix?"🥗 Mix":isDirty?"🥗 Dirty":"🥗 —";
                      const hasDiet = isClean||isMix||isDirty;
                      return <span style={{ fontSize:10,fontWeight:700,padding:"3px 0",width:64,textAlign:"center",borderRadius:6,
                        background:hasDiet?`${col}18`:"transparent",
                        color:hasDiet?col:T.textMuted,
                        border:hasDiet?`0.5px solid ${col}44`:`0.5px dashed ${T.border}`,
                        opacity:hasDiet?1:0.45 }}>{lbl}</span>;
                    })()}
                    {deleteConfirm!==r.id&&<button onClick={()=>{ setDeleteConfirm(r.id); setDeleteConfirm2(null); }} style={{ fontSize:11,padding:"4px 10px",borderRadius:100,border:`1.5px solid ${T.border}`,background:"transparent",color:T.textMuted,cursor:"pointer",fontWeight:600 }}>🗑</button>}
                    {deleteConfirm===r.id&&deleteConfirm2!==r.id&&(<div style={{ display:"flex",alignItems:"center",gap:6 }}><span style={{ fontSize:11,color:T.rose,fontWeight:700 }}>Usunąć?</span><button onClick={()=>setDeleteConfirm2(r.id)} style={{ fontSize:11,padding:"5px 12px",borderRadius:100,border:"none",background:"rgba(251,113,133,0.15)",color:T.rose,cursor:"pointer",fontWeight:700 }}>Tak</button><button onClick={()=>setDeleteConfirm(null)} style={{ fontSize:11,padding:"5px 12px",borderRadius:100,border:`1.5px solid ${T.border}`,background:"transparent",color:T.textMuted,cursor:"pointer",fontWeight:600 }}>Nie</button></div>)}
                    {deleteConfirm2===r.id&&(<div style={{ display:"flex",alignItems:"center",gap:6 }}><span style={{ fontSize:11,color:T.rose,fontWeight:800 }}>Na pewno?</span><button onClick={()=>deleteReport(r.id)} style={{ fontSize:11,padding:"5px 14px",borderRadius:100,border:"none",background:T.rose,color:"#fff",cursor:"pointer",fontWeight:800 }}>Usuń</button><button onClick={()=>{ setDeleteConfirm(null); setDeleteConfirm2(null); }} style={{ fontSize:11,padding:"5px 12px",borderRadius:100,border:`1.5px solid ${T.border}`,background:"transparent",color:T.textMuted,cursor:"pointer",fontWeight:600 }}>Anuluj</button></div>)}
                  </div>
                </div>
                {/* Siatka pigułek — zawsze 8, puste wyszarzone */}
                <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10 }}>
                  {(()=>{
                    const weight = r.sredniaTygodnia||r.waga;
                    const pas = r.pas&&r.pas!=="brak info"?r.pas:null;
                    const trening = r.treningiWykonane?`${r.treningiWykonane}/${r.treningiPlan}`:null;
                    const sen = r.sen;
                    const energia = r.energia;
                    const stres = r.stres;
                    const bialko = r.bialko&&r.bialko!=="brak info"?r.bialko:null;
                    const kreatyna = r.kreatyna&&r.kreatyna!=="brak info"?r.kreatyna:null;
                    const pillStyle = { display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"5px 6px",borderRadius:100,fontSize:11,border:`0.5px solid ${T.border}`,background:T.surface,color:T.textSub,whiteSpace:"nowrap" };
                    const emptyStyle = { display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"5px 6px",borderRadius:100,fontSize:11,border:`0.5px dashed ${T.border}`,background:"transparent",color:T.textMuted,whiteSpace:"nowrap",opacity:0.45 };
                    return (<>
                      {weight?<span style={pillStyle}>⚖️ {weight} kg</span>:<span style={emptyStyle}>⚖️ —</span>}
                      {pas?<span style={pillStyle}>📏 {pas} cm</span>:<span style={emptyStyle}>📏 —</span>}
                      {trening?<span style={pillStyle}>🏋 {trening}</span>:<span style={emptyStyle}>🏋 —</span>}
                      {sen?<span style={pillStyle}>😴 {sen}h</span>:<span style={emptyStyle}>😴 —</span>}
                      {energia?<span style={{...pillStyle,color:scoreColor(parseInt(energia))}}>{displayEnergia(energia)}</span>:<span style={emptyStyle}>⚡ —</span>}
                      {stres?<span style={pillStyle}>😤 S:{stres}</span>:<span style={emptyStyle}>😤 —</span>}
                      {bialko?<span style={{...pillStyle,color:proteinColor(parseFloat(bialko),T)}}>🥩 {bialko} g/kg</span>:<span style={emptyStyle}>🥩 —</span>}
                      {kreatyna?<span style={pillStyle}>💊 K:{kreatyna}g</span>:<span style={emptyStyle}>💊 —</span>}
                    </>);
                  })()}
                </div>
                {/* Feedback klienta — zawsze 4 pola */}
                <div style={{ background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:10,padding:"10px 12px",marginBottom:10 }}>
                  <div style={{ fontSize:9,fontWeight:700,color:T.cyan,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8 }}>Feedback klienta</div>
                  {[["progres","💪 Progres"],["odczucieTreningu","🏋 Odczucie"],["dietaOpis","🥗 Dieta"],["zgloszenie","📝 Zgłoszenie"]].map(([k,lbl],idx,all)=>{
                    const val = r[k];
                    const isLast = idx===all.length-1;
                    return (
                      <div key={k} style={{ paddingTop:6,paddingBottom:isLast?0:6,borderBottom:isLast?"none":`0.5px solid ${T.border}` }}>
                        <div style={{ fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2,color:val?T.textMuted:T.textMuted,opacity:val?1:0.5 }}>{lbl}</div>
                        <div style={{ fontSize:12,lineHeight:1.55,color:val?T.text:T.textMuted,opacity:val?1:0.4 }}>{val||"— nie wypełniono"}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop:4 }}>
                  {savedCmtId===r.id&&<div style={{ fontSize:11,color:T.emerald,marginBottom:8 }}>✅ Komentarz zapisany w bazie</div>}
                  {comments[r.id]&&editingId!==r.id ? (
                    <div style={{ background:"rgba(167,139,250,0.07)",border:"1.5px solid rgba(167,139,250,0.2)",borderRadius:12,padding:"12px 14px" }}>
                      <div style={{ fontSize:10,color:T.violet,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:6 }}>Komentarz trenera</div>
                      <div style={{ fontSize:13,color:T.text,lineHeight:1.7 }}>{comments[r.id]}</div>
                      <div style={{ display:"flex",gap:8,marginTop:10 }}>
                        <button onClick={()=>{ setEditingId(r.id); setDraftComment(comments[r.id]); }} style={{ fontSize:11,padding:"5px 14px",borderRadius:100,border:"1.5px solid rgba(167,139,250,0.3)",background:"transparent",color:T.violet,cursor:"pointer",fontWeight:600 }}>✏️ Edytuj</button>
                        <button onClick={()=>delComment(r.id)} style={{ fontSize:11,padding:"5px 14px",borderRadius:100,border:"1.5px solid rgba(251,113,133,0.25)",background:"transparent",color:T.rose,cursor:"pointer",fontWeight:600 }}>🗑 Usuń</button>
                      </div>
                    </div>
                  ) : editingId===r.id ? (
                    <div style={{ background:"rgba(167,139,250,0.06)",border:"1.5px solid rgba(167,139,250,0.25)",borderRadius:12,padding:"12px 14px" }}>
                      <div style={{ fontSize:10,color:T.violet,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:8 }}>Edytujesz komentarz</div>
                      <textarea value={draftComment} onChange={e=>setDraftComment(e.target.value)} placeholder="Wpisz komentarz..." rows={3} style={{ width:"100%",background:T.surface,border:`1.5px solid ${T.violet}4d`,borderRadius:10,color:T.text,padding:"9px 12px",fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box",lineHeight:1.5 }} />
                      <div style={{ display:"flex",gap:8,marginTop:10 }}>
                        <button onClick={()=>saveComment(r.id)} disabled={savingCmt||!draftComment.trim()} style={{ fontSize:12,padding:"7px 20px",borderRadius:100,border:"none",background:draftComment.trim()?T.violet:"rgba(255,255,255,0.06)",color:draftComment.trim()?"#fff":T.textMuted,cursor:draftComment.trim()?"pointer":"not-allowed",fontWeight:700 }}>{savingCmt?"⏳":"💾 Zapisz"}</button>
                        <button onClick={()=>{ setEditingId(null); setDraftComment(""); }} style={{ fontSize:12,padding:"7px 16px",borderRadius:100,border:"1.5px solid rgba(255,255,255,0.1)",background:"transparent",color:T.textMuted,cursor:"pointer",fontWeight:600 }}>Anuluj</button>
                      </div>
                    </div>
                  ) : (
                    <button className="comment-ghost" onClick={()=>{ setEditingId(r.id); setDraftComment(""); }}>+ Dodaj komentarz trenera</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function LoginScreen({ onLogin }) {
  const [login,setLogin] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState(false);
  const [shake,setShake] = useState(false);
  const T = DARK_T;
  const handleLogin = () => {
    if (login.trim().toLowerCase() === "marcel" && password === "2026") {
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };
  const handleKey = e => { if (e.key === "Enter") handleLogin(); };
  return (
    <div style={{ minHeight:"100vh", background:"#07090f", backgroundImage:"radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,212,255,0.07) 0%, transparent 70%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}>
      <style>{CSS}{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}.shake{animation:shake 0.4s ease}`}</style>
      <div className={shake ? "shake" : ""} style={{ width:"100%", maxWidth:380, display:"flex", flexDirection:"column", gap:"1.25rem" }}>
        <div style={{ marginBottom:"0.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#00d4ff,#a78bfa)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>⚡</div>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:"#f0f4f8", letterSpacing:"-0.02em", lineHeight:1 }}>Trust the Process</div>
              <div style={{ fontSize:9, color:"rgba(148,163,184,0.5)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Coaching Tracker v2.1</div>
            </div>
          </div>
          <div style={{ fontSize:24, fontWeight:800, color:"#f0f4f8", letterSpacing:"-0.03em", marginTop:"1.25rem" }}>Zaloguj się</div>
          <div style={{ fontSize:12, color:"rgba(148,163,184,0.5)", marginTop:4 }}>Wpisz dane dostępu aby kontynuować</div>
        </div>
        <div>
          <label style={{ fontSize:10, color:"rgba(148,163,184,0.5)", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700, display:"block", marginBottom:6 }}>Login</label>
          <input value={login} onChange={e=>{setLogin(e.target.value);setError(false);}} onKeyDown={handleKey} placeholder="login" className={`fi${error?" err":""}`} autoComplete="username" />
        </div>
        <div>
          <label style={{ fontSize:10, color:"rgba(148,163,184,0.5)", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700, display:"block", marginBottom:6 }}>Hasło</label>
          <input type="password" value={password} onChange={e=>{setPassword(e.target.value);setError(false);}} onKeyDown={handleKey} placeholder="••••••" className={`fi${error?" err":""}`} autoComplete="current-password" />
        </div>
        {error && <div style={{ fontSize:12, color:"#fb7185", fontWeight:600, textAlign:"center" }}>Nieprawidłowy login lub hasło</div>}
        <button onClick={handleLogin} style={{ width:"100%", padding:"14px", background:"linear-gradient(135deg,rgba(0,212,255,0.15),rgba(167,139,250,0.15))", border:"1.5px solid rgba(0,212,255,0.3)", borderRadius:12, color:"#00d4ff", fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.04em", transition:"all .18s ease" }}>
          Wejdź →
        </button>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:11, color:"rgba(148,163,184,0.25)" }}>Brak dostępu? Skontaktuj się z trenerem.</div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [loggedIn,setLoggedIn] = useState(false);
  const [view,setView] = useState("client");
  const [reports,setReports] = useState([]);
  const [comments,setComments] = useState({});
  const [isDark,setIsDark] = useState(false);
  const [loading,setLoading] = useState(true);
  const T = isDark ? DARK_T : LIGHT_T;

  useEffect(() => {
    (async () => {
      const [savedReports, savedComments] = await Promise.all([storageGet(STORAGE_KEY),storageGet(COMMENTS_KEY)]);
      if (Array.isArray(savedReports)) setReports([...savedReports].sort((a,b)=>new Date(a.data)-new Date(b.data)));
      if (savedComments && typeof savedComments==="object" && !Array.isArray(savedComments)) setComments(savedComments);
      setLoading(false);
    })();
  }, []);
  const handleNewReport = useCallback((report) => { setReports(prev => { const updated = [...prev.filter(r => r.id !== report.id), report]; return updated.sort((a,b) => new Date(a.data) - new Date(b.data)); }); }, []);
  const handleUpdateReports = useCallback(async (newReports) => { const sorted = [...newReports].sort((a,b)=>new Date(a.data)-new Date(b.data)); setReports(sorted); await storageSet(STORAGE_KEY, sorted); }, []);
  const handleUpdateComments = useCallback(async (newComments) => { setComments(newComments); await storageSet(COMMENTS_KEY, newComments); }, []);

  if (!loggedIn) return <LoginScreen onLogin={()=>setLoggedIn(true)} />;
  if (!SB_URL || !SB_KEY) return (
    <ThemeCtx.Provider value={isDark}>
      <div style={{ minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
        <style>{CSS}</style>
        <div style={{ maxWidth:460,background:T.surface,border:`1.5px solid rgba(251,113,133,0.3)`,borderRadius:20,padding:32,textAlign:"center" }}>
          <div style={{ fontSize:40,marginBottom:16 }}>⚙️</div>
          <div style={{ fontWeight:800,fontSize:18,color:T.text,marginBottom:8 }}>Brak konfiguracji Supabase</div>
          <div style={{ fontSize:13,color:T.textMuted,lineHeight:1.7,marginBottom:20 }}>Aby aplikacja działała na różnych urządzeniach, ustaw zmienne środowiskowe w Vercel.</div>
          <div style={{ background:"rgba(0,0,0,0.3)",borderRadius:12,padding:"14px 16px",textAlign:"left",fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:"#a3e635",lineHeight:2 }}>VITE_SUPABASE_URL<br/>VITE_SUPABASE_ANON_KEY</div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
  if (loading) return (
    <ThemeCtx.Provider value={isDark}>
      <div style={{ minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center" }}>
        <style>{CSS}</style>
        <div style={{ textAlign:"center" }}>
          <div style={{ width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#00d4ff,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 16px",boxShadow:"0 0 24px rgba(0,212,255,0.3)" }}>⚡</div>
          <div className="shimmer" style={{ color:T.textMuted,fontSize:13,fontWeight:600 }}>Ładowanie z bazy...</div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
  return (
    <ThemeCtx.Provider value={isDark}>
      <div className={isDark?"":"light"} style={{ minHeight:"100vh",background:T.bg,backgroundImage:isDark?"radial-gradient(ellipse 80% 40% at 50% 0%,rgba(0,212,255,0.06) 0%,transparent 60%)":"none",color:T.text,fontFamily:"'Bricolage Grotesque',sans-serif",paddingBottom:60 }}>
        <style>{CSS}</style>
        <div style={{ background:T.headerBg,backdropFilter:"blur(24px)",borderBottom:`1px solid ${T.border}`,padding:"10px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,boxShadow:isDark?"0 1px 30px rgba(0,0,0,0.5)":"0 1px 12px rgba(0,0,0,0.08)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:30,height:30,borderRadius:9,background:"linear-gradient(135deg,#00d4ff,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,boxShadow:"0 0 14px rgba(0,212,255,0.35)" }}>⚡</div>
            <div>
              <div style={{ fontWeight:800,fontSize:13,letterSpacing:"-0.02em",color:T.text,lineHeight:1 }}>Trust the Process</div>
              <div style={{ fontSize:9,color:T.textMuted,letterSpacing:"0.09em",textTransform:"uppercase",marginTop:1 }}>Coaching Tracker v2.1</div>
            </div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <button onClick={()=>setIsDark(d=>!d)} style={{ width:36,height:36,borderRadius:10,border:`1.5px solid ${T.border}`,background:T.surface,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:T.textSub }} title={isDark?"Tryb jasny":"Tryb ciemny"}>{isDark?"☀️":"🌙"}</button>
            <div style={{ display:"flex",gap:4,background:isDark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)",padding:4,borderRadius:100,border:`1px solid ${T.border}` }}>
              {[["client","Marcel"],["trainer","Mariusz"]].map(([t,l])=>(<button key={t} className={`tab-pill ${view===t?"on":"off"}`} onClick={()=>setView(t)}>{l}</button>))}
            </div>
          </div>
        </div>
        <div style={{ padding:"26px 16px 0" }}>
          {view==="client" ? <ClientForm onSave={handleNewReport} onExit={()=>setView("trainer")} reports={reports} /> : <TrainerDashboard reports={reports} onUpdateReports={handleUpdateReports} comments={comments} onUpdateComments={handleUpdateComments} />}
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
