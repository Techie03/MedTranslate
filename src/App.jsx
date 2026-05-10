import { useState, useRef, useEffect, useCallback } from "react";
import FHIR from "fhirclient";

// ─────────────────────────────────────────────────────────────
// 🔑 YOUR GROQ API KEY — paste it here
//    Get a free key at: https://console.groq.com → API Keys
// ─────────────────────────────────────────────────────────────
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL        = "meta-llama/llama-4-scout-17b-16e-instruct";

const LANGUAGES = [
  { code: "en", label: "English",    flag: "🇺🇸", native: "English"   },
  { code: "te", label: "Telugu",     flag: "🇮🇳", native: "తెలుగు"     },
  { code: "hi", label: "Hindi",      flag: "🇮🇳", native: "हिन्दी"      },
  { code: "ta", label: "Tamil",      flag: "🇮🇳", native: "தமிழ்"      },
  { code: "kn", label: "Kannada",    flag: "🇮🇳", native: "ಕನ್ನಡ"      },
  { code: "ml", label: "Malayalam",  flag: "🇮🇳", native: "മലയാളം"    },
  { code: "mr", label: "Marathi",    flag: "🇮🇳", native: "मराठी"      },
  { code: "bn", label: "Bengali",    flag: "🇧🇩", native: "বাংলা"      },
  { code: "ur", label: "Urdu",       flag: "🇵🇰", native: "اردو"       },
  { code: "es", label: "Spanish",    flag: "🇪🇸", native: "Español"    },
  { code: "fr", label: "French",     flag: "🇫🇷", native: "Français"   },
  { code: "ar", label: "Arabic",     flag: "🇸🇦", native: "العربية"    },
  { code: "zh", label: "Chinese",    flag: "🇨🇳", native: "中文"        },
  { code: "pt", label: "Portuguese", flag: "🇧🇷", native: "Português"  },
  { code: "de", label: "German",     flag: "🇩🇪", native: "Deutsch"    },
  { code: "ru", label: "Russian",    flag: "🇷🇺", native: "Русский"    },
  { code: "ja", label: "Japanese",   flag: "🇯🇵", native: "日本語"      },
  { code: "ko", label: "Korean",     flag: "🇰🇷", native: "한국어"      },
];

const STATUS = {
  normal:        { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.2)",  label: "✓ Normal"     },
  borderline:    { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)", label: "⚡ Borderline" },
  abnormal_high: { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)", label: "▲ High"       },
  abnormal_low:  { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)", label: "▼ Low"        },
  critical:      { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.2)",  label: "⚑ Critical"   },
};

// ─────────────────────────────────────────────────────────────
// TRANSLITERATION DETECTOR  (Tenglish / Hinglish)
// ─────────────────────────────────────────────────────────────
const TELUGU_PATTERNS = [
  /\b(nenu|meeru|memu|manam|vadu|aame|vallru|vaallru)\b/i,
  /\b(noppi|noppulu|jwaram|jvaram|tala|pakku|gunde|gudde|meda)\b/i,
  /\b(emi|eemi|ela|elaa|enduku|eppudu|evaru|ekkada|entha|enta)\b/i,
  /\b(cheyyadam|cheyyali|chudandi|cheppandi|vachindi|poindi|ledu|unna|undi|untundi)\b/i,
  /\b(reporu|resu|bladu|testu|daktar|daktera|vaidyudu)\b/i,
  /\b(inka|mariyu|kani|kaani|ayina|ayite|aithe|ante|antey|ani)\b/i,
  /\b(okka|rendu|mudu|naalu|aidu|aru|edu|enimidi|tommidi|padi)\b/i,
  /\w+(andi|undi|unna|avutundi|avutu|aindi|tundi|taru|tadu|leru|adu)\b/i,
];
const HINDI_PATTERNS = [
  /\b(mujhe|mera|meri|mere|humara|hamara|aapka|uska|unka)\b/i,
  /\b(kya|kaise|kyun|kab|kahan|kitna|kitni|kaun)\b/i,
  /\b(hai|hain|tha|thi|the|hoga|hogi|hote|hoti|hona)\b/i,
  /\b(nahi|nahin|mat|bilkul|zaroor|shayad|bahut|bohot)\b/i,
  /\b(dawai|dawa|bimari|bimaari|takleef|dard|bukhar|khoon)\b/i,
  /\b(aur|lekin|magar|phir|toh|ya|agar|jab|tab)\b/i,
  /\b(main|mein|hum|aap|tum|woh|yeh|ye|wo|vo)\b/i,
];

function detectTransliteratedLanguage(text) {
  if (!text || text.trim().length < 3) return null;
  const te = TELUGU_PATTERNS.filter(p => p.test(text)).length;
  const hi = HINDI_PATTERNS.filter(p => p.test(text)).length;
  if (te >= 2 && te >= hi) return "te";
  if (hi >= 2 && hi > te)  return "hi";
  return null;
}

function getTransliterationHint(lang) {
  if (lang === "te") return { msg: "మీరు తెలుగులో అడుగుతున్నారా? / Asking in Telugu?", sub: "I understand Tenglish! I'll answer in English.", flag: "🇮🇳" };
  if (lang === "hi") return { msg: "क्या आप हिंदी में पूछ रहे हैं? / Asking in Hindi?",  sub: "I understand Hinglish! I'll answer in English.", flag: "🇮🇳" };
  return null;
}

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPTS
// ─────────────────────────────────────────────────────────────
const MEDICAL_SYSTEM_PROMPT = `You are MedTranslate — a warm, caring health companion who helps everyday people understand their medical reports. The report may be in ANY language (English, Telugu, Hindi, Tamil, Arabic, etc.).

Translate ALL clinical language into simple, reassuring plain English. You NEVER diagnose, prescribe, or replace a doctor.

Respond with ONLY a single valid JSON object — no markdown fences, no preamble:

{
  "report_type": "string — e.g. Complete Blood Count",
  "report_date": "string or null",
  "summary": "string — 2-3 warm, calm sentences in plain English",
  "findings": [
    {
      "id": "string",
      "name": "string — as written in report",
      "plain_name": "string — everyday name",
      "value": "string — measured value with units",
      "reference_range": "string or null",
      "status": "normal | borderline | abnormal_high | abnormal_low | critical",
      "plain_explanation": "string — 1-2 sentences, plain English, reassuring",
      "context": "string or null — brief helpful tip"
    }
  ],
  "abnormal_summary": "string or null",
  "discharge_summary": {
    "reason_for_visit": "string or null",
    "hospital_course": "string or null — plain English what happened",
    "discharge_medications": [{"name": "string", "instructions": "string", "purpose": "string", "schedule_codes": ["array of exact strings: 'morning', 'afternoon', 'night', 'food', 'water', '1x', '2x', '3x' — omit if none apply"]}],
    "follow_up_appointments": [{"who": "string", "when": "string", "purpose": "string"}],
    "comprehension_questions": ["1-2 simple questions to ask the patient to verify they understood their medications or instructions"]
  },
  "doctor_questions": ["3-5 plain English questions to ask the doctor"],
  "watch_for_symptoms": [{"symptom": "string", "reason": "string"}],
  "lifestyle_notes": ["2-4 simple lifestyle tips"],
  "disclaimer": "This is for educational purposes only — not medical advice. Always talk to your doctor.",
  "confidence": "high | medium | low"
}

Keep everything simple — words a grandparent would understand. Be warm and reassuring.
If not a medical document: {"error":"not_medical","message":"This doesn't look like a medical report. Please upload a lab result, blood test, or health report."}
If text is unclear: {"error":"unclear","message":"We couldn't read this clearly. Please try pasting the text directly instead."}`;

const SAFETY_SYSTEM_PROMPT = `You are the Medical Safety Sentinel.
Your job is to act as a secondary safety validation layer for a medical translation system.
Evaluate the translated JSON output for any internal contradictions or explicitly dangerous language.
CRITICAL CHECKS:
1. Dosage alterations (e.g., 10mg changed to 100mg)
2. Allergy inversions (e.g., 'allergic to penicillin' translated as 'penicillin works')
3. Negation errors (e.g., 'no fever' translated as 'fever')
4. Critical condition mistranslations

Respond with ONLY a single valid JSON object — no markdown fences, no preamble:
{
  "safety_score": 95,
  "is_safe": true,
  "flags": [
    {
      "severity": "critical" | "warning",
      "issue": "Description of the error",
      "recommendation": "Suggested action"
    }
  ]
}
If there are no issues, return an empty flags array. Always assign a safety_score (0-100).`;

const getChatSystemPrompt = (report, lang) => {
  const langInfo = LANGUAGES.find(l => l.code === lang);
  const langName = langInfo ? `${langInfo.label} (${langInfo.native})` : "English";
  return `You are MedTranslate's caring health companion.

THEIR REPORT:
${JSON.stringify(report, null, 2)}

LANGUAGE RULES:
1. User may type Tenglish (Telugu in English letters) — understand and respond in ${langName}.
2. User may type Hinglish (Hindi in English letters) — understand and respond in ${langName}.
3. ALWAYS respond in clear, simple ${langName}.

RULES:
- Warm, friendly, reassuring tone
- Reference their specific results when helpful
- NEVER diagnose or prescribe
- 2-3 short paragraphs max
- Explain any medical term immediately in simple words
- Always suggest consulting their doctor`;
};

// ─────────────────────────────────────────────────────────────
// API & FILE UTILITIES
// ─────────────────────────────────────────────────────────────
async function callGroq(messages, systemPrompt) {
  if (!GROQ_API_KEY || GROQ_API_KEY === "gsk_your_groq_api_key_here") {
    throw new Error("Please open src/App.jsx and set your Groq API key in the GROQ_API_KEY constant at the top of the file. Get a free key at console.groq.com");
  }
  
  const modelToUse = MODEL;

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelToUse,
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq API error ${response.status}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

async function transcribeAudio(audioBlob) {
  if (!GROQ_API_KEY || GROQ_API_KEY === "gsk_your_groq_api_key_here") {
    throw new Error("Please set your Groq API key.");
  }
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("response_format", "json");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq Audio error ${response.status}`);
  }
  const data = await response.json();
  return data.text;
}

async function translateText(text, targetLang) {
  if (targetLang === "en" || !text) return text;
  const langInfo = LANGUAGES.find(l => l.code === targetLang);
  const langName = langInfo ? `${langInfo.label} (${langInfo.native})` : targetLang;
  const resp = await callGroq(
    [{ role: "user", content: `Translate to ${langName}. Use natural script. Keep numbers/values unchanged. Return ONLY translated text:\n\n${text}` }],
    "You are a medical translator. Translate accurately. Return only the translated text."
  );
  return resp.trim();
}

const fileToDataUrl = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload  = () => res(r.result);
  r.onerror = () => rej(new Error("File read failed"));
  r.readAsDataURL(file);
});

async function extractPdfText(file) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF reader not loaded. Please refresh the page and try again.");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += `\n--- Page ${i} ---\n${content.items.map(item => item.str).join(" ")}`;
  }
  return fullText.trim();
}

async function pdfToImageUrl(file) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF reader not loaded.");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1); // Read first page for visual analysis
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.9);
}

// ─────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f8f6f1; color: #1a1a2e; overflow-x: hidden; }
  textarea, input, button, select { font-family: inherit; }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.25); border-radius: 99px; }

  @keyframes fadeUp  { from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn  { from{opacity:0}to{opacity:1} }
  @keyframes slideR  { from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)} }
  @keyframes slideL  { from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes float   { 0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)} }
  @keyframes pulse   { 0%,100%{opacity:1}50%{opacity:0.4} }
  @keyframes shimmer { 0%,100%{opacity:0.4}50%{opacity:0.8} }
  @keyframes scaleIn { from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)} }
  @keyframes popIn   { from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)} }

  .fu0{animation:fadeUp .5s .00s ease both}
  .fu1{animation:fadeUp .5s .08s ease both}
  .fu2{animation:fadeUp .5s .16s ease both}
  .fu3{animation:fadeUp .5s .24s ease both}
  .fu4{animation:fadeUp .5s .32s ease both}
  .fu5{animation:fadeUp .5s .40s ease both}
  .fu6{animation:fadeUp .5s .48s ease both}
  .scale-in{animation:scaleIn .45s ease both}
  .pop-in{animation:popIn .35s ease both}

  .step-card:hover   { transform:translateY(-2px); box-shadow:0 12px 40px rgba(99,102,241,0.12)!important }
  .finding-card:hover{ transform:translateY(-3px) }
  .q-card:hover      { border-color:rgba(99,102,241,0.4)!important; background:rgba(99,102,241,0.04)!important }
  .btn-primary:hover:not(:disabled){ transform:translateY(-1px); box-shadow:0 16px 48px rgba(99,102,241,0.35)!important }
  .btn-primary:active:not(:disabled){ transform:translateY(0) }

  @media(max-width:600px){
    .hide-mobile{ display:none!important }
    .stack-mobile{ flex-direction:column!important }
    .full-mobile{ width:100%!important }
  }
`;

// ─────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]               = useState("home");
  const [inputMode, setInputMode]     = useState("file");
  const [selectedFile, setFile]       = useState(null);
  const [reportText, setReportText]   = useState("");
  const [dragOver, setDragOver]       = useState(false);
  const [analyzing, setAnalyzing]     = useState(false);
  const [analyzingStep, setStep]      = useState("");
  const [reportData, setReport]       = useState(null);
  const [safetyData, setSafety]       = useState(null);
  const [error, setError]             = useState(null);
  const [tab, setTab]                 = useState("findings");
  const [chatMsgs, setChatMsgs]       = useState([]);
  const [chatInput, setChatInput]     = useState("");
  const [chatLoading, setChatLoad]    = useState(false);
  const [chatPdf, setChatPdf]         = useState(null);
  const [detectedLang, setDetectedLang] = useState(null);
  const [lang, setLang]               = useState("en");
  const [translating, setTranslating] = useState(false);
  const [translatedData, setTranslated] = useState(null);
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize]       = useState("normal");
  const [copied, setCopied]           = useState(null);

  const fileRef    = useRef(null);
  const chatEndRef = useRef(null);
  const chatPdfRef = useRef(null);

  // Inject global styles once
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "mt-styles";
    el.textContent = GLOBAL_STYLES;
    document.head.appendChild(el);
    return () => document.getElementById("mt-styles")?.remove();
  }, []);

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  // Welcome message when chat tab opens
  useEffect(() => {
    if (tab === "chat" && chatMsgs.length === 0 && reportData) {
      const d = translatedData || reportData;
      setChatMsgs([{ role: "assistant", content: `Hi there! 👋 I've read your ${d.report_type}. Ask me anything about your results — in English, Tenglish, or Hinglish. I understand all of them! 😊` }]);
    }
  }, [tab, reportData]);

  // Translate when language changes
  useEffect(() => {
    if (!reportData || lang === "en") { setTranslated(null); return; }
    doTranslateReport(reportData, lang);
  }, [lang, reportData]);

  const doTranslateReport = async (data, targetLang) => {
    setTranslating(true);
    try {
      const [summary, abnormal, disclaimer] = await Promise.all([
        translateText(data.summary, targetLang),
        data.abnormal_summary ? translateText(data.abnormal_summary, targetLang) : Promise.resolve(null),
        translateText(data.disclaimer, targetLang),
      ]);
      const findings = await Promise.all(data.findings.map(async f => ({
        ...f,
        plain_explanation: await translateText(f.plain_explanation, targetLang),
        context: f.context ? await translateText(f.context, targetLang) : null,
      })));
      const doctor_questions   = await Promise.all(data.doctor_questions.map(q => translateText(q, targetLang)));
      const lifestyle_notes    = await Promise.all(data.lifestyle_notes.map(n => translateText(n, targetLang)));
      const watch_for_symptoms = await Promise.all(data.watch_for_symptoms.map(async s => ({
        symptom: await translateText(s.symptom, targetLang),
        reason:  await translateText(s.reason,  targetLang),
      })));
      setTranslated({ ...data, summary, abnormal_summary: abnormal, disclaimer, findings, doctor_questions, lifestyle_notes, watch_for_symptoms });
    } catch (e) { console.error("Translation error", e); }
    setTranslating(false);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setInputMode("file"); }
  }, []);

  // ── ANALYZE ──────────────────────────────────────────────────
  const analyze = async (overrideText = null) => {
    const textToUse = typeof overrideText === 'string' ? overrideText : reportText;
    if (!selectedFile && !textToUse.trim()) {
      setError({ title: "Nothing to analyze", msg: "Please upload your report (PDF or image), or paste the report text below." });
      return;
    }
    setError(null); setAnalyzing(true);
    try {
      let messages;

      if (selectedFile) {
        if (selectedFile.type === "application/pdf") {
          setStep("Reading your PDF…");
          let pdfText;
          try { pdfText = await extractPdfText(selectedFile); }
          catch (e) {
            setError({ title: "Could not read PDF", msg: "We couldn't extract text from this PDF. Try copying the text and using 'Paste Text' instead." });
            setAnalyzing(false); setStep(""); return;
          }
          if (!pdfText || pdfText.length < 30) {
            setStep("Detecting handwritten or scanned text…");
            const dataUrl = await pdfToImageUrl(selectedFile);
            messages = [{
              role: "user",
              content: [
                { type: "image_url", image_url: { url: dataUrl } },
                { type: "text", text: "Carefully analyze this scanned or handwritten medical report and return the JSON translation. Pay special attention to handwritten notes." },
              ],
            }];
          } else {
            messages = [{ role: "user", content: `Analyze this medical report (extracted from PDF) and return the JSON translation:\n\n${pdfText}` }];
          }

        } else if (selectedFile.type.startsWith("image/")) {
          setStep("Reading your report image…");
          const dataUrl = await fileToDataUrl(selectedFile);
          messages = [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUrl } },
              { type: "text", text: "Carefully analyze this image containing a medical report (which may be handwritten) and return the JSON translation. Pay special attention to handwritten notes." },
            ],
          }];
        } else {
          setError({ title: "File type not supported", msg: "Please upload a PDF, JPG, PNG, or WEBP file." });
          setAnalyzing(false); setStep(""); return;
        }
      } else {
        messages = [{ role: "user", content: `Analyze this medical report and return the JSON translation. It may be in any language:\n\n${textToUse.trim()}` }];
      }

      setStep("Translating medical terms into plain words…");
      const raw    = await callGroq(messages, MEDICAL_SYSTEM_PROMPT);
      const result = JSON.parse(raw.replace(/```json|```/g, "").trim());

      if (result.error) {
        setError({ title: "Cannot process this file", msg: result.message });
        setAnalyzing(false); setStep(""); return;
      }

      setStep("Running Medical Safety Sentinel validation…");
      const safetyMessages = [
        ...messages,
        { role: "assistant", content: "Translation completed: " + JSON.stringify(result) },
        { role: "user", content: "Please run the Medical Safety Sentinel checks on this translation." }
      ];
      let safetyResult = { safety_score: 100, is_safe: true, flags: [] };
      try {
        const safetyRaw = await callGroq(safetyMessages, SAFETY_SYSTEM_PROMPT);
        safetyResult = JSON.parse(safetyRaw.replace(/```json|```/g, "").trim());
      } catch (err) {
        console.error("Safety Sentinel Error:", err);
      }
      setSafety(safetyResult);

      setReport(result); setChatMsgs([]); setPage("results"); 
      setTab(result.discharge_summary ? "discharge" : "findings");
    } catch (e) {
      if (e.message.includes("JSON")) {
        setError({ title: "Could not read the report", msg: "We had trouble reading this. Please try the 'Paste Text' option instead." });
      } else {
        setError({ title: "Something went wrong", msg: e.message || "Please try again in a moment." });
      }
    }
    setAnalyzing(false); setStep("");
  };

  // ── CHAT SEND ─────────────────────────────────────────────────
  const sendChat = async () => {
    if ((!chatInput.trim() && !chatPdf) || chatLoading) return;

    let userContent    = chatInput.trim();
    let displayContent = chatInput.trim();

    if (chatPdf) {
      try {
        const extracted  = await extractPdfText(chatPdf);
        const pdfContext = `\n\n[User attached PDF: "${chatPdf.name}"]\n${extracted}`;
        displayContent   = displayContent ? `📎 ${chatPdf.name}\n\n${displayContent}` : `📎 ${chatPdf.name} — Please help me understand this.`;
        userContent      = userContent    ? `${userContent}${pdfContext}` : `Please help me understand this PDF.${pdfContext}`;
      } catch { displayContent = `📎 ${chatPdf.name} (could not read)\n\n${displayContent}`; }
      setChatPdf(null);
    }

    const detected = detectTransliteratedLanguage(chatInput.trim());
    const history  = [...chatMsgs, { role: "user", content: displayContent }];
    setChatMsgs(history); setChatInput(""); setDetected(null); setChatLoad(true);

    try {
      const apiMessages = history.map((m, i) => ({
        role: m.role,
        content: i === history.length - 1 ? userContent : m.content,
      }));
      let sysPrompt = getChatSystemPrompt(reportData, lang);
      if (detected === "te") sysPrompt += "\n\nNOTE: User typed Tenglish (Telugu in English letters). Understand and respond in simple English.";
      if (detected === "hi") sysPrompt += "\n\nNOTE: User typed Hinglish (Hindi in English letters). Understand and respond in simple English.";

      const reply      = await callGroq(apiMessages, sysPrompt);
      const finalReply = lang !== "en" ? await translateText(reply, lang) : reply;
      setChatMsgs(p => [...p, { role: "assistant", content: finalReply }]);
    } catch {
      setChatMsgs(p => [...p, { role: "assistant", content: "Sorry, something went wrong. Please try again! 😊" }]);
    }
    setChatLoad(false);
  };

  const reset = () => {
    setPage("home"); setReport(null); setTranslated(null); setSafety(null);
    setFile(null); setReportText(""); setError(null);
    setChatMsgs([]); setChatInput(""); setTab("findings");
  };

  // ── SMART ON FHIR (EPIC) INTEGRATION ─────────────────────────
  const handleEpicLogin = async () => {
    setAnalyzing(true);
    setStep("Connecting to SMART on FHIR Sandbox...");
    try {
      const client = FHIR.client("https://launch.smarthealthit.org/v/r4/fhir");
      
      setStep("Querying Patient ID: 87a339d0-8cae-418e-89c7-8651e6aab3c6...");
      const patient = await client.request("Patient/87a339d0-8cae-418e-89c7-8651e6aab3c6");
      
      setStep("Querying DocumentReference & Medications...");
      const ehrText = `
EHR Import for: ${patient.name?.[0]?.given?.join(" ")} ${patient.name?.[0]?.family}
Gender: ${patient.gender} | BirthDate: ${patient.birthDate}

Discharge Summary:
Reason for Visit: Viral illness and dehydration.
Hospital Course: Patient received IV fluids and rested. Recovered well.
Discharge Medications:
1. Ibuprofen 400mg - Take 1 tablet twice a day with food.
2. Ondansetron 4mg - Take 1 tablet every 8 hours as needed for nausea.
Follow-up Appointments:
- General Practice in 2 weeks.
      `;
      
      setFile(null); // Clear any uploaded file so we process as text
      setReportText(ehrText);
      analyze(ehrText);
    } catch (e) {
      setError({ title: "FHIR Connection Error", msg: e.message });
      setAnalyzing(false);
    }
  };

  const copyText = async (text, id) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id); setTimeout(() => setCopied(null), 2200);
  };

  const fontSizeMap = { normal: "16px", large: "18px", xl: "21px" };
  const display     = translatedData || reportData;
  const hc          = highContrast;

  return (
    <div style={{ minHeight: "100vh", background: hc ? "#000" : "#f8f6f1", fontSize: fontSizeMap[fontSize], transition: "background 0.3s", position: "relative" }}>
      {!hc && (
        <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-20%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)" }} />
          <div style={{ position: "absolute", bottom: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(16,185,129,0.05) 0%,transparent 70%)" }} />
        </div>
      )}

      <Nav lang={lang} setLang={setLang} highContrast={hc} setHighContrast={setHighContrast} fontSize={fontSize} setFontSize={setFontSize} showReset={page === "results"} onReset={reset} translating={translating} />

      <main style={{ position: "relative", zIndex: 1 }}>
        {page === "home" && <HomePage selectedFile={selectedFile} setFile={setFile} reportText={reportText} setReportText={setReportText} inputMode={inputMode} setInputMode={setInputMode} dragOver={dragOver} setDragOver={setDragOver} analyzing={analyzing} analyzingStep={analyzingStep} error={error} setError={setError} fileRef={fileRef} handleDrop={handleDrop} analyze={analyze} highContrast={hc} onStartVoice={() => setPage("voice")} onEpicLogin={handleEpicLogin} onOfflineMode={() => setPage("offline")} />}
        {page === "results" && <ResultsPage r={display} safetyData={safetyData} tab={tab} setTab={setTab} chatMsgs={chatMsgs} chatInput={chatInput} setChatInput={setChatInput} chatLoading={chatLoading} sendChat={sendChat} chatEndRef={chatEndRef} chatPdf={chatPdf} setChatPdf={setChatPdf} chatPdfRef={chatPdfRef} detectedLang={detectedLang} setDetectedLang={setDetectedLang} copied={copied} copyText={copyText} highContrast={hc} translating={translating} />}
        {page === "voice" && <VoicePage lang={lang} highContrast={hc} onExit={() => setPage("home")} />}
        {page === "offline" && <OfflinePage lang={lang} highContrast={hc} onExit={() => setPage("home")} />}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NAV
// ─────────────────────────────────────────────────────────────
function Nav({ lang, setLang, highContrast, setHighContrast, fontSize, setFontSize, showReset, onReset, translating }) {
  const hc = highContrast;
  return (
    <header style={{ padding: "12px 16px", position: "sticky", top: 0, zIndex: 200 }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 18px", background: hc ? "#000" : "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", border: `1px solid ${hc ? "#fff" : "rgba(99,102,241,0.12)"}`, borderRadius: 60, boxShadow: hc ? "none" : "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}>🩺</div>
          <span style={{ fontFamily: "Lora,serif", fontSize: "1.2rem", color: hc ? "#fff" : "#1a1a2e", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>Med<em style={{ color: "#6366f1", fontStyle: "italic" }}>Translate</em></span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {translating && <span style={{ fontSize: 11, color: "#6366f1", display: "flex", alignItems: "center", gap: 5 }}><Spinner size={12} color="#6366f1" /> Translating…</span>}

          <div style={{ position: "relative" }}>
            <select value={lang} onChange={e => setLang(e.target.value)} aria-label="Select your language"
              style={{ background: hc ? "#000" : "rgba(99,102,241,0.07)", border: `1px solid ${hc ? "#fff" : "rgba(99,102,241,0.2)"}`, borderRadius: 10, padding: "7px 28px 7px 10px", color: hc ? "#fff" : "#6366f1", fontSize: 12, fontWeight: 600, cursor: "pointer", appearance: "none", WebkitAppearance: "none", maxWidth: 160 }}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.native}</option>)}
            </select>
            <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 10, color: "#6366f1" }}>▼</span>
          </div>

          <button onClick={() => setHighContrast(v => !v)} title="Toggle high contrast" aria-label="Toggle high contrast"
            style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${hc ? "#fff" : "rgba(99,102,241,0.2)"}`, background: hc ? "#fff" : "rgba(99,102,241,0.07)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {hc ? "🌑" : "🌓"}
          </button>
          <button onClick={() => setFontSize(f => f === "normal" ? "large" : f === "large" ? "xl" : "normal")} title="Change text size" aria-label="Change text size"
            style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${hc ? "#fff" : "rgba(99,102,241,0.2)"}`, background: "rgba(99,102,241,0.07)", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1" }}>
            {fontSize === "normal" ? "A" : fontSize === "large" ? "A+" : "A++"}
          </button>

          {showReset && (
            <button onClick={onReset}
              style={{ padding: "7px 14px", background: "rgba(99,102,241,0.09)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, color: "#6366f1", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
              onMouseOver={e => e.currentTarget.style.background = "rgba(99,102,241,0.16)"}
              onMouseOut={e  => e.currentTarget.style.background = "rgba(99,102,241,0.09)"}>
              ← New Report
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────────
function HomePage({ selectedFile, setFile, reportText, setReportText, inputMode, setInputMode, dragOver, setDragOver, analyzing, analyzingStep, error, setError, fileRef, handleDrop, analyze, highContrast, onStartVoice, onEpicLogin, onOfflineMode }) {
  const hc = highContrast;
  const steps = [
    { num:1, icon:"📤", title:"Upload or paste your report",  desc:"PDF, photo, or copy-paste text — all work" },
    { num:2, icon:"🔍", title:"We analyze it for you",        desc:"AI reads every number and medical term"   },
    { num:3, icon:"💡", title:"Get simple explanations",      desc:"Plain words you can actually understand"  },
  ];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 16px 80px" }}>

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div className="fu0" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 30, padding: "5px 14px", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#6366f1", marginBottom: 20, fontWeight: 700 }}>
          ✨ Free · No sign-up · Instant
        </div>
        <h1 className="fu1" style={{ fontFamily: "Lora,serif", fontSize: "clamp(2rem,6vw,3.4rem)", fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.02em", marginBottom: 16, color: hc ? "#fff" : "#1a1a2e" }}>
          Understand your<br /><em style={{ color: "#6366f1", fontStyle: "italic" }}>medical report</em><br />in plain words
        </h1>
        <p className="fu2" style={{ color: hc ? "#ccc" : "#64748b", fontSize: "1.05rem", maxWidth: 420, margin: "0 auto", lineHeight: 1.8 }}>
          Upload your lab results and we'll explain every number in simple, clear language — like a caring friend who knows medicine.
        </p>

        {/* Format pills */}
        <div className="fu3" style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
          {[{icon:"📑",label:"PDF",h:true},{icon:"🖼️",label:"JPG",h:false},{icon:"🖼️",label:"PNG",h:false},{icon:"📸",label:"WEBP",h:false}].map(f => (
            <span key={f.label} style={{ padding: "5px 13px", border: `1.5px solid ${f.h ? "#6366f1" : "rgba(99,102,241,0.15)"}`, borderRadius: 20, fontSize: 12, fontWeight: f.h ? 700 : 500, color: f.h ? "#6366f1" : "#94a3b8", background: f.h ? "rgba(99,102,241,0.08)" : "transparent", display: "flex", alignItems: "center", gap: 5 }}>
              {f.icon} {f.label}
              {f.h && <span style={{ fontSize: 10, background: "#6366f1", color: "#fff", borderRadius: 6, padding: "1px 5px", marginLeft: 2 }}>Supported</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="fu3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 32 }}>
        {steps.map(s => (
          <div key={s.num} className="step-card" style={{ background: hc ? "#111" : "#fff", border: `1px solid ${hc ? "#444" : "rgba(99,102,241,0.1)"}`, borderRadius: 16, padding: "18px 14px", textAlign: "center", transition: "all 0.25s", boxShadow: hc ? "none" : "0 2px 12px rgba(0,0,0,0.04)", cursor: "default" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
            <div style={{ width: 22, height: 22, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", margin: "0 auto 8px" }}>{s.num}</div>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 5, color: hc ? "#fff" : "#1a1a2e" }}>{s.title}</div>
            <div style={{ fontSize: 11, color: hc ? "#999" : "#94a3b8", lineHeight: 1.55 }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Input toggle */}
      <div className="fu4" style={{ display: "flex", background: hc ? "#111" : "#fff", border: `1px solid ${hc ? "#444" : "rgba(99,102,241,0.12)"}`, borderRadius: 16, padding: 5, marginBottom: 14, gap: 4 }}>
        {[{id:"file",icon:"📎",label:"Upload Report (PDF or Image)"},{id:"text",icon:"📝",label:"Paste Report Text"}].map(m => (
          <button key={m.id} onClick={() => setInputMode(m.id)} style={{ flex: 1, padding: "12px 8px", borderRadius: 12, border: "none", background: inputMode === m.id ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent", color: inputMode === m.id ? "#fff" : (hc ? "#999" : "#94a3b8"), fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: inputMode === m.id ? "0 4px 16px rgba(99,102,241,0.3)" : "none" }}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="fu5">
        {inputMode === "file"
          ? <DropZone selectedFile={selectedFile} setFile={setFile} dragOver={dragOver} setDragOver={setDragOver} fileRef={fileRef} handleDrop={handleDrop} highContrast={hc} />
          : (
            <div>
              <textarea value={reportText} onChange={e => setReportText(e.target.value)}
                placeholder={"Paste your medical report text here…\n\nWorks with any language — Telugu, Hindi, English, Arabic…\n\nExample:\nBlood Test Results\nWBC: 11.8 K/uL  (Ref: 4.5–11.0)\nGlucose: 98 mg/dL  (Ref: 70–100)"}
                aria-label="Paste your medical report text"
                style={{ width: "100%", height: 240, background: hc ? "#000" : "#fff", border: `1.5px solid ${hc ? "#888" : "rgba(99,102,241,0.18)"}`, borderRadius: 18, padding: "18px 20px", color: hc ? "#fff" : "#1a1a2e", fontSize: "0.9rem", lineHeight: 1.8, resize: "vertical", transition: "border-color 0.25s" }}
                onFocus={e => e.target.style.borderColor = "rgba(99,102,241,0.5)"}
                onBlur={e  => e.target.style.borderColor = hc ? "#888" : "rgba(99,102,241,0.18)"} />
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 7, textAlign: "center" }}>
                💡 Works with any language — Telugu · Hindi · English · Arabic · and more
              </p>
            </div>
          )
        }
      </div>

      {/* Error */}
      {error && (
        <div className="pop-in" style={{ background: "rgba(239,68,68,0.07)", border: "1.5px solid rgba(239,68,68,0.25)", borderRadius: 14, padding: "14px 18px", marginTop: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "#dc2626", marginBottom: 3 }}>{error.title}</div>
            <div style={{ color: "#b91c1c", fontSize: 13, lineHeight: 1.6 }}>{error.msg}</div>
          </div>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 0 }} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Analyze button */}
      <div className="fu6" style={{ marginTop: 18 }}>
        <button onClick={analyze} disabled={analyzing} className="btn-primary"
          style={{ width: "100%", padding: "18px 32px", background: analyzing ? "rgba(99,102,241,0.15)" : "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)", border: analyzing ? "2px solid rgba(99,102,241,0.3)" : "none", borderRadius: 18, color: analyzing ? "#6366f1" : "#fff", fontSize: "1.05rem", fontWeight: 700, cursor: analyzing ? "wait" : "pointer", transition: "all 0.25s", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, boxShadow: analyzing ? "none" : "0 8px 32px rgba(99,102,241,0.28)" }}>
          {analyzing ? <><Spinner size={20} color="#6366f1" /> {analyzingStep || "Reading your report…"}</> : <>🔍 Explain My Report in Simple Words</>}
        </button>
      </div>

      {analyzing && <div className="pop-in" style={{ marginTop: 16, textAlign: "center" }}><AnalyzingAnimation step={analyzingStep} /></div>}

      <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 11.5, marginTop: 16, lineHeight: 1.9 }}>
        🔒 Processed securely · Your data is never stored · Not a substitute for medical advice<br />
        <span style={{ color: "#6366f1", fontWeight: 600 }}>📑 PDF · 🖼️ Image · 📝 Pasted text — all accepted</span>
      </p>

      <div className="fu6" style={{ marginTop: 24, textAlign: "center", display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
        <div style={{ background: hc ? "#111" : "rgba(34,197,94,0.06)", border: `1px solid ${hc ? "#444" : "rgba(34,197,94,0.2)"}`, borderRadius: 16, padding: "20px", flex: "1 1 300px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: hc ? "#fff" : "#16a34a", marginBottom: 6 }}>Talking to your doctor right now?</div>
          <button onClick={onStartVoice} style={{ background: "#22c55e", color: "#fff", border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(34,197,94,0.3)", transition: "transform 0.2s" }} onMouseOver={e=>e.currentTarget.style.transform="scale(1.02)"} onMouseOut={e=>e.currentTarget.style.transform="scale(1)"}>
            🎙️ Start Live Voice Translation
          </button>
        </div>

        <div style={{ background: hc ? "#111" : "rgba(239,68,68,0.06)", border: `1px solid ${hc ? "#444" : "rgba(239,68,68,0.2)"}`, borderRadius: 16, padding: "20px", flex: "1 1 300px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: hc ? "#fff" : "#dc2626", marginBottom: 6 }}>No internet connection?</div>
          <button onClick={onOfflineMode} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(239,68,68,0.3)", transition: "transform 0.2s" }} onMouseOver={e=>e.currentTarget.style.transform="scale(1.02)"} onMouseOut={e=>e.currentTarget.style.transform="scale(1)"}>
            🚨 Offline Emergency Mode
          </button>
        </div>
      </div>

      <div style={{ marginTop: 28, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>Works with any of these reports</div>
        <div style={{ display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap" }}>
          {["🩸 Blood Tests","💊 Metabolic Panel","❤️ Lipid Panel","🫁 Thyroid","🔬 Urinalysis","🧪 CBC","➕ More…"].map(tag => (
            <span key={tag} style={{ padding: "5px 13px", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 20, fontSize: 11.5, color: "#94a3b8", background: "rgba(99,102,241,0.03)", fontWeight: 500 }}>{tag}</span>
          ))}
        </div>
        <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "8px 16px" }}>
          <span>✅</span>
          <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>Upload as PDF or photo · Works in Telugu, Hindi &amp; English</span>
        </div>
      </div>

      <div style={{ marginTop: 40, borderTop: `1px solid ${hc ? "#333" : "rgba(99,102,241,0.15)"}`, paddingTop: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🏥</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: hc ? "#fff" : "#1a1a2e" }}>Enterprise EHR Integration</div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>SMART on FHIR / Epic Connection Hub</div>
            </div>
          </div>
          <span style={{ fontSize: 10, background: "rgba(99,102,241,0.1)", color: "#6366f1", padding: "4px 8px", borderRadius: 6, fontWeight: 700, textTransform: "uppercase" }}>Prototype</span>
        </div>
        <button onClick={onEpicLogin} disabled={analyzing} style={{ width: "100%", background: hc ? "#111" : "#fff", border: `1.5px solid ${hc ? "#444" : "#e2e8f0"}`, borderRadius: 14, padding: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, cursor: analyzing ? "wait" : "pointer", transition: "all 0.2s" }} onMouseOver={e=>e.currentTarget.style.borderColor="#6366f1"} onMouseOut={e=>e.currentTarget.style.borderColor=(hc ? "#444" : "#e2e8f0")}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Epic_Systems_logo.svg/200px-Epic_Systems_logo.svg.png" alt="Epic Logo" style={{ height: 24, filter: hc ? "brightness(0) invert(1)" : "none" }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: hc ? "#fff" : "#1a1a2e" }}>Connect to Epic EHR (Sandbox)</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ANALYZING ANIMATION
// ─────────────────────────────────────────────────────────────
function AnalyzingAnimation({ step }) {
  const steps = ["Reading your report…","Understanding medical terms…","Translating into plain words…","Almost ready!"];
  const [auto, setAuto] = useState(0);
  useEffect(() => { const t = setInterval(() => setAuto(s => (s+1)%steps.length), 1800); return () => clearInterval(t); }, []);
  return (
    <div style={{ padding: "14px 20px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 14, display: "inline-flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", gap: 5 }}>{[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", animation: `float 1.2s ${i*0.2}s ease-in-out infinite` }} />)}</div>
      <span style={{ fontSize: 13, color: "#6366f1", fontWeight: 500 }}>{step || steps[auto]}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DROP ZONE
// ─────────────────────────────────────────────────────────────
function DropZone({ selectedFile, setFile, dragOver, setDragOver, fileRef, handleDrop, highContrast }) {
  const hc    = highContrast;
  const isPdf = selectedFile?.type === "application/pdf";
  return (
    <div role="button" tabIndex={0} aria-label="Click to upload your medical report — PDF or image"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => fileRef.current?.click()}
      onKeyDown={e => e.key === "Enter" && fileRef.current?.click()}
      style={{ background: dragOver ? "rgba(99,102,241,0.07)" : (hc ? "#111" : "#fff"), border: `2px dashed ${dragOver ? "#6366f1" : (hc ? "#555" : "rgba(99,102,241,0.22)")}`, borderRadius: 20, padding: "48px 24px", textAlign: "center", cursor: "pointer", transition: "all 0.25s", position: "relative", overflow: "hidden" }}>

      {selectedFile ? (
        <div>
          <div style={{ fontSize: 52, marginBottom: 14 }}>{isPdf ? "📑" : "🖼️"}</div>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 15, color: hc ? "#fff" : "#1a1a2e" }}>{selectedFile.name}</div>
          <div style={{ color: "#94a3b8", fontSize: 12.5, marginBottom: 6 }}>{(selectedFile.size/1024).toFixed(1)} KB · {isPdf ? "PDF Document" : "Image"}</div>
          {isPdf && <div style={{ fontSize: 12, color: "#6366f1", marginBottom: 14, background: "rgba(99,102,241,0.08)", borderRadius: 8, padding: "5px 12px", display: "inline-block" }}>📄 Text will be extracted automatically</div>}
          <br />
          <button onClick={e => { e.stopPropagation(); setFile(null); }} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "7px 18px", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>Remove ×</button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 56, marginBottom: 12, display: "inline-block", animation: "float 3.5s ease-in-out infinite" }}>📋</div>

          {/* PDF callout badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(99,102,241,0.1)", border: "1.5px solid rgba(99,102,241,0.3)", borderRadius: 12, padding: "7px 16px", marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>📑</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6366f1" }}>PDF files supported!</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Upload your PDF report directly</div>
            </div>
          </div>

          <div style={{ fontFamily: "Lora,serif", fontSize: "1.25rem", fontWeight: 600, marginBottom: 6, color: hc ? "#fff" : "#1a1a2e" }}>Drop your report here</div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 4 }}>or <strong style={{ color: "#6366f1", fontWeight: 600 }}>click to choose a file</strong></div>
          <div style={{ color: "#b8bcc5", fontSize: 12, marginBottom: 16, lineHeight: 1.75 }}>
            📑 PDF lab reports · 🖼️ Photos of paper reports · 📸 Scanned documents<br />
            <span style={{ color: "#6366f1", fontWeight: 600 }}>Any language:</span> Telugu · Hindi · English · Arabic · and more
          </div>
          <div style={{ display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap" }}>
            {[{l:"PDF",h:true},{l:"JPG",h:false},{l:"PNG",h:false},{l:"JPEG",h:false},{l:"WEBP",h:false}].map(f => (
              <span key={f.l} style={{ padding: "4px 11px", border: `1.5px solid ${f.h ? "#6366f1" : "rgba(99,102,241,0.15)"}`, borderRadius: 20, fontSize: 11, color: f.h ? "#6366f1" : "#94a3b8", letterSpacing: 0.8, fontWeight: 700, background: f.h ? "rgba(99,102,241,0.1)" : "transparent" }}>{f.h ? "📑 " : ""}{f.l}</span>
            ))}
          </div>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={e => { const f = e.target.files[0]; if (f) setFile(f); }} style={{ display: "none" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RESULTS PAGE
// ─────────────────────────────────────────────────────────────
function ResultsPage({ r, safetyData, tab, setTab, chatMsgs, chatInput, setChatInput, chatLoading, sendChat, chatEndRef, chatPdf, setChatPdf, chatPdfRef, detectedLang, setDetectedLang, copied, copyText, highContrast, translating }) {
  const hc      = highContrast;
  const confPct = { high:96, medium:64, low:32 }[r.confidence] || 65;
  const tabs    = [
    ...(r.discharge_summary ? [{ id:"discharge", icon:"🏥", label:"Discharge Summary", count:null }] : []),
    ...((r.findings||[]).length > 0 || !r.discharge_summary ? [{ id:"findings",  icon:"🔬", label:"My Results", count:(r.findings||[]).length }] : []),
    { id:"questions", icon:"💬", label:"Ask Doctor",   count:null },
    { id:"symptoms",  icon:"👀", label:"Watch For",    count:null },
    { id:"chat",      icon:"🤖", label:"Chat with AI", count:null },
  ];

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 16px 80px" }}>
      <div className="scale-in" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: 2.5, textTransform: "uppercase", color: "#6366f1", marginBottom: 8, fontWeight: 700 }}>✅ Analysis Complete</div>
            <h2 style={{ fontFamily: "Lora,serif", fontSize: "clamp(1.5rem,4vw,2rem)", fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 5, color: hc ? "#fff" : "#1a1a2e" }}>{r.report_type}</h2>
            {r.report_date && <div style={{ color: "#94a3b8", fontSize: 13 }}>📅 {r.report_date}</div>}
          </div>
          <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
            <div style={{ background: hc ? "#111" : "#fff", border: `1px solid ${hc ? "#444" : "rgba(99,102,241,0.12)"}`, borderRadius: 16, padding: "14px 18px", minWidth: 200 }}>
              <div style={{ fontSize: 10.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, fontWeight: 600 }}>Translation Confidence</div>
              <div style={{ height: 6, background: "rgba(99,102,241,0.1)", borderRadius: 99, marginBottom: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: confPct+"%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 99, transition: "width 1.2s ease 0.4s" }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: r.confidence==="high" ? "#22c55e" : r.confidence==="medium" ? "#f59e0b" : "#ef4444" }}>
                {r.confidence==="high" ? "High — very reliable" : "Medium — verify with doctor"}
              </div>
            </div>

            {safetyData && (
              <div style={{ background: safetyData.is_safe ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${safetyData.is_safe ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 16, padding: "14px 18px", minWidth: 200 }}>
                <div style={{ fontSize: 10.5, color: safetyData.is_safe ? "#16a34a" : "#dc2626", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, fontWeight: 700 }}>Medical Safety Sentinel</div>
                <div style={{ height: 6, background: safetyData.is_safe ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)", borderRadius: 99, marginBottom: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: (safetyData.safety_score||100)+"%", background: safetyData.is_safe ? "#22c55e" : "#ef4444", borderRadius: 99, transition: "width 1.2s ease 0.4s" }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: safetyData.is_safe ? "#16a34a" : "#dc2626" }}>
                  {safetyData.is_safe ? `Score: ${safetyData.safety_score} - Clinically Safe` : `Score: ${safetyData.safety_score} - Safety Warning!`}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ background: hc ? "#111" : "linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.04))", border: `1px solid ${hc ? "#444" : "rgba(99,102,241,0.15)"}`, borderRadius: 18, padding: "20px 24px", lineHeight: 1.85, color: hc ? "#ddd" : "#475569", marginBottom: 14 }}>
          <div style={{ fontFamily: "Lora,serif", fontSize: 13, color: "#6366f1", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>📋 Summary in Plain Words</div>
          {translating ? <SkeletonLine /> : r.summary}
        </div>

        {r.abnormal_summary && (
          <div style={{ background: "rgba(245,158,11,0.06)", border: "1.5px solid rgba(245,158,11,0.25)", borderRadius: 14, padding: "14px 20px", display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#d97706", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Something to note</div>
              <div style={{ color: hc ? "#eee" : "#78716c", fontSize: 13.5, lineHeight: 1.75 }}>{translating ? <SkeletonLine /> : r.abnormal_summary}</div>
            </div>
          </div>
        )}

        {safetyData && safetyData.flags && safetyData.flags.length > 0 && (
          <div className="pop-in" style={{ background: "rgba(239,68,68,0.07)", border: "1.5px solid rgba(239,68,68,0.4)", borderRadius: 14, padding: "16px 20px", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#dc2626", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🚨</span> Clinical Safety Alerts Detected
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {safetyData.flags.map((flag, i) => (
                <div key={i} style={{ background: hc ? "#1a1a1a" : "#fff", borderRadius: 10, padding: "12px 16px", borderLeft: `4px solid ${flag.severity === "critical" ? "#ef4444" : "#f59e0b"}` }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: hc ? "#fff" : "#1a1a2e", marginBottom: 4 }}>
                    <span style={{ textTransform: "uppercase", fontSize: 10, background: flag.severity === "critical" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", color: flag.severity === "critical" ? "#dc2626" : "#d97706", padding: "2px 6px", borderRadius: 4, marginRight: 8 }}>
                      {flag.severity}
                    </span>
                    {flag.issue}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{flag.recommendation}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: hc ? "#111" : "#fff", border: `1px solid ${hc ? "#444" : "rgba(99,102,241,0.1)"}`, borderRadius: 16, padding: 5, marginBottom: 24, gap: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:"11px 6px", borderRadius:12, border:"none", background:tab===t.id?"linear-gradient(135deg,#6366f1,#8b5cf6)":"transparent", color:tab===t.id?"#fff":(hc?"#888":"#94a3b8"), fontSize:"clamp(10px,2vw,12.5px)", fontWeight:600, cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", justifyContent:"center", gap:5, boxShadow:tab===t.id?"0 4px 16px rgba(99,102,241,0.3)":"none" }}>
            <span>{t.icon}</span>
            <span className="hide-mobile">{t.label}</span>
            {t.count!==null && <span style={{ background:tab===t.id?"rgba(255,255,255,0.2)":"rgba(99,102,241,0.1)", borderRadius:99, padding:"1px 7px", fontSize:10 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab==="discharge" && <DischargePanel ds={r.discharge_summary} translating={translating} highContrast={hc} />}
      {tab==="findings"  && <FindingsPanel  findings={r.findings||[]} translating={translating} highContrast={hc} />}
      {tab==="questions" && <QuestionsPanel questions={r.doctor_questions||[]} copied={copied} copyText={copyText} translating={translating} highContrast={hc} />}
      {tab==="symptoms"  && <SymptomsPanel  symptoms={r.watch_for_symptoms||[]} lifestyle={r.lifestyle_notes||[]} translating={translating} highContrast={hc} />}
      {tab==="chat"      && <ChatPanel msgs={chatMsgs} input={chatInput} setInput={setChatInput} loading={chatLoading} onSend={sendChat} chatEndRef={chatEndRef} highContrast={hc} chatPdf={chatPdf} setChatPdf={setChatPdf} chatPdfRef={chatPdfRef} detectedLang={detectedLang} setDetectedLang={setDetectedLang} />}

      <div style={{ marginTop: 48, padding: "14px 20px", borderRadius: 14, background: hc ? "#111" : "rgba(99,102,241,0.04)", border: `1px solid ${hc ? "#333" : "rgba(99,102,241,0.08)"}`, color: "#94a3b8", fontSize: 12, textAlign: "center", lineHeight: 1.7 }}>
        🔒 {r.disclaimer}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
function SkeletonLine() {
  return <div style={{ height:16, background:"linear-gradient(90deg,rgba(99,102,241,0.1) 25%,rgba(99,102,241,0.2) 50%,rgba(99,102,241,0.1) 75%)", backgroundSize:"200% 100%", borderRadius:8, animation:"shimmer 1.5s infinite", marginTop:4, width:"80%" }} />;
}

// ─────────────────────────────────────────────────────────────
// FINDINGS PANEL
// ─────────────────────────────────────────────────────────────
function FindingsPanel({ findings, translating, highContrast }) {
  const hc = highContrast;
  if (!findings.length) return <EmptyState icon="🔬" msg="No individual findings were found in this report." />;
  const abnormalCount = findings.filter(f => f.status !== "normal").length;
  return (
    <div>
      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <StatChip icon="✅" label="Normal"          count={findings.filter(f=>f.status==="normal").length}                         color="#22c55e" hc={hc} />
        <StatChip icon="⚡" label="Borderline"      count={findings.filter(f=>f.status==="borderline").length}                     color="#f59e0b" hc={hc} />
        <StatChip icon="⚑" label="Needs Attention" count={findings.filter(f=>f.status!=="normal"&&f.status!=="borderline").length} color="#ef4444" hc={hc} />
      </div>
      {abnormalCount > 0 && (
        <div className="fu0" style={{ background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.18)", borderRadius:14, padding:"12px 18px", marginBottom:20, fontSize:13.5, color:hc?"#eee":"#78716c", lineHeight:1.7 }}>
          💡 <strong style={{ color:"#dc2626" }}>{abnormalCount} result{abnormalCount>1?"s":""}</strong> need{abnormalCount===1?"s":""} your attention — highlighted below. Don't panic — your doctor will guide you.
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:14 }}>
        {findings.map((f, i) => {
          const st = STATUS[f.status] || STATUS.normal;
          return (
            <div key={f.id||i} className="finding-card fu0"
              style={{ background:hc?"#111":"#fff", border:`1.5px solid ${st.border}`, borderRadius:18, padding:"20px", animationDelay:`${i*0.055}s`, transition:"transform 0.2s,box-shadow 0.2s", boxShadow:hc?"none":`0 4px 20px ${st.color}12` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:hc?"#fff":"#1a1a2e", marginBottom:3 }}>{f.plain_name||f.name}</div>
                  <div style={{ color:"#94a3b8", fontSize:11.5 }}>{f.name}</div>
                </div>
                <span style={{ background:st.bg, color:st.color, fontSize:10.5, padding:"4px 11px", borderRadius:20, fontWeight:700, flexShrink:0, marginLeft:8, whiteSpace:"nowrap" }}>{st.label}</span>
              </div>
              <div style={{ fontFamily:"Lora,serif", fontSize:"1.75rem", fontWeight:600, color:st.color, marginBottom:3, lineHeight:1 }}>{f.value}</div>
              {f.reference_range && (
                <div style={{ fontSize:11.5, color:"#94a3b8", marginBottom:12, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ background:"rgba(34,197,94,0.1)", color:"#22c55e", padding:"1px 7px", borderRadius:10, fontSize:10, fontWeight:700 }}>✓ Normal range</span>
                  {f.reference_range}
                </div>
              )}
              <div style={{ fontSize:13, color:hc?"#ccc":"#64748b", lineHeight:1.75 }}>{translating ? <SkeletonLine /> : f.plain_explanation}</div>
              {f.context && !translating && <div style={{ marginTop:12, padding:"8px 12px", background:hc?"#1a1a1a":"rgba(99,102,241,0.05)", borderRadius:10, fontSize:12, color:hc?"#aaa":"#64748b", lineHeight:1.65 }}>💡 {f.context}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatChip({ icon, label, count, color, hc }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7, background:hc?"#111":"#fff", border:`1px solid ${hc?"#333":"rgba(0,0,0,0.06)"}`, borderRadius:12, padding:"8px 14px" }}>
      <span style={{ fontSize:14 }}>{icon}</span>
      <span style={{ fontSize:12, color:hc?"#aaa":"#64748b", fontWeight:500 }}>{label}</span>
      <span style={{ background:`${color}18`, color, borderRadius:20, padding:"1px 9px", fontSize:12, fontWeight:700 }}>{count}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QUESTIONS PANEL
// ─────────────────────────────────────────────────────────────
function QuestionsPanel({ questions, copied, copyText, translating, highContrast }) {
  const hc = highContrast;
  if (!questions.length) return <EmptyState icon="💬" msg="No questions generated for this report." />;
  return (
    <div>
      <div style={{ background:hc?"#111":"rgba(99,102,241,0.05)", border:`1px solid ${hc?"#444":"rgba(99,102,241,0.15)"}`, borderRadius:16, padding:"16px 20px", marginBottom:20, display:"flex", gap:12, alignItems:"flex-start" }}>
        <span style={{ fontSize:24, flexShrink:0 }}>👨‍⚕️</span>
        <div>
          <div style={{ fontWeight:700, fontSize:14, color:"#6366f1", marginBottom:4 }}>Questions to ask your doctor</div>
          <div style={{ fontSize:13, color:hc?"#aaa":"#64748b", lineHeight:1.7 }}>Tap any question to copy it — bring these to your next visit!</div>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
        {questions.map((q, i) => (
          <div key={i} className="q-card fu0" onClick={() => copyText(q,`q${i}`)} role="button" tabIndex={0} onKeyDown={e => e.key==="Enter"&&copyText(q,`q${i}`)}
            style={{ background:hc?"#111":"#fff", border:`1.5px solid ${hc?"#444":"rgba(99,102,241,0.13)"}`, borderRadius:16, padding:"16px 18px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", transition:"all 0.2s", animationDelay:`${i*0.07}s` }}>
            <div style={{ width:32, height:32, background:"linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1))", border:"1px solid rgba(99,102,241,0.2)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#6366f1", flexShrink:0 }}>{i+1}</div>
            <span style={{ flex:1, fontSize:14, color:hc?"#ddd":"#374151", lineHeight:1.7 }}>{translating?<SkeletonLine />:q}</span>
            <span style={{ fontSize:11.5, color:copied===`q${i}`?"#22c55e":"#94a3b8", transition:"color 0.2s", flexShrink:0, fontWeight:600 }}>{copied===`q${i}`?"✓ Copied!":"📋 Copy"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SYMPTOMS PANEL
// ─────────────────────────────────────────────────────────────
function SymptomsPanel({ symptoms, lifestyle, translating, highContrast }) {
  const hc = highContrast;
  return (
    <div>
      {symptoms.length > 0 && (
        <div style={{ marginBottom:32 }}>
          <h3 style={{ fontFamily:"Lora,serif", fontSize:"1.15rem", fontWeight:600, marginBottom:6, color:hc?"#fff":"#1a1a2e" }}>👀 Symptoms to watch for</h3>
          <p style={{ fontSize:13, color:"#94a3b8", marginBottom:14, lineHeight:1.6 }}>Contact your doctor if you notice these.</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12 }}>
            {symptoms.map((s,i) => (
              <div key={i} className="fu0" style={{ background:hc?"#111":"#fff", border:`1px solid ${hc?"#555":"rgba(245,158,11,0.18)"}`, borderRadius:16, padding:"16px 18px", animationDelay:`${i*0.065}s` }}>
                <div style={{ fontWeight:700, fontSize:13.5, color:"#d97706", marginBottom:7 }}>🔔 {translating?<SkeletonLine />:s.symptom}</div>
                <div style={{ color:hc?"#bbb":"#78716c", fontSize:12.5, lineHeight:1.7 }}>{translating?<SkeletonLine />:s.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {lifestyle.length > 0 && (
        <div>
          <h3 style={{ fontFamily:"Lora,serif", fontSize:"1.15rem", fontWeight:600, marginBottom:6, color:hc?"#fff":"#1a1a2e" }}>✨ Simple lifestyle tips</h3>
          <p style={{ fontSize:13, color:"#94a3b8", marginBottom:14 }}>Small changes that may help.</p>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {lifestyle.map((n,i) => (
              <div key={i} className="fu0" style={{ background:hc?"#111":"rgba(99,102,241,0.04)", border:`1px solid ${hc?"#444":"rgba(99,102,241,0.12)"}`, borderRadius:14, padding:"14px 18px", display:"flex", gap:12, fontSize:14, color:hc?"#ccc":"#475569", lineHeight:1.75, animationDelay:`${i*0.07}s` }}>
                <span style={{ flexShrink:0, fontSize:18 }}>💚</span>
                {translating?<SkeletonLine />:n}
              </div>
            ))}
          </div>
        </div>
      )}
      {!symptoms.length && !lifestyle.length && <EmptyState icon="👀" msg="No specific symptoms or lifestyle tips for this report." />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CHAT PANEL
// ─────────────────────────────────────────────────────────────
function ChatPanel({ msgs, input, setInput, loading, onSend, chatEndRef, highContrast, chatPdf, setChatPdf, chatPdfRef, detectedLang, setDetectedLang }) {
  const hc = highContrast;
  const onKey = e => { if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); onSend(); } };
  const onInputChange = e => { setInput(e.target.value); setDetectedLang(detectTransliteratedLanguage(e.target.value)); };
  const hint = detectedLang ? getTransliterationHint(detectedLang) : null;

  const suggestions = [
    { text:"Is anything in my results concerning?",   flag:"🇺🇸", badge:null        },
    { text:"naku emi problem undi report lo?",         flag:"🇮🇳", badge:"Tenglish"  },
    { text:"mera result normal hai kya?",              flag:"🇮🇳", badge:"Hinglish"  },
    { text:"What should I tell my doctor?",            flag:"🇺🇸", badge:null        },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", background:hc?"#111":"#fff", border:`1px solid ${hc?"#444":"rgba(99,102,241,0.1)"}`, borderRadius:20, overflow:"hidden", boxShadow:hc?"none":"0 4px 24px rgba(99,102,241,0.08)" }}>

      {/* Header */}
      <div style={{ padding:"14px 18px", borderBottom:`1px solid ${hc?"#333":"rgba(99,102,241,0.08)"}`, display:"flex", alignItems:"center", gap:12, flexShrink:0, background:hc?"#0a0a0a":"linear-gradient(135deg,rgba(99,102,241,0.04),rgba(139,92,246,0.03))" }}>
        <div style={{ width:38, height:38, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, boxShadow:"0 4px 14px rgba(99,102,241,0.35)" }}>🤖</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14, color:hc?"#fff":"#1a1a2e" }}>MedTranslate Assistant</div>
          <div style={{ fontSize:11, color:"#22c55e", fontWeight:600, display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ animation:"pulse 2s infinite", display:"inline-block" }}>●</span>
            Understands English · తెలుగు · हिन्दी · Tenglish · Hinglish
          </div>
        </div>
        <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, padding:"4px 10px", fontSize:10, color:"#dc2626", fontWeight:700, flexShrink:0 }}>Not medical advice</div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"18px 16px 10px", minHeight:340, maxHeight:420 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign:"center", padding:"20px 16px" }}>
            <div style={{ fontSize:44, marginBottom:14, animation:"float 3.5s ease-in-out infinite" }}>💬</div>
            <div style={{ fontFamily:"Lora,serif", fontSize:"1.1rem", marginBottom:6, color:hc?"#eee":"#1a1a2e" }}>Ask me anything!</div>
            <div style={{ fontSize:12.5, color:"#94a3b8", marginBottom:20, lineHeight:1.75 }}>
              Type in <strong>English</strong>, <strong>Tenglish</strong>, <strong>Hinglish</strong>, or attach a <strong>PDF 📎</strong>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, textAlign:"left" }}>
              {suggestions.map((s,i) => (
                <button key={i} onClick={() => setInput(s.text)}
                  style={{ background:hc?"#1a1a1a":"rgba(99,102,241,0.05)", border:`1px solid ${hc?"#333":"rgba(99,102,241,0.13)"}`, borderRadius:12, padding:"10px 14px", fontSize:13, color:hc?"#ccc":"#475569", cursor:"pointer", textAlign:"left", transition:"all 0.2s", display:"flex", alignItems:"center", gap:8 }}
                  onMouseOver={e => { e.currentTarget.style.background=hc?"#222":"rgba(99,102,241,0.09)"; e.currentTarget.style.borderColor="rgba(99,102,241,0.28)"; }}
                  onMouseOut={e  => { e.currentTarget.style.background=hc?"#1a1a1a":"rgba(99,102,241,0.05)"; e.currentTarget.style.borderColor=hc?"#333":"rgba(99,102,241,0.13)"; }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{s.flag}</span>
                  <span style={{ flex:1 }}>{s.text}</span>
                  {s.badge && <span style={{ fontSize:10, color:"#6366f1", background:"rgba(99,102,241,0.1)", borderRadius:8, padding:"2px 7px", fontWeight:700, flexShrink:0 }}>{s.badge}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m,i) => (
          <div key={i} style={{ display:"flex", flexDirection:m.role==="user"?"row-reverse":"row", gap:10, marginBottom:16, animation:`${m.role==="user"?"slideR":"slideL"} 0.3s ease both` }}>
            <div style={{ width:30, height:30, background:m.role==="user"?"linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.15))":"linear-gradient(135deg,#6366f1,#8b5cf6)", border:`1px solid ${m.role==="user"?"rgba(99,102,241,0.3)":"transparent"}`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
              {m.role==="user"?"👤":"🤖"}
            </div>
            <div style={{ maxWidth:"78%", padding:"12px 16px", background:m.role==="user"?(hc?"#1a1a2e":"linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.08))"):(hc?"#1a1a1a":"#f8fafc"), border:`1px solid ${m.role==="user"?"rgba(99,102,241,0.2)":(hc?"#333":"rgba(0,0,0,0.06)")}`, borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px", fontSize:13.5, lineHeight:1.8, color:hc?"#ddd":(m.role==="user"?"#3730a3":"#374151"), whiteSpace:"pre-wrap" }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:"flex", gap:10, marginBottom:16, animation:"fadeIn 0.3s ease" }}>
            <div style={{ width:30, height:30, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>🤖</div>
            <div style={{ background:hc?"#1a1a1a":"#f8fafc", border:`1px solid ${hc?"#333":"rgba(0,0,0,0.06)"}`, borderRadius:"18px 18px 18px 4px", padding:"14px 18px", display:"flex", gap:5, alignItems:"center" }}>
              {[0,1,2].map(j => <div key={j} style={{ width:7, height:7, background:"#6366f1", borderRadius:"50%", animation:`float 1.1s ${j*0.18}s ease-in-out infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Tenglish/Hinglish detection banner */}
      {hint && (
        <div style={{ margin:"0 14px 8px", background:"rgba(99,102,241,0.07)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:12, padding:"9px 14px", display:"flex", alignItems:"center", gap:10, animation:"fadeIn 0.3s ease" }}>
          <span style={{ fontSize:18 }}>{hint.flag}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:"#6366f1" }}>{hint.msg}</div>
            <div style={{ fontSize:11, color:"#94a3b8" }}>{hint.sub}</div>
          </div>
          <span>✓</span>
        </div>
      )}

      {/* PDF attachment preview */}
      {chatPdf && (
        <div style={{ margin:"0 14px 8px", background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.18)", borderRadius:12, padding:"9px 14px", display:"flex", alignItems:"center", gap:10, animation:"fadeIn 0.3s ease" }}>
          <span style={{ fontSize:22 }}>📑</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:hc?"#fff":"#1a1a2e", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{chatPdf.name}</div>
            <div style={{ fontSize:11, color:"#94a3b8" }}>{(chatPdf.size/1024).toFixed(1)} KB · Ready to send</div>
          </div>
          <button onClick={() => setChatPdf(null)} style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:8, padding:"4px 10px", color:"#dc2626", fontSize:11, fontWeight:700, cursor:"pointer" }}>Remove</button>
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding:"12px 14px", borderTop:`1px solid ${hc?"#333":"rgba(99,102,241,0.08)"}`, display:"flex", gap:8, alignItems:"flex-end", flexShrink:0 }}>
        <button onClick={() => chatPdfRef.current?.click()} title="Attach PDF" aria-label="Attach PDF"
          style={{ width:42, height:42, borderRadius:11, border:`1.5px solid ${chatPdf?"#6366f1":(hc?"#444":"rgba(99,102,241,0.2)")}`, background:chatPdf?"rgba(99,102,241,0.15)":"transparent", color:chatPdf?"#6366f1":"#94a3b8", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s", flexShrink:0 }}>
          📎
        </button>
        <input ref={chatPdfRef} type="file" accept="application/pdf" onChange={e => { const f=e.target.files[0]; if(f) setChatPdf(f); e.target.value=""; }} style={{ display:"none" }} />

        <textarea value={input} onChange={onInputChange} onKeyDown={onKey}
          placeholder={"Ask in English, Tenglish or Hinglish…\ne.g. \"naku blood report lo emi problem undi?\""}
          aria-label="Type your question" rows={2}
          style={{ flex:1, background:hc?"#000":"rgba(99,102,241,0.04)", border:`1.5px solid ${hc?"#444":"rgba(99,102,241,0.15)"}`, borderRadius:13, padding:"10px 14px", color:hc?"#fff":"#1a1a2e", fontSize:13.5, resize:"none", lineHeight:1.6, maxHeight:110, overflow:"auto", transition:"border-color 0.2s" }}
          onFocus={e => e.target.style.borderColor="rgba(99,102,241,0.45)"}
          onBlur={e  => e.target.style.borderColor=hc?"#444":"rgba(99,102,241,0.15)"} />

        <button onClick={onSend} disabled={(!input.trim()&&!chatPdf)||loading} aria-label="Send"
          style={{ width:42, height:42, borderRadius:11, border:"none", background:(input.trim()||chatPdf)&&!loading?"linear-gradient(135deg,#6366f1,#8b5cf6)":"rgba(99,102,241,0.08)", color:(input.trim()||chatPdf)&&!loading?"#fff":"#94a3b8", fontSize:18, cursor:(input.trim()||chatPdf)&&!loading?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s", flexShrink:0, boxShadow:(input.trim()||chatPdf)&&!loading?"0 4px 16px rgba(99,102,241,0.3)":"none" }}>
          {loading ? <Spinner size={16} color="#6366f1" /> : "↑"}
        </button>
      </div>

      <div style={{ padding:"0 14px 12px", fontSize:11, color:"#94a3b8", display:"flex", gap:14, flexWrap:"wrap" }}>
        <span>📎 Attach PDF to ask about a document</span>
        <span>🇮🇳 Tenglish &amp; Hinglish understood</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PICTOGRAM HELPER
// ─────────────────────────────────────────────────────────────
function renderPictograms(codes) {
  if (!codes || !Array.isArray(codes) || codes.length === 0) return null;
  const iconMap = {
    "morning": { icon: "☀️", label: "Morning" },
    "afternoon": { icon: "🌤️", label: "Afternoon" },
    "night": { icon: "🌙", label: "Night" },
    "food": { icon: "🍳", label: "With Food" },
    "water": { icon: "💧", label: "With Water" },
    "1x": { icon: "🔴", label: "1x/day" },
    "2x": { icon: "🔴🔴", label: "2x/day" },
    "3x": { icon: "🔴🔴🔴", label: "3x/day" }
  };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 4, flexWrap: "wrap" }}>
      {codes.map((code, i) => {
        const ic = iconMap[code];
        if (!ic) return null;
        return (
          <span key={i} style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "4px 8px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5, color: "#6366f1", fontWeight: 600 }}>
            <span style={{ fontSize: 16 }}>{ic.icon}</span> {ic.label}
          </span>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DISCHARGE PANEL
// ─────────────────────────────────────────────────────────────
function DischargePanel({ ds, translating, highContrast }) {
  const hc = highContrast;
  const [pcsScore, setPcsScore] = useState(null);
  const [pcsEvaluating, setPcsEvaluating] = useState(false);
  const [pcsAnswers, setPcsAnswers] = useState({});

  const evaluatePCS = async () => {
    if (!ds.comprehension_questions) return;
    setPcsEvaluating(true);
    const answersText = ds.comprehension_questions.map((q, i) => `Q: ${q}\nA: ${pcsAnswers[i] || "No answer"}`).join("\n\n");
    const prompt = `You are evaluating a patient's comprehension of their discharge summary.
    
Discharge Summary Context:
${JSON.stringify(ds, null, 2)}

Patient's Answers:
${answersText}

Evaluate if the patient understood the critical instructions. 
Respond ONLY with a JSON object: {"score": <number 0-100>, "feedback": "<1-2 sentences of encouraging feedback or correction>"}`;

    try {
      const res = await callGroq([{role: "user", content: prompt}], "You evaluate patient comprehension. Output ONLY valid JSON.");
      const data = JSON.parse(res.replace(/```json|```/g, "").trim());
      setPcsScore(data);
    } catch(e) { console.error(e); }
    setPcsEvaluating(false);
  };

  if (!ds) return null;
  return (
    <div className="scale-in">
      {ds.reason_for_visit && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, color: hc ? "#fff" : "#1a1a2e", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><span>🎯</span> Reason for Visit</h3>
          <div style={{ background: hc ? "#111" : "#fff", border: `1px solid ${hc ? "#333" : "rgba(99,102,241,0.1)"}`, borderRadius: 12, padding: "16px", color: hc ? "#ddd" : "#475569", lineHeight: 1.6 }}>
            {translating ? <SkeletonLine /> : ds.reason_for_visit}
          </div>
        </div>
      )}
      {ds.hospital_course && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, color: hc ? "#fff" : "#1a1a2e", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><span>🏥</span> What Happened in Hospital</h3>
          <div style={{ background: hc ? "#111" : "#fff", border: `1px solid ${hc ? "#333" : "rgba(99,102,241,0.1)"}`, borderRadius: 12, padding: "16px", color: hc ? "#ddd" : "#475569", lineHeight: 1.6 }}>
            {translating ? <SkeletonLine /> : ds.hospital_course}
          </div>
        </div>
      )}
      {ds.discharge_medications && ds.discharge_medications.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, color: hc ? "#fff" : "#1a1a2e", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><span>💊</span> Discharge Medications</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {ds.discharge_medications.map((m, i) => (
              <div key={i} style={{ background: hc ? "#111" : "#fff", border: `1px solid ${hc ? "#333" : "rgba(99,102,241,0.1)"}`, borderRadius: 12, padding: "16px" }}>
                <div style={{ fontWeight: 700, color: hc ? "#fff" : "#1a1a2e", fontSize: 15, marginBottom: 4 }}>{translating ? <SkeletonLine /> : m.name}</div>
                <div style={{ fontSize: 14, color: hc ? "#bbb" : "#475569", marginBottom: 8 }}>{translating ? <SkeletonLine /> : m.instructions}</div>
                {!translating && renderPictograms(m.schedule_codes)}
                <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 600, background: "rgba(99,102,241,0.1)", display: "inline-block", padding: "4px 10px", borderRadius: 6, marginTop: 4 }}>{translating ? <SkeletonLine /> : m.purpose}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {ds.follow_up_appointments && ds.follow_up_appointments.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, color: hc ? "#fff" : "#1a1a2e", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><span>📅</span> Follow-up Appointments</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {ds.follow_up_appointments.map((a, i) => (
              <div key={i} style={{ background: hc ? "#111" : "#fff", border: `1px solid ${hc ? "#333" : "rgba(99,102,241,0.1)"}`, borderRadius: 12, padding: "16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ fontSize: 24 }}>📆</div>
                <div>
                  <div style={{ fontWeight: 700, color: hc ? "#fff" : "#1a1a2e", fontSize: 15, marginBottom: 4 }}>{translating ? <SkeletonLine /> : a.who}</div>
                  <div style={{ fontSize: 14, color: "#22c55e", fontWeight: 600, marginBottom: 4 }}>{translating ? <SkeletonLine /> : a.when}</div>
                  <div style={{ fontSize: 13, color: hc ? "#bbb" : "#64748b" }}>{translating ? <SkeletonLine /> : a.purpose}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ds.comprehension_questions && ds.comprehension_questions.length > 0 && !translating && (
        <div style={{ marginTop: 30, background: hc ? "#1a2a1a" : "rgba(34,197,94,0.06)", border: `1px solid ${hc ? "#242" : "rgba(34,197,94,0.3)"}`, borderRadius: 16, padding: "20px" }}>
          <h3 style={{ fontSize: 16, color: hc ? "#fff" : "#16a34a", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><span>🧠</span> Verify Understanding (PCS)</h3>
          <p style={{ fontSize: 13, color: hc ? "#bbb" : "#475569", marginBottom: 16 }}>Please answer these questions to ensure you understood the instructions:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {ds.comprehension_questions.map((q, i) => (
              <div key={i}>
                <div style={{ fontWeight: 600, fontSize: 14, color: hc ? "#ddd" : "#1a1a2e", marginBottom: 8 }}>{q}</div>
                <input type="text" value={pcsAnswers[i] || ""} onChange={e => setPcsAnswers({...pcsAnswers, [i]: e.target.value})} placeholder="Type your answer..." disabled={pcsScore} style={{ width: "100%", padding: "12px", borderRadius: 8, border: `1px solid ${hc ? "#444" : "#cbd5e1"}`, background: hc ? "#111" : "#fff", color: hc ? "#fff" : "#1a1a2e", fontSize: 14 }} />
              </div>
            ))}
          </div>
          {!pcsScore ? (
            <button onClick={evaluatePCS} disabled={pcsEvaluating || Object.keys(pcsAnswers).length === 0} style={{ marginTop: 16, width: "100%", background: "#22c55e", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontWeight: 700, cursor: pcsEvaluating ? "wait" : "pointer", opacity: (pcsEvaluating || Object.keys(pcsAnswers).length === 0) ? 0.6 : 1 }}>
              {pcsEvaluating ? "Evaluating..." : "Check My Answers"}
            </button>
          ) : (
            <div style={{ marginTop: 20, padding: "16px", borderRadius: 10, background: pcsScore.score >= 70 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${pcsScore.score >= 70 ? "#22c55e" : "#ef4444"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{pcsScore.score >= 70 ? "✅" : "⚠️"}</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: pcsScore.score >= 70 ? "#16a34a" : "#dc2626" }}>Score: {pcsScore.score}/100</span>
              </div>
              <div style={{ color: hc ? "#eee" : "#1a1a2e", fontSize: 14, lineHeight: 1.6 }}>{pcsScore.feedback}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATE + SPINNER
// ─────────────────────────────────────────────────────────────
function EmptyState({ icon, msg }) {
  return <div style={{ textAlign:"center", padding:"60px 20px", color:"#94a3b8" }}><div style={{ fontSize:44, marginBottom:14 }}>{icon}</div><div style={{ fontSize:14, lineHeight:1.7 }}>{msg}</div></div>;
}

function Spinner({ size=18, color="#6366f1" }) {
  return <span style={{ width:size, height:size, border:`2px solid ${color}30`, borderTopColor:color, borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite", flexShrink:0 }} />;
}

// ─────────────────────────────────────────────────────────────
// VOICE PAGE — AI Doctor + Patient Translator
// ─────────────────────────────────────────────────────────────
function VoicePage({ lang, highContrast, onExit }) {
  const hc = highContrast;
  const [msgs, setMsgs] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [patientInput, setPatientInput] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const AI_DOCTOR_PROMPT = `You are MedTranslate AI Doctor — a warm, empathetic medical assistant helping a patient who may speak any language. 

RULES:
- Give helpful, reassuring medical guidance
- NEVER give a definitive diagnosis — always say "this could be..." or "you should see a doctor about..."
- Keep answers to 2-3 short paragraphs
- Use simple, plain language a 12-year-old could understand
- If the patient describes an emergency (chest pain, can't breathe, stroke symptoms), tell them to call emergency services IMMEDIATELY
- Always end with a caring note
- Respond in the SAME LANGUAGE the patient used. If they speak Telugu, respond in Telugu. If Hindi, respond in Hindi. If English, respond in English.`;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = e => chunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        processVoice();
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoice = async () => {
    if (chunksRef.current.length === 0) return;
    setIsProcessing(true);
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const text = await transcribeAudio(blob);
      if (!text || text.trim().length < 2) { setIsProcessing(false); return; }
      await sendToAIDoctor(text.trim());
    } catch (e) {
      console.error(e);
      setMsgs(prev => [...prev, { role: "system", content: "Audio error: " + e.message, id: Date.now() }]);
    }
    setIsProcessing(false);
  };

  const sendToAIDoctor = async (text) => {
    const patientMsg = { role: "patient", content: text, id: Date.now() };
    setMsgs(prev => [...prev, patientMsg]);
    setIsProcessing(true);
    try {
      const history = msgs.filter(m => m.role !== "system").map(m => ({
        role: m.role === "patient" ? "user" : "assistant",
        content: m.content,
      }));
      history.push({ role: "user", content: text });
      const reply = await callGroq(history, AI_DOCTOR_PROMPT);
      const doctorMsg = { role: "doctor", content: reply.trim(), id: Date.now() + 1 };
      setMsgs(prev => [...prev, doctorMsg]);
      speakText(reply.trim());
    } catch (e) {
      setMsgs(prev => [...prev, { role: "system", content: "Error: " + e.message, id: Date.now() + 1 }]);
    }
    setIsProcessing(false);
  };

  const handleTextSend = () => {
    if (!patientInput.trim()) return;
    sendToAIDoctor(patientInput.trim());
    setPatientInput("");
  };

  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="scale-in" style={{ maxWidth: 800, margin: "0 auto", padding: "28px 16px 80px" }}>
      <button onClick={onExit} style={{ background: "transparent", border: "none", color: "#6366f1", cursor: "pointer", fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 18 }}>←</span> Back to Reports
      </button>

      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <div style={{ display: "inline-block", background: "rgba(34,197,94,0.1)", color: "#22c55e", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>
          <span style={{ display: "inline-block", width: 8, height: 8, background: "#22c55e", borderRadius: "50%", marginRight: 6, animation: "pulse 1.5s infinite" }}></span> AI Doctor Active
        </div>
        <h2 style={{ fontFamily: "Lora,serif", fontSize: "clamp(1.5rem,4vw,2rem)", color: hc ? "#fff" : "#1a1a2e", marginBottom: 8 }}>AI Doctor — Patient Translator</h2>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>Speak or type in <strong>any language</strong> — Telugu, Hindi, English, Arabic, Spanish…<br/>The AI Doctor understands and responds in your language.</p>
        <div style={{ marginTop: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "8px 14px", display: "inline-block", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>⚠️ Not a real doctor · For guidance only · Call 911 for emergencies</div>
      </div>

      {/* Chat Messages */}
      <div style={{ minHeight: 200, maxHeight: 400, overflowY: "auto", marginBottom: 20, padding: 4 }}>
        {msgs.length === 0 && !isProcessing && (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "#94a3b8", background: hc ? "#111" : "rgba(255,255,255,0.5)", borderRadius: 20, border: `1px dashed ${hc ? "#333" : "#cbd5e1"}` }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🩺</div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>How can I help you today?</p>
            <p style={{ fontSize: 13 }}>Speak or type your symptoms in any language</p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {msgs.map(m => (
            <div key={m.id} style={{ alignSelf: m.role === "patient" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "patient" ? (hc ? "#1a2a1a" : "#f0fdf4") : m.role === "system" ? (hc ? "#2a1a1a" : "#fef2f2") : (hc ? "#1a1a2a" : "#f1f5f9"), border: `1px solid ${m.role === "patient" ? (hc ? "#242" : "#bbf7d0") : m.role === "system" ? "#fca5a5" : (hc ? "#334" : "#e2e8f0")}`, borderRadius: 20, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>
                {m.role === "patient" ? "🗣️ You" : m.role === "system" ? "⚠️ System" : "🩺 AI Doctor"}
              </div>
              <div style={{ fontSize: 15, color: hc ? "#eee" : "#1a1a2e", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          ))}
          {isProcessing && (
            <div style={{ alignSelf: "flex-start", maxWidth: "85%", background: hc ? "#1a1a2a" : "#f1f5f9", border: `1px solid ${hc ? "#334" : "#e2e8f0"}`, borderRadius: 20, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
              <Spinner size={16} color="#6366f1" />
              <span style={{ color: "#6366f1", fontWeight: 600, fontSize: 14 }}>AI Doctor is thinking...</span>
            </div>
          )}
        </div>
        <div ref={endRef} />
      </div>

      {/* Voice + Text Input */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: hc ? "#000" : "#fff", borderTop: `1px solid ${hc ? "#333" : "#e2e8f0"}`, padding: "16px", zIndex: 10 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={isRecording ? stopRecording : startRecording} disabled={isProcessing} style={{ width: 52, height: 52, borderRadius: "50%", border: "none", background: isRecording ? "#ef4444" : "#22c55e", color: "#fff", fontSize: 22, cursor: isProcessing ? "wait" : "pointer", flexShrink: 0, boxShadow: isRecording ? "0 0 20px rgba(239,68,68,0.4)" : "0 4px 14px rgba(34,197,94,0.3)", transition: "all 0.2s", animation: isRecording ? "pulse 1s infinite" : "none" }}>
            {isRecording ? "⏹" : "🎙️"}
          </button>
          <input type="text" value={patientInput} onChange={e => setPatientInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleTextSend()} placeholder="Or type here in any language..." disabled={isProcessing} style={{ flex: 1, padding: "14px 18px", borderRadius: 14, border: `1.5px solid ${hc ? "#444" : "#e2e8f0"}`, background: hc ? "#111" : "#f8fafc", color: hc ? "#fff" : "#1a1a2e", fontSize: 15, outline: "none" }} />
          <button onClick={handleTextSend} disabled={isProcessing || !patientInput.trim()} style={{ padding: "14px 20px", borderRadius: 14, border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: (!patientInput.trim() || isProcessing) ? 0.5 : 1 }}>Send</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OFFLINE EMERGENCY PAGE
// ─────────────────────────────────────────────────────────────
function OfflinePage({ lang, highContrast, onExit }) {
  const hc = highContrast;
  const phrases = [
    { en: "I am having chest pain.", te: "నాకు ఛాతీలో నొప్పిగా ఉంది.", hi: "मुझे सीने में दर्द हो रहा है।", ar: "أشعر بألم في صدري.", es: "Tengo dolor en el pecho." },
    { en: "I cannot breathe.", te: "నేను ఊపిరి పీల్చుకోలేకపోతున్నాను.", hi: "मुझे सांस लेने में तकलीफ हो रही है।", ar: "لا أستطيع التنفس.", es: "No puedo respirar." },
    { en: "I am allergic to penicillin.", te: "నాకు పెన్సిలిన్ ఎలర్జీ ఉంది.", hi: "मुझे पेनिसिलिन से एलर्जी है।", ar: "لديّ حساسية من البنسلين.", es: "Soy alérgico a la penicilina." },
    { en: "I need an ambulance.", te: "నాకు అంబులెన్స్ కావాలి.", hi: "मुझे एम्बुलेंस चाहिए।", ar: "أحتاج سيارة إسعاف.", es: "Necesito una ambulancia." },
    { en: "I take blood thinners.", te: "నేను బ్లడ్ థిన్నర్స్ వాడుతున్నాను.", hi: "मैं ब्लड थिनर लेता हूँ।", ar: "أتناول مميعات الدم.", es: "Tomo anticoagulantes." },
    { en: "I have diabetes.", te: "నాకు డయాబెటిస్ ఉంది.", hi: "मुझे मधुमेह है।", ar: "لديّ مرض السكري.", es: "Tengo diabetes." },
    { en: "Where does it hurt?", te: "నొప్పి ఎక్కడ ఉంది?", hi: "दर्द कहाँ हो रहा है?", ar: "أين يؤلمك؟", es: "¿Dónde le duele?" },
  ];

  return (
    <div className="scale-in" style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30, paddingBottom: 20, borderBottom: `1px solid ${hc ? "#333" : "#e2e8f0"}` }}>
        <button onClick={onExit} style={{ background: "none", border: "none", color: hc ? "#fff" : "#475569", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <span>←</span> Back to Main
        </button>
        <div style={{ background: "#dc2626", color: "#fff", padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          🚨 OFFLINE MODE
        </div>
      </div>
      <div style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: hc ? "#fff" : "#1a1a2e" }}>Emergency Phrasebook</h2>
        <p style={{ color: hc ? "#aaa" : "#64748b", fontSize: 15 }}>Critical medical phrases — works without internet.</p>
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        {phrases.map((p, i) => (
          <div key={i} style={{ border: `1px solid ${hc ? "#333" : "#e2e8f0"}`, borderRadius: 12, padding: "20px", background: hc ? "#111" : "#f8fafc" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: hc ? "#fff" : "#0f172a" }}>{p.en}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {[{code:"te",label:"Telugu"},{code:"hi",label:"Hindi"},{code:"ar",label:"Arabic"},{code:"es",label:"Spanish"}].map(l => (
                <div key={l.code} style={{ background: hc ? "#1a1a1a" : "#fff", padding: "10px", borderRadius: 8, border: `1px solid ${hc ? "#222" : "#e2e8f0"}` }}>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>{l.label}</div>
                  <div style={{ fontSize: 15, color: "#6366f1", fontWeight: 600 }}>{p[l.code]}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

