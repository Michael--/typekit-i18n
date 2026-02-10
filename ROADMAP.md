# Typekit i18n - Projektplan

Status: Arbeitsplan zum gemeinsamen Abarbeiten und Abhaken.

Hinweis:

- Aktueller Stand ist eine Blaupause mit bewusst vorlaeufigen Dateiorten.
- `typecheck`/`test` sind derzeit nicht als Release-Gate zu verstehen, bis die Zielstruktur steht.

## Phase -1 - Strukturmigration vorbereiten

- [x] Zielstruktur festlegen (wohin `ts/translations`, `scripts`, spaetere Pakete wandern).
- [x] Monorepo-Benennung festgelegt:
- [x] `packages/typekit-i18n` als konsolidiertes, spaeter publishbares npm-Paket
- [x] `apps/playground-ts` als Integrations-App
- [x] `apps/docs-site` als VitePress-Doku-App
- [ ] Bestehende Fragmente als "reference only" markieren und Mapping Alt->Neu dokumentieren.
- [ ] Root-Package schrittweise reduzieren, so dass dort vor allem Dev-Dependencies/Workspace-Tooling verbleiben.
- [ ] Erst nach Umzug: `typecheck`/`test` als harte Gates aktivieren.

## Phase 0 - Ausgangslage sichern

- [x] Blaupause aus Helio10 in separates Projekt uebernommen (`sessionX.jsonl`, `ts/translations`, `scripts/`).
- [x] Aktuellen Stand kurz dokumentieren (`README.md`: Ziel, aktueller Umfang, bekannte Luecken).
- [x] Mindestanforderungen definieren (Node/TS-Version, Build-/Test-Setup).

## Phase 1 - Produkt-Schnitt festlegen

- [x] Scope fuer v1 festlegen: "Type-safe i18n Toolkit fuer TS-Projekte".
- [x] Non-Goals dokumentieren (z. B. kein Full-CMS, kein Runtime-Editor in v1).
- [x] API-Form festlegen:
- [x] `translate(key, language, placeholders?)`
- [x] `supportedLanguages`
- [x] Fallback-Verhalten (Default-Sprache, Warnungen, Fehler-Modus)
- [ ] Datenvertrag fuer Translation-Ressourcen festlegen (CSV-Spalten, Pflichtfelder, Encoding).

## Phase 2 - Datenmodell und Codegen haerten

- [ ] `translation*.csv` Schema validieren (fehlende Keys, doppelte Keys, leere Pflichtwerte).
- [ ] Generator robust machen (`scripts/translation-generator.ts`):
- [ ] deterministische Dateireihenfolge
- [ ] escaping/sicheres String-Handling
- [ ] klare Fehlerausgaben mit Datei/Zeile
- [ ] Generierten Output trennen in:
- [ ] `translationTable.ts` (Daten)
- [ ] `translationKeys.ts` oder Typ-Exports (API klar halten)
- [ ] Placeholder-Typisierung ausbauen (`translationTypes.ts`), damit Werte nicht nur `string` sein muessen.

## Phase 3 - Laufzeit-API stabilisieren

- [ ] Runtime API von internem Datenlayout entkoppeln (`translation.ts` als stabile Public API).
- [ ] Fallback-Strategie konfigurierbar machen (strict vs. fallback).
- [ ] Entwicklerfreundliche Diagnostik:
- [ ] fehlende Uebersetzungen sammeln/reporten
- [ ] optionales Logging statt festem `console.warn`
- [ ] Optional: kleine Formatter-Schicht fuer Placeholder (z. B. Zahlen/Datum-Hooks).

## Phase 4 - Qualitaet und Tests

- [ ] Testmatrix erweitern (nicht nur Happy Path):
- [ ] fehlender Key / fehlende Sprache / leerer Text
- [ ] Placeholder-Ersatz mehrfach im String
- [ ] Fallback auf Default-Sprache
- [ ] Generator-Tests fuer CSV-Parsing und Output-Snapshots.
- [ ] CI-Checks definieren:
- [ ] `typecheck`
- [ ] `test`
- [ ] `generate && git diff --exit-code` (Codegen drift verhindern)

## Phase 5 - Packaging und DX

- [ ] Paketstruktur festlegen:
- [x] `packages/typekit-i18n` als v1 Paket (konsolidiert statt frueher Aufsplittung)
- [ ] Optional spaeteres Splitten nur bei realem Bedarf (z. B. separate Provider/Targets)
- [ ] CLI fuer Codegen bereitstellen (`typekit-i18n generate`).
- [ ] Konfigurationsdatei definieren (`typekit-i18n.config.ts/json`).
- [ ] SemVer + Release-Prozess aufsetzen (changelog, tags, npm publishing).

## Phase 6 - Mehrsprachige Targets (TS + Swift)

- [ ] Zielbild fuer Multi-Target festlegen:
- [ ] nur TypeScript in v1
- [ ] Swift-Generator als v1.1/v2
- [ ] Swift-Output-Konzept aus bestehendem Codegen ableiten (`scripts/codegen/generate-swift-api.mjs`).
- [ ] Gemeinsames neutrales Zwischenmodell definieren (IR), aus dem TS/Swift generiert werden kann.
- [ ] Entscheidung dokumentieren: Library-only vs. Service/Interface-Ansatz fuer andere Sprachen.

## Phase 7 - Uebersetzungs-Workflow (manuell + Cloud)

- [ ] Manueller Workflow sauber machen:
- [ ] neue Keys anlegen
- [ ] Missing-Entries reporten
- [ ] Review-Prozess fuer Uebersetzungen
- [ ] Provider-Interface definieren (abstrakt), noch ohne harte Bindung:
- [ ] `translateBatch(sourceLang, targetLang, entries)`
- [ ] Kosten-/Rate-Limits/Retry-Konzept
- [ ] OpenAI/DeepL als optionale Adapter einplanen (nicht im Core erzwingen).

## Phase 8 - Dokumentation und Adoption

- [ ] Kurzes "Getting Started" mit Minimalbeispiel.
- [ ] "How it works" (CSV -> Codegen -> Runtime API) als Diagramm/Abschnitt.
- [ ] Migrationsleitfaden fuer bestehende Projekte (z. B. Helio10 -> Toolkit).
- [ ] Beitragspfad (`CONTRIBUTING.md`) fuer interne/externe Mitarbeit.

## Offene Entscheidungen

- [ ] Name/Fokus final: nur i18n oder allgemein "typed text resources"?
- [ ] Default-Sprache fix (`en`) oder pro Projekt konfigurierbar?
- [ ] CSV bleibt Primarformat oder spaeter JSON/YAML optional?
- [ ] Swift in Core-Roadmap oder als separates Plugin-Repo?
- [ ] Cloud-Uebersetzung direkt im Toolkit oder bewusst externes Tooling?

## Naechster konkreter Schritt

- [x] Phase 1 abschliessen: v1 Scope + Public API in einem kurzen `README`-Entwurf festhalten.
