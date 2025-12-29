const DATA_URL = "./data/agents.json";

const el = (id) => document.getElementById(id);

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function totalScore(scores) {
  const keys = ["residency_hosting", "arabic_support", "deployment_model", "security_enterprise", "sector_fit"];
  return keys.reduce((sum, k) => sum + (Number(scores?.[k] ?? 0) || 0), 0);
}

function tierFromTotal(t) {
  if (t >= 18) return "Enterprise-Ready";
  if (t >= 11) return "Emerging";
  return "Not Ready";
}

function uniqueSorted(values) {
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function buildFilters(agents) {
  const categories = uniqueSorted(agents.map(a => a.category));
  const deployments = uniqueSorted(agents.flatMap(a => a.deployment || []));
  const sectors = uniqueSorted(agents.flatMap(a => a.sectors || []));

  const catSel = el("filterCategory");
  const depSel = el("filterDeployment");
  const secSel = el("filterSector");

  for (const c of categories) catSel.append(new Option(c, c));
  for (const d of deployments) depSel.append(new Option(d, d));
  for (const s of sectors) secSel.append(new Option(s, s));
}

function matchesCompliance(a, compliance) {
  if (!compliance) return true;

  const gcc = a.gcc || {};
  if (compliance === "uae") return !!gcc.uae_compliant;
  if (compliance === "saudi") return !!gcc.saudi_compliant;
  if (compliance === "qatar") return !!gcc.qatar_sovereign_cloud_compatible;
  return true;
}

function render(agents) {
  const q = (el("search").value || "").trim().toLowerCase();
  const category = el("filterCategory").value;
  const deployment = el("filterDeployment").value;
  const sector = el("filterSector").value;
  const compliance = el("filterCompliance").value;
  const sort = el("sortBy").value;

  let rows = agents.filter(a => {
    const t = totalScore(a.scores);
    a._total = t;
    a._tier = tierFromTotal(t);

    const hay = [
      a.name, a.category,
      ...(a.sectors || []),
      ...(a.deployment || []),
      a.sentinel_brief,
      a.recommended_use_case
    ].filter(Boolean).join(" ").toLowerCase();

    if (q && !hay.includes(q)) return false;
    if (category && a.category !== category) return false;
    if (deployment && !(a.deployment || []).includes(deployment)) return false;
    if (sector && !(a.sectors || []).includes(sector)) return false;
    if (!matchesCompliance(a, compliance)) return false;
    return true;
  });

  if (sort === "score_desc") rows.sort((a, b) => (b._total - a._total) || a.name.localeCompare(b.name));
  if (sort === "score_asc") rows.sort((a, b) => (a._total - b._total) || a.name.localeCompare(b.name));
  if (sort === "name_asc") rows.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "name_desc") rows.sort((a, b) => b.name.localeCompare(a.name));

  el("count").textContent = `${rows.length} result${rows.length === 1 ? "" : "s"}`;

  const grid = el("grid");
  grid.innerHTML = "";

  for (const a of rows) {
    const card = document.createElement("div");
    card.className = "card";

    const badges = (a.badges || []).map(b => `<div class="badge">${escapeHtml(b)}</div>`).join("");

    const t = a._total;
    const pct = clamp(Math.round((t / 25) * 100), 0, 100);

    card.innerHTML = `
      <div class="cardHead">
        <div>
          <h3 class="name">${escapeHtml(a.name)}</h3>
          <div class="small">${escapeHtml(a.category)} • ${escapeHtml(a._tier)}</div>
        </div>
        <div class="badges">${badges}</div>
      </div>

      <div class="scoreWrap">
        <div class="score">GCC Readiness: <strong>${t}</strong>/25</div>
        <div class="bar" aria-label="readiness bar">
          <div class="fill" style="width:${pct}%;"></div>
        </div>
      </div>

      <p class="brief">${escapeHtml(a.sentinel_brief || "")}</p>

      <div class="tags">
        ${(a.deployment || []).slice(0, 3).map(x => `<span class="tag">${escapeHtml(x)}</span>`).join("")}
        ${(a.sectors || []).slice(0, 3).map(x => `<span class="tag">${escapeHtml(x)}</span>`).join("")}
      </div>

      <div class="links">
        <a href="${escapeAttr(a.website)}" target="_blank" rel="noopener">Website</a>
        ${a.profile_url ? `<a href="${escapeAttr(a.profile_url)}">Profile</a>` : ``}
      </div>
    `;

    grid.appendChild(card);
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str) {
  return escapeHtml(str).replaceAll("`", "");
}

async function init() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);
  const data = await res.json();

  const agents = data.agents || [];
  buildFilters(agents);

  const updated = data.updated ? `Updated: ${data.updated}` : "";
  el("updated").textContent = updated;

  const controls = ["search","filterCategory","filterDeployment","filterSector","filterCompliance","sortBy"];
  for (const id of controls) el(id).addEventListener("input", () => render(agents));
  for (const id of controls) el(id).addEventListener("change", () => render(agents));

  render(agents);
}

init().catch(err => {
  el("count").textContent = "Error loading Navigator data.";
  console.error(err);
});

