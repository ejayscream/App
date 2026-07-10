# Die Kunst des Denkens und Entscheidens

Eine private iPhone-App (PWA), die dir jeden Werktag **ein Denkwerkzeug** beibringt —
aus dem Kanon der klügsten Köpfe zum Thema klar denken und gut entscheiden.

- **Format:** 1 Deep-Dive/Tag → Konzept · Beispiel · typischer Fehler · Frage des Tages
- **Struktur:** 12 Wochen × 5 Tage = 60 Werkzeuge (`curriculum.yaml`)
- **Motor:** GitHub Action generiert nachts via OpenAI API den Tag → App lädt ihn morgens
- **Kosten:** ~0,12–0,18 € pro Tag (OpenAI `gpt-5.6-sol`, inkl. Reasoning) ≈ 2,50–3,50 €/Monat

## Aufbau

```
curriculum.yaml            # die 60 Werkzeuge (Lehrplan)
scripts/prompt.md          # der tägliche Claude-Prompt (System + User + JSON-Schema)
scripts/generate.mjs       # Generator: Tag berechnen → OpenAI → JSON schreiben
content/state.json         # Startdatum (steuert, welcher Tag heute dran ist)
content/latest.json        # der heutige Deep-Dive (die App liest das)
content/archive/day-NN.json# vergangene Tage
content/index.json         # Liste für den Archiv-Umschalter
index.html · app.js · style.css · manifest.webmanifest · sw.js · icon.svg   # die PWA
.github/workflows/daily.yml# der tägliche Cron-Job
```

## Einrichtung (einmalig)

1. **Repo anlegen** und diesen Ordner pushen (z. B. `github.com/DEINNAME/denken`).
2. **API-Key hinterlegen:** Repo → *Settings → Secrets and variables → Actions →
   New repository secret* → Name `OPENAI_API_KEY`, Wert = dein OpenAI-API-Key.
3. **Startdatum setzen:** in `content/state.json` `startDate` auf den ersten
   Lerntag (einen Montag) legen.
4. **GitHub Pages aktivieren:** Repo → *Settings → Pages →* Branch `main`, Ordner
   `/ (root)`. Deine URL: `https://DEINNAME.github.io/denken/`.
5. **Auf dem iPhone öffnen** → Teilen-Symbol → *Zum Home-Bildschirm*. Fertig.

Der Cron läuft an Werktagen um 05:00 UTC. Zum sofortigen Testen: Repo →
*Actions → „Täglicher Deep-Dive" → Run workflow*.

## Lokal testen

```bash
npm install
export OPENAI_API_KEY=sk-...
node scripts/generate.mjs --day=3 --dry   # erzeugt Tag 3, gibt JSON aus, schreibt nichts
```

Vorschau der App (die JSON-Dateien brauchen einen kleinen Server, `file://` reicht nicht):

```bash
npx serve .        # oder: python -m http.server
```

## Anpassen

- **Andere Startzeit:** `cron` in `.github/workflows/daily.yml` ändern (immer UTC).
- **Inhalt/Ton:** `scripts/prompt.md` bearbeiten.
- **Lehrplan:** `curriculum.yaml` bearbeiten.
- **Icon:** `icon.svg` ersetzen (für iOS-Home-Bildschirm ist ein PNG als
  `apple-touch-icon` optional noch schöner).

## Hinweise

- GitHub-Cron kann sich um einige Minuten verspäten — für ein Morgen-Briefing egal.
- Scheduled Workflows pausieren nach 60 Tagen ohne Repo-Aktivität; der tägliche
  Commit hält sie selbst am Leben.
- Nach Tag 60 stoppt der Generator (Vertiefungs-/Wildcard-Modus wäre der nächste Ausbauschritt).
