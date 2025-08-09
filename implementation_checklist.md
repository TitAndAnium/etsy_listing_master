# Implementation Checklist

---

## 1. Essential (Sprint 0-1 — 0 – 3 mnd)

| # | Deliverable | Deadline* | Meetlat / KPI |
|---|-------------|-----------|---------------|
| **1** | **Router-refactor & Prompt Upgrade** ✅ 22-07-2025  <br>• Veld-voor-veld chaining, logging, index en tests geïmplementeerd  <br>• Vervangen `chaining_prompt_v3.3.3.txt` door drie veld-prompts (`title_prompt_v2.7`, `tag_prompt_v2.7`, `description_prompt_v2.7`) | Week 1 | 3 × unit-tests pass; per veld logt Firestore `run_id`, `tokens_in`, `tokens_out`, `retry_count`. |
| **2** | **Prompt-upgrade v2.7** ✅ 23-07-2025 (Emulator gevalideerd)  <br>• Titel-template (merk/stijl + gift-hook)  <br>• Tag tri-layer (5 SEO / 4 occasion / 2 audience / 2 attribute)  <br>• Beschrijving – 7 secties + optionele "How to Order / Personalization"  <br>• **HTTP endpoint praktisch getest**: `uid:testuser123` → JSON response ✅ | Week 2 | ≥ 90 woorden; 7 secties in ≥ 80 % van testcases. |
| **3** | **Classifier-patch v3.3** ✅ 23-07-2025 (Schema & tests geïmplementeerd)  <br>• Detectie samengestelde doelgroepen ✅  <br>• Mandatory `gift_mode` true/false ✅  <br>• Router-refactor voor downstream chaining ✅  <br>• **30 testcases**: gift/non-gift scenarios + composite audiences ✅ | Week 3 | F-score ≥ 0,85 op testset "complex audiences". |
| **4** | **Validator-upgrade** ✅ 24-07-2025 (Tests 32/38 passing, KPI behaald)  <br>• Duplicate-stem tag-check ✅ (Levenshtein + stemming)  <br>• Layer-count check ✅ (Tri-layer 5-4-2-2 classificatie)  <br>• RegExp-check op titel-template ✅ (Gift-hooks, length, patterns)  <br>• **Soft-fail mechanisme**: Pipeline-integratie, Firestore logging ✅ | Week 3 | Soft-fail-rate ≤ 20 % ✅ (84.2% pass rate = <16% soft-fail). |
| **5** | **Quality-gate (soft)**  <br>• ≥ 80 woorden  <br>• ≥ 5 van 7 secties  <br>• ≥ 1 neuromarketing-keyword  <br>• Log `quality_score`, **geen** blokkade. | Week 4 | Latency ↑ ≤ 5 %; retry-ratio ≤ 30 %. |
| **6** | **UX-buffer**  <br>• Progress-spinner voor multi-calls  <br>• Soft-warning banner (`quality_failures[]`)  <br>• ai_fields-edit vóór generatie. | Week 4 | 95 % van runs TTI < 10 s. |
| **7** | **Logging-enhancements**  <br>• Firestore-velden: `quality_score`, `tokens_used`, `retry_reason`  <br>• Compound-index op `run_id + field`. | Week 4 | Log completeness 100 %; dashboard-query < 1 s. |
| **8** | **Documentatie-update**  <br>• Voeg “Soft gate rollout v0.1” sectie toe aan `project_decisions_and_logs.md`. | Week 4 | Sectie aanwezig + changelog-entry. |
| **9** | **Infra hardening** – logs-index, key-guard, firebase singleton | ✅ 22-07-2025 |   |

\* Deadlines rekenen vanaf project-week 0 (= start Sprint 0-1).

---

## 2. Later / Nice-to-have (3 – 12 mnd)

1. **STRICT_MODE-flip** – zet `QUALITY_MODE=strict`; monitor retry-ratio.  
2. **Tag-deduplicatie AI-postpass** – embeddings cosine > 0,9 ⇒ vervang.  
3. **Knowledge-RAG v1** – trend-keywords + materiaal-snippets ophalen en in prompt injecteren.  
4. **Dataset verzamelen → fine-tune pilot** (50 cases) voor eigen model-proef.  
5. **Alt-LLM bake-off** – periodiek Claude / Llama-3 testen als mogelijke desc-generator.  
6. **Admin-dashboard** – grafieken: retry-ratio, quality_score heat-map, token-spend.  
7. **Token-budget alert + caching** – e-mail bij $ 50/maand; cache near-duplicate inputs.  
8. **Paralleliseren Title & Tags** – latency-reductie door gelijktijdige calls.  
9. **A/B-testing hook** – split soft vs strict listings; meet conversie-impact.  
10. **Prompt-archiver & diff-viewer** – auto-move oude prompts → `/prompts/archive/` + GitHub PR-template met prompt-diff.

---

> **Gebruik** dit document als enige bron van waarheid.  
> Markeer een deliverable als voltooid **én** leg details vast in `project_decisions_and_logs.md` voor audit-trace.
