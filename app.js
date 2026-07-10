// app.js — lädt den Deep-Dive und rendert ihn.

const appEl = document.getElementById("app");
const archiveEl = document.getElementById("archive");

// Winziger, sicherer Markdown-Renderer: escaped HTML, dann **fett**, *kursiv*,
// Absätze an Doppel-Zeilenumbrüchen.
function md(text) {
  const esc = String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return esc
    .split(/\n\s*\n/)
    .map((para) => {
      const html = para
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/\n/g, "<br>");
      return `<p>${html}</p>`;
    })
    .join("");
}

function render(d) {
  document.title = `${d.title} · Denken`;
  appEl.innerHTML = `
    <div class="meta">
      <span class="badge">Tag ${d.day}</span>
      <span>${d.reading_time_min} Min. Lesezeit</span>
    </div>
    <p class="week">Woche ${d.week} · ${escapeText(d.week_theme)}</p>
    <h1>${escapeText(d.title)}</h1>
    <p class="thinker">${escapeText(d.thinker)}</p>

    <div class="hook">${md(d.hook)}</div>

    <section><h2>Das Werkzeug</h2>${md(d.concept)}</section>
    <section><h2>Ein Beispiel</h2>${md(d.example)}</section>
    <section><h2>Der typische Fehler</h2>${md(d.mistake)}</section>

    <div class="question">
      <h2>Frage des Tages</h2>
      <p>${escapeText(d.question_of_the_day)}</p>
    </div>

    <p class="takeaway">${escapeText(d.takeaway)}</p>
  `;
}

function escapeText(t) {
  return String(t).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function loadDay(path) {
  try {
    const res = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    render(await res.json());
    window.scrollTo(0, 0);
  } catch (e) {
    appEl.innerHTML = `<p class="error">Konnte den Inhalt nicht laden.<br>Erster Lauf steht evtl. noch aus.</p>`;
  }
}

async function buildArchive() {
  try {
    const res = await fetch(`./content/index.json?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const index = (await res.json()).sort((a, b) => b.day - a.day);
    archiveEl.innerHTML =
      `<option value="./content/latest.json">Heute (Tag ${index[0]?.day ?? "–"})</option>` +
      index
        .map((e) => `<option value="./content/archive/day-${String(e.day).padStart(2, "0")}.json">Tag ${e.day}: ${escapeText(e.tool)}</option>`)
        .join("");
    archiveEl.onchange = () => loadDay(archiveEl.value);
  } catch (e) {
    /* Archiv optional */
  }
}

loadDay("./content/latest.json");
buildArchive();

// Service-Worker registrieren (Offline + App-Feeling)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
