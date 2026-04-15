/**
 * app.js — Estima AI Real Estate Agent
 *
 * Handles all UI interactions:
 *   - Stage 1: send query to /predict, render extracted features
 *   - Gap filling: collect user input for missing features
 *   - Stage 2: re-submit with filled features, render prediction + interpretation
 *   - Market bar: visualise predicted price vs Ames market range
 */

// const API = "http://localhost:8000";
const API = "";

// Feature display labels — must match the 10 keys the ML model expects
const LABELS = {
  GrLivArea:    "Living Area (sqft)",
  GarageCars:   "Garage Cars",
  TotalBsmtSF:  "Basement (sqft)",
  YearBuilt:    "Year Built",
  FullBath:     "Full Baths",
  BedroomAbvGr: "Bedrooms",
  LotArea:      "Lot Area (sqft)",
  OverallQual:  "Quality (1–10)",
  OverallCond:  "Condition (1–10)",
  Neighborhood: "Neighborhood",
};

// Short human-readable descriptions shown under each feature label
const DESCRIPTIONS = {
  GrLivArea:    "Above-ground living space",
  GarageCars:   "How many cars fit in the garage",
  TotalBsmtSF:  "Total basement floor area",
  YearBuilt:    "Original construction year",
  FullBath:     "Full bathrooms above grade",
  BedroomAbvGr: "Bedrooms above basement level",
  LotArea:      "Total lot size in sq ft",
  OverallQual:  "Material & finish quality (1–10)",
  OverallCond:  "Current property condition (1–10)",
  Neighborhood: "Physical location in Ames, IA",
};

const KEYS = Object.keys(LABELS);

// Valid Ames Iowa neighborhood codes (for autocomplete)
const NEIGHBORHOODS = [
  "NAmes","CollgCr","OldTown","Edwards","Somerst","NridgHt","Gilbert",
  "Sawyer","NWAmes","SawyerW","Mitchel","BrkSide","Crawfor","IDOTRR",
  "Timber","NoRidge","StoneBr","SWISU","ClearCr","MeadowV","Blmngtn",
  "BrDale","Veenker","NPkVill","Blueste",
];

/**
 * Per-field input constraints and display hints for the gap-filling form.
 * min/max enforce HTML5 validation; hint is shown beneath the input.
 */
const FIELD_CONFIG = {
  GrLivArea:    { type:"number", min:100,  max:10000, step:50,  placeholder:"e.g. 1800",  hint:"100 – 10,000 sqft" },
  GarageCars:   { type:"number", min:0,    max:5,     step:1,   placeholder:"0 – 5",      hint:"0 = no garage" },
  TotalBsmtSF:  { type:"number", min:0,    max:8000,  step:50,  placeholder:"e.g. 800",   hint:"0 = no basement, up to 8,000 sqft" },
  YearBuilt:    { type:"number", min:1800, max:2030,  step:1,   placeholder:"e.g. 2003",  hint:"1800 – 2030" },
  FullBath:     { type:"number", min:0,    max:6,     step:1,   placeholder:"0 – 6",      hint:"Full bathrooms above grade" },
  BedroomAbvGr: { type:"number", min:0,    max:10,    step:1,   placeholder:"0 – 10",     hint:"Bedrooms above basement level" },
  LotArea:      { type:"number", min:1,    max:200000,step:100, placeholder:"e.g. 9600",  hint:"1 – 200,000 sqft" },
  OverallQual:  { type:"number", min:1,    max:10,    step:1,   placeholder:"1 – 10",     hint:"1 = very poor · 10 = excellent" },
  OverallCond:  { type:"number", min:1,    max:10,    step:1,   placeholder:"1 – 10",     hint:"1 = very poor · 10 = excellent" },
  Neighborhood: { type:"text",   placeholder:"e.g. CollgCr",   hint:"Ames Iowa neighborhood code" },
};

/**
 * Training data stats for the market comparison bar.
 * Must match TRAINING_STATS in app/services/llm_stage2.py
 */
const MARKET = {
  median: 165000,
  p25:    130000,
  p75:    215000,
  min:    34900,
  max:    745000,
};

// Pre-written example queries users can click to auto-fill
const EXAMPLES = [
  "3-bedroom ranch house with a large 2-car garage, built in 1998, in a good neighborhood. Overall quality around 7.",
  "Small older home from the 1950s, 2 bedrooms, no garage, tiny yard, needs some work. Condition is poor.",
  "Brand new 4-bedroom luxury build, 3 full bathrooms, 2500 sqft living area, 3-car garage, large lot, excellent quality 9/10.",
];

// Pre-written market insight queries
const INSIGHT_EXAMPLES = [
  "Which neighborhoods in Ames are the most affordable?",
  "How does overall quality rating affect house prices?",
  "What is the average house price in Ames Iowa?",
];

function fillInsight(i) {
  document.getElementById("queryInput").value = INSIGHT_EXAMPLES[i];
  updateChar();
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Update status message element with text and style class.
 * @param {string} id   - element id
 * @param {string} msg  - HTML string to display
 * @param {string} type - '' | 'loading' | 'error'
 */
function setStatus(id, msg, type = "") {
  const el = document.getElementById(id);
  el.className = "status-msg " + type;
  el.innerHTML = msg;
}

function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }

/**
 * Update the step indicator bar.
 * Steps < n are marked done, step n is active, steps > n are default.
 */
function setStep(n) {
  for (let i = 1; i <= 4; i++) {
    const s = document.getElementById("step" + i);
    s.className = "step" + (i < n ? " done" : i === n ? " active" : "");
  }
}

/** Auto-resize textarea to fit its content */
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

/** Update character counter with color feedback near the limit */
function updateChar() {
  const t   = document.getElementById("queryInput");
  const cc  = document.getElementById("charCount");
  const len = t.value.length;
  cc.textContent = len + " / 500";
  cc.className   = "char-count" + (len >= 480 ? " danger" : len >= 380 ? " warn" : "");
}

/**
 * Animate a numeric counter element from start to end.
 * @param {HTMLElement} el
 * @param {number} end
 * @param {number} duration ms
 */
function animateCounter(el, end, duration = 900) {
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    // Ease-out cubic
    const eased   = 1 - Math.pow(1 - progress, 3);
    el.textContent = "$" + Math.round(end * eased).toLocaleString("en-US");
    if (progress < 1) requestAnimationFrame(tick);
    else {
      el.textContent = "$" + end.toLocaleString("en-US");
      el.classList.add("animate");
    }
  }
  requestAnimationFrame(tick);
}

/** Copy the current price to clipboard with brief visual feedback */
function copyPrice() {
  const priceText = document.getElementById("priceVal").textContent;
  const btn       = document.getElementById("copyBtn");
  navigator.clipboard.writeText(priceText).then(() => {
    btn.classList.add("copied");
    btn.title = "Copied!";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.title = "Copy price";
    }, 1800);
  });
}

/** Fill the query textarea with a pre-written example */
function fillExample(i) {
  document.getElementById("queryInput").value = EXAMPLES[i];
  updateChar();
}

// ── Stage 1: Feature Extraction ────────────────────────────────────────────

/**
 * Read the query, call POST /predict, and render the extraction result.
 * If all features were extracted, jumps straight to renderResult().
 */
async function runExtraction() {
  const query = document.getElementById("queryInput").value.trim();
  if (!query) {
    setStatus("queryStatus", "Please describe a property first.", "error");
    return;
  }

  const btn    = document.getElementById("extractBtn");
  const btnTxt = document.getElementById("extractBtnText");
  btn.disabled = true;
  btn.classList.add("loading");
  btnTxt.innerHTML = '<span class="spin"></span> Analysing…';
  setStatus("queryStatus", "", "");

  try {
    const res = await fetch(`${API}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus("queryStatus", data.detail || "Something went wrong.", "error");
      btn.disabled = false;
      btn.classList.remove("loading");
      btnTxt.textContent = "Analyse Property";
      return;
    }

    setStatus("queryStatus", "", "");

    // Route by intent — insights bypass the extraction flow entirely
    if (data.response_type === "analysis") {
      renderInsights(data);
    } else {
      renderExtraction(data);
    }

  } catch (err) {
    setStatus("queryStatus", "Cannot reach the server. Make sure it is running.", "error");
  }

  btn.disabled = false;
  btn.classList.remove("loading");
  btnTxt.textContent = "Analyse Property";
}

// ── Render market insights ────────────────────────────────────────────────

/**
 * Display market insight highlights + LLM narrative.
 * Shown when the backend classifies the query as 'analysis'.
 */
function renderInsights(data) {
  // Stat cards
  const hl = document.getElementById("insightHighlights");
  hl.innerHTML = data.highlights.map((h) => `
    <div class="insight-card anim anim-1">
      <div class="insight-card-label">${h.label}</div>
      <div class="insight-card-value">${h.value}</div>
    </div>
  `).join("");

  // LLM narrative
  document.getElementById("insightNarrative").textContent = data.narrative;

  show("insightPanel");
  document.getElementById("insightPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── Render extraction results ──────────────────────────────────────────────

/**
 * Display extracted features with completeness bar.
 * If all 10 features are present, skip gap filling and go straight to result.
 */
function renderExtraction(data) {
  const features   = data.extraction.features;
  const missing    = data.extraction.missing_features;
  const nExtracted = KEYS.filter((k) => !missing.includes(k)).length;
  const pct        = Math.round((nExtracted / KEYS.length) * 100);

  // Completeness bar
  const fill = document.getElementById("compFill");
  fill.style.width = pct + "%";
  if (pct === 100) fill.classList.add("full");
  document.getElementById("compLabel").textContent = nExtracted + " / " + KEYS.length;
  document.getElementById("extractSummary").textContent = pct + "% complete";

  // Feature grid
  const grid = document.getElementById("featGrid");
  grid.innerHTML = "";

  KEYS.forEach((k) => {
    const val       = features[k];
    const isMissing = missing.includes(k);

    const item = document.createElement("div");
    item.className = "feat-item " + (isMissing ? "missing" : "extracted");
    item.innerHTML = `
      <div class="feat-key">
        ${LABELS[k]}
        <div class="feat-desc">${DESCRIPTIONS[k]}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="feat-val ${isMissing ? "na" : "ok"}">${isMissing ? "not found" : val}</div>
        <div class="feat-dot ${isMissing ? "na" : "ok"}"></div>
      </div>`;
    grid.appendChild(item);
  });

  setStep(2);
  show("extractionPanel");

  // All features found — skip gap filling
  if (data.is_complete) {
    setStep(4);
    renderResult(data);
    return;
  }

  // Some features missing — show the gap form
  renderGapForm(missing);
  setStep(3);
  show("gapPanel");
  document.getElementById("gapCount").textContent = missing.length + " missing";
  document.getElementById("gapPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── Gap filling form ───────────────────────────────────────────────────────

/**
 * Build input fields for each missing feature using FIELD_CONFIG for
 * per-field constraints, hints, and live validation feedback.
 */
function renderGapForm(missing) {
  const grid = document.getElementById("gapGrid");
  grid.innerHTML = "";

  // Inject the neighborhood autocomplete list once
  if (!document.getElementById("neighborhood-list")) {
    const dl = document.createElement("datalist");
    dl.id = "neighborhood-list";
    NEIGHBORHOODS.forEach((n) => {
      const opt = document.createElement("option");
      opt.value = n;
      dl.appendChild(opt);
    });
    document.body.appendChild(dl);
  }

  missing.forEach((k) => {
    const cfg = FIELD_CONFIG[k] || { type: "text", placeholder: "enter value", hint: "" };
    const isText = cfg.type === "text";

    // Build constraint attributes string
    let attrs = `type="${cfg.type}" id="g_${k}" placeholder="${cfg.placeholder}"`;
    if (!isText) {
      if (cfg.min !== undefined) attrs += ` min="${cfg.min}"`;
      if (cfg.max !== undefined) attrs += ` max="${cfg.max}"`;
      if (cfg.step !== undefined) attrs += ` step="${cfg.step}"`;
    }
    if (k === "Neighborhood") attrs += ` list="neighborhood-list"`;

    const div = document.createElement("div");
    div.className = "field";
    div.innerHTML = `
      <label for="g_${k}">
        ${LABELS[k]}
        <span class="field-sub">${DESCRIPTIONS[k]}</span>
      </label>
      <input ${attrs} autocomplete="off" />
      <span class="field-hint" id="hint_${k}">${cfg.hint || ""}</span>
      <span class="field-error" id="err_${k}"></span>`;
    grid.appendChild(div);

    // Live validation: show range error as user types
    const input = div.querySelector("input");
    if (!isText) {
      input.addEventListener("input", () => validateField(k));
      input.addEventListener("blur",  () => validateField(k));
    }
  });

  // Focus the first gap input for keyboard convenience
  const firstInput = grid.querySelector("input");
  if (firstInput) setTimeout(() => firstInput.focus(), 300);
}

/**
 * Validate a single numeric gap field.
 * Returns true if valid (or empty), false otherwise.
 * Sets/clears the error message and input styling.
 */
function validateField(k) {
  const input = document.getElementById("g_" + k);
  const errEl = document.getElementById("err_" + k);
  if (!input || !errEl) return true;

  const raw = input.value.trim();
  if (raw === "") {
    input.classList.remove("input-error");
    errEl.textContent = "";
    return true;
  }

  const cfg = FIELD_CONFIG[k] || {};
  const val = Number(raw);

  if (!Number.isInteger(val)) {
    input.classList.add("input-error");
    errEl.textContent = "Must be a whole number.";
    return false;
  }
  if (cfg.min !== undefined && val < cfg.min) {
    input.classList.add("input-error");
    errEl.textContent = `Minimum is ${cfg.min}.`;
    return false;
  }
  if (cfg.max !== undefined && val > cfg.max) {
    input.classList.add("input-error");
    errEl.textContent = `Maximum is ${cfg.max}.`;
    return false;
  }

  input.classList.remove("input-error");
  errEl.textContent = "";
  return true;
}

// ── Stage 1 + 2: Predict with filled gaps ──────────────────────────────────

/**
 * Collect user-filled values, re-call POST /predict with filled_features,
 * and render the prediction result.
 */
async function runPrediction() {
  const query  = document.getElementById("queryInput").value.trim();
  const btn    = document.getElementById("predictBtn");
  const btnTxt = document.getElementById("predictBtnText");
  btn.disabled = true;
  btn.classList.add("loading");
  btnTxt.innerHTML = '<span class="spin"></span> Predicting…';
  setStatus("gapStatus", "", "");

  // Validate all visible gap fields before submitting
  let hasErrors = false;
  KEYS.forEach((k) => {
    const el = document.getElementById("g_" + k);
    if (el && el.type !== "text" && el.value.trim() !== "") {
      if (!validateField(k)) hasErrors = true;
    }
  });
  if (hasErrors) {
    setStatus("gapStatus", "Please fix the highlighted fields before continuing.", "error");
    btn.disabled = false;
    btn.classList.remove("loading");
    btnTxt.textContent = "Get Price Estimate";
    return;
  }

  // Collect filled values from gap form inputs
  const filled = {};
  KEYS.forEach((k) => {
    const el = document.getElementById("g_" + k);
    if (el && el.value.trim() !== "") {
      filled[k] = k === "Neighborhood" ? el.value.trim() : parseInt(el.value, 10);
    }
  });

  try {
    const res = await fetch(`${API}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        filled_features: Object.keys(filled).length ? filled : null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus("gapStatus", data.detail || "Prediction failed.", "error");
      btn.disabled = false;
      btn.classList.remove("loading");
      btnTxt.textContent = "Get Price Estimate";
      return;
    }

    // Still missing features after merging
    if (!data.is_complete) {
      const still = data.extraction.missing_features;
      setStatus("gapStatus", `Still missing: ${still.join(", ")}. Please fill these in.`, "error");
      still.forEach((k) => {
        const el = document.getElementById("g_" + k);
        if (el) el.classList.add("required-missing");
      });
      btn.disabled = false;
      btn.classList.remove("loading");
      btnTxt.textContent = "Get Price Estimate";
      return;
    }

    setStatus("gapStatus", "", "");
    setStep(4);
    renderResult(data);

  } catch (err) {
    setStatus("gapStatus", "Cannot reach the server.", "error");
  }

  btn.disabled = false;
  btn.classList.remove("loading");
  btnTxt.textContent = "Get Price Estimate";
}

// ── Render final result ────────────────────────────────────────────────────

/**
 * Display predicted price, LLM interpretation, and market comparison bar.
 */
function renderResult(data) {
  const price    = Math.round(data.prediction);
  const priceEl  = document.getElementById("priceVal");

  // Animated counter + glow pulse
  priceEl.classList.remove("animate");
  animateCounter(priceEl, price, 1000);

  document.getElementById("interp").textContent = data.interpretation || "No interpretation available.";

  // Market comparison bar
  const span     = MARKET.max - MARKET.min;
  const p25pct   = ((MARKET.p25    - MARKET.min) / span) * 100;
  const p75pct   = ((MARKET.p75    - MARKET.min) / span) * 100;
  const medpct   = ((MARKET.median - MARKET.min) / span) * 100;
  const pricePct = Math.min(100, Math.max(0, ((price - MARKET.min) / span) * 100));

  document.getElementById("mktRange").style.cssText = `left:${p25pct}%;width:${p75pct - p25pct}%`;
  document.getElementById("mktMedian").style.left   = medpct + "%";

  const marker = document.getElementById("mktMarker");
  marker.style.left = pricePct + "%";
  marker.setAttribute("data-price", "$" + price.toLocaleString("en-US"));

  const diff    = price - MARKET.median;
  const diffStr = (diff >= 0 ? "+" : "") + "$" + Math.abs(Math.round(diff)).toLocaleString("en-US");
  document.getElementById("mktNote").textContent = diffStr + " vs median";

  show("resultPanel");
  document.getElementById("resultPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── Reset ──────────────────────────────────────────────────────────────────

/** Clear all state and return to the initial query screen */
function reset() {
  const ta = document.getElementById("queryInput");
  ta.value      = "";
  ta.style.height = "";  // reset auto-height
  const cc = document.getElementById("charCount");
  cc.textContent = "0 / 500";
  cc.className   = "char-count";

  setStatus("queryStatus", "", "");
  setStatus("gapStatus", "", "");

  ["extractionPanel", "gapPanel", "resultPanel", "insightPanel"].forEach(hide);

  setStep(1);

  const extractBtn = document.getElementById("extractBtn");
  extractBtn.disabled = false;
  extractBtn.classList.remove("loading");
  document.getElementById("extractBtnText").textContent = "Analyse Property";

  document.getElementById("compFill").classList.remove("full");
  document.getElementById("priceVal").classList.remove("animate");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Keyboard shortcut ──────────────────────────────────────────────────────
// Enter submits the query (Shift+Enter inserts a newline)
document.getElementById("queryInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    runExtraction();
  }
});