// generate.mjs — erzeugt den Deep-Dive des Tages.
//
// Ablauf:
//   1. Tag N bestimmen (aus content/state.json: startDate, nur Mo–Fr gezählt)
//   2. Werkzeug für Tag N aus curriculum.yaml holen
//   3. Prompt aus scripts/prompt.md bauen (Platzhalter füllen)
//   4. claude-opus-4-8 aufrufen, JSON-Ausgabe per output_config.format erzwingen
//   5. content/latest.json + content/archive/day-NN.json + content/index.json schreiben
//
// Aufruf:
//   node scripts/generate.mjs            → Tag aus Datum, echter API-Call, schreibt Dateien
//   node scripts/generate.mjs --day=7    → erzwingt Tag 7 (zum Testen)
//   node scripts/generate.mjs --dry      → gibt JSON nur aus, schreibt nichts

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import OpenAI from "openai";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");
const ARCHIVE = join(CONTENT, "archive");

// ── CLI-Argumente ───────────────────────────────────────────────
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const dayArg = args.find((a) => a.startsWith("--day="));
const forcedDay = dayArg ? parseInt(dayArg.split("=")[1], 10) : null;

// ── Tag N bestimmen ─────────────────────────────────────────────
function weekdaysInclusive(start, end) {
  // Anzahl Mo–Fr von start bis end (beide inklusive), in UTC
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const wd = d.getUTCDay();
    if (wd >= 1 && wd <= 5) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

function determineDay() {
  if (forcedDay) return forcedDay;
  const state = JSON.parse(readFileSync(join(CONTENT, "state.json"), "utf8"));
  const start = new Date(`${state.startDate}T00:00:00Z`);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (today < start) {
    console.log(`Startdatum ${state.startDate} liegt in der Zukunft — nichts zu tun.`);
    process.exit(0);
  }
  return weekdaysInclusive(start, today);
}

// ── Prompt-Datei parsen (SYSTEM / USER / SCHEMA) ─────────────────
function loadPromptParts() {
  const raw = readFileSync(join(ROOT, "scripts", "prompt.md"), "utf8");
  // Trennlinien (## ─────) entfernen, damit die Marker eindeutig werden
  const clean = raw
    .split("\n")
    .filter((l) => !/^##\s*[─-]{3,}/.test(l))
    .join("\n");

  const iSys = clean.indexOf("## SYSTEM PROMPT");
  const iUser = clean.indexOf("## USER PROMPT");
  const iSchema = clean.indexOf("## DEEP_DIVE_SCHEMA");
  if (iSys < 0 || iUser < 0 || iSchema < 0) {
    throw new Error("prompt.md: SYSTEM/USER/SCHEMA-Marker nicht gefunden.");
  }

  const stripHeader = (s) => s.slice(s.indexOf("\n") + 1).trim();
  const system = stripHeader(clean.slice(iSys, iUser));
  const userTpl = stripHeader(clean.slice(iUser, iSchema));

  const schemaRaw = clean.slice(iSchema);
  const jStart = schemaRaw.indexOf("{");
  const jEnd = schemaRaw.lastIndexOf("}");
  const schema = JSON.parse(schemaRaw.slice(jStart, jEnd + 1));

  return { system, userTpl, schema };
}

// ── Werkzeug für Tag N aus dem Curriculum ───────────────────────
function lookupDay(dayNumber) {
  const curriculum = parseYaml(readFileSync(join(ROOT, "curriculum.yaml"), "utf8"));
  const total = curriculum.meta.total_days;
  if (dayNumber < 1) {
    console.log("Vor dem ersten Lerntag — nichts zu tun.");
    process.exit(0);
  }
  if (dayNumber > total) {
    console.log(`Tag ${dayNumber} > ${total}: Curriculum abgeschlossen. (Wildcard-/Vertiefungsmodus wäre der nächste Ausbauschritt.)`);
    process.exit(0);
  }
  const weekNumber = Math.ceil(dayNumber / 5);
  const dayInWeek = ((dayNumber - 1) % 5) + 1;
  const week = curriculum.weeks.find((w) => w.number === weekNumber);
  const day = week.days.find((d) => d.n === dayInWeek);
  const priorDays = week.days.filter((d) => d.n < dayInWeek);
  const priorText = priorDays.length
    ? priorDays.map((d) => `- Tag ${d.n}: ${d.tool}`).join("\n")
    : "— (erster Tag der Woche, kein Vorwissen aus dieser Woche)";
  return { curriculum, weekNumber, dayInWeek, week, day, priorText };
}

// ── Hauptlauf ───────────────────────────────────────────────────
const dayNumber = determineDay();
const { weekNumber, dayInWeek, week, day, priorText } = lookupDay(dayNumber);
const { system, userTpl, schema } = loadPromptParts();

const user = userTpl
  .replaceAll("{{day_number}}", String(dayNumber))
  .replaceAll("{{week_number}}", String(weekNumber))
  .replaceAll("{{day_in_week}}", String(dayInWeek))
  .replaceAll("{{week_theme}}", week.theme)
  .replaceAll("{{week_why}}", week.why)
  .replaceAll("{{tool}}", day.tool)
  .replaceAll("{{essence}}", day.essence)
  .replaceAll("{{thinker}}", String(day.thinker))
  .replaceAll("{{prior_tools_this_week}}", priorText);

console.log(`→ Erzeuge Tag ${dayNumber} (Woche ${weekNumber}): „${day.tool}" — ${day.thinker}`);

const client = new OpenAI(); // liest OPENAI_API_KEY aus der Umgebung
const resp = await client.responses.create({
  model: "gpt-5.6-sol",
  reasoning: { effort: "high" },
  max_output_tokens: 16000,
  input: [
    { role: "system", content: system },
    { role: "user", content: user },
  ],
  text: {
    format: { type: "json_schema", name: "deep_dive", strict: true, schema },
  },
});

const raw = resp.output_text;
if (!raw) throw new Error("Keine Textausgabe vom Modell erhalten.");
const deepDive = JSON.parse(raw);

// Metadaten anreichern
const now = new Date();
deepDive.day = dayNumber;
deepDive.week = weekNumber;
deepDive.date = now.toISOString().slice(0, 10);
deepDive.generated_at = now.toISOString();

if (dry) {
  console.log(JSON.stringify(deepDive, null, 2));
  console.log(`\n[dry-run] usage: in=${resp.usage.input_tokens} out=${resp.usage.output_tokens}`);
  process.exit(0);
}

// ── Schreiben ───────────────────────────────────────────────────
mkdirSync(ARCHIVE, { recursive: true });
const pad = String(dayNumber).padStart(2, "0");

writeFileSync(join(CONTENT, "latest.json"), JSON.stringify(deepDive, null, 2) + "\n");
writeFileSync(join(ARCHIVE, `day-${pad}.json`), JSON.stringify(deepDive, null, 2) + "\n");

// Archiv-Index aktualisieren (für den Archiv-Umschalter in der App)
const indexPath = join(CONTENT, "index.json");
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : [];
const entry = { day: dayNumber, week: weekNumber, tool: deepDive.tool, title: deepDive.title, date: deepDive.date };
const without = index.filter((e) => e.day !== dayNumber);
without.push(entry);
without.sort((a, b) => a.day - b.day);
writeFileSync(indexPath, JSON.stringify(without, null, 2) + "\n");

console.log(`✓ Tag ${dayNumber} geschrieben (in=${resp.usage.input_tokens} / out=${resp.usage.output_tokens} Tokens).`);
