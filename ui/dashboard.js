/**
 * dashboard.js — Estima Market Dashboard
 * Fetches /stats and renders Chart.js visualisations.
 */

const API = "http://localhost:8000";

// Tier → color mapping (matches design tokens)
const TIER_COLORS = {
  luxury:     { bar: "rgba(139, 92, 246, 0.85)",  border: "#8b5cf6" },
  upscale:    { bar: "rgba(34,  211, 238, 0.80)",  border: "#22d3ee" },
  mid:        { bar: "rgba(16,  185, 129, 0.80)",  border: "#10b981" },
  affordable: { bar: "rgba(245, 158,  11, 0.80)",  border: "#f59e0b" },
  budget:     { bar: "rgba(244,  63,  94, 0.75)",  border: "#f43f5e" },
};

// Quality rating 1–10 → gradient from red to green
const QUAL_COLORS = [
  "rgba(244, 63,  94,  0.85)",
  "rgba(244, 63,  94,  0.70)",
  "rgba(245, 158, 11,  0.80)",
  "rgba(245, 158, 11,  0.90)",
  "rgba(245, 201, 11,  0.80)",
  "rgba(132, 204, 22,  0.80)",
  "rgba(34,  197, 94,  0.80)",
  "rgba(16,  185, 129, 0.85)",
  "rgba(6,   182, 212, 0.85)",
  "rgba(139, 92,  246, 0.90)",
];

// Decade → violet gradient (older = lighter)
const DEC_COLORS = [
  "rgba(139, 92, 246, 0.45)",
  "rgba(139, 92, 246, 0.55)",
  "rgba(139, 92, 246, 0.65)",
  "rgba(139, 92, 246, 0.78)",
  "rgba(139, 92, 246, 0.95)",
];

// Chart.js global defaults — match the dark theme
Chart.defaults.color           = "#94a3b8";
Chart.defaults.borderColor     = "rgba(255,255,255,0.07)";
Chart.defaults.font.family     = "'Syne', sans-serif";
Chart.defaults.font.size       = 12;

function fmt(n) { return "$" + n.toLocaleString("en-US"); }

function setStatus(msg, type = "") {
  const el = document.getElementById("dashStatus");
  el.className = "status-msg " + type;
  el.textContent = msg;
}

// ── Stat cards ─────────────────────────────────────────────────────────────

function renderCards(overall) {
  document.getElementById("statMedian").textContent = fmt(overall.median_price);
  document.getElementById("statMean").textContent   = fmt(overall.mean_price);
  document.getElementById("statRange").textContent  =
    fmt(overall.p25_price) + " – " + fmt(overall.p75_price);
  document.getElementById("statSales").textContent  =
    overall.total_sales.toLocaleString("en-US");
}

// ── Neighborhood chart (horizontal bar) ────────────────────────────────────

function renderNeighborhood(neighborhoods) {
  const labels = neighborhoods.map(n => n.name);
  const values = neighborhoods.map(n => n.median);
  const tiers  = neighborhoods.map(n => n.tier);

  const bgColors     = tiers.map(t => TIER_COLORS[t].bar);
  const borderColors = tiers.map(t => TIER_COLORS[t].border);

  // Legend
  const legend = document.getElementById("nbLegend");
  Object.entries(TIER_COLORS).forEach(([tier, c]) => {
    const dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.cssText = `background:${c.border}`;
    const label = document.createElement("span");
    label.className = "legend-label";
    label.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);
    const item = document.createElement("span");
    item.className = "legend-item";
    item.appendChild(dot);
    item.appendChild(label);
    legend.appendChild(item);
  });

  new Chart(document.getElementById("nbChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Median Price",
        data: values,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => " " + fmt(ctx.parsed.x),
            afterLabel: ctx => " " + tiers[ctx.dataIndex],
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: {
            callback: v => "$" + (v / 1000) + "k",
          },
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: "'JetBrains Mono', monospace", size: 11 } },
        },
      },
    },
  });
}

// ── Quality chart (vertical bar) ───────────────────────────────────────────

function renderQuality(quality) {
  new Chart(document.getElementById("qualChart"), {
    type: "bar",
    data: {
      labels: quality.map(q => "Q" + q.rating),
      datasets: [{
        label: "Median Price",
        data: quality.map(q => q.median),
        backgroundColor: QUAL_COLORS,
        borderColor: QUAL_COLORS.map(c => c.replace(/[\d.]+\)$/, "1)")),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => " " + fmt(ctx.parsed.y) } },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { callback: v => "$" + (v / 1000) + "k" },
        },
      },
    },
  });
}

// ── Decade chart (vertical bar) ────────────────────────────────────────────

function renderDecade(decade) {
  new Chart(document.getElementById("decChart"), {
    type: "bar",
    data: {
      labels: decade.map(d => d.decade),
      datasets: [{
        label: "Median Price",
        data: decade.map(d => d.median),
        backgroundColor: DEC_COLORS,
        borderColor: DEC_COLORS.map(c => c.replace(/[\d.]+\)$/, "1)")),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => " " + fmt(ctx.parsed.y) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { callback: v => "$" + (v / 1000) + "k" },
        },
      },
    },
  });
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

async function init() {
  setStatus("Loading market data…", "loading");
  try {
    const res  = await fetch(`${API}/stats`);
    const data = await res.json();
    setStatus("");
    renderCards(data.overall);
    renderNeighborhood(data.neighborhoods);
    renderQuality(data.quality);
    renderDecade(data.decade);
  } catch (err) {
    setStatus("Cannot reach the server. Make sure it is running.", "error");
  }
}

init();
