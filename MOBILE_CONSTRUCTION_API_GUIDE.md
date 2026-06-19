# Construction module — mobile integration guide

This document explains how the **Stages (Bosqichlar)** screen and related construction
data are modeled on the backend, the two bugs that were observed in mobile, and the
**exact APIs** mobile should call. All paths are relative to the API base
(`/api/v1`). All endpoints are tenant-scoped via the auth token and respect the active
organization header the web client already sends.

---

## TL;DR — the two mobile bugs

1. **"Bu bosqichda hali ishlar yo'q" (stage shows no works) even though works exist.**
   Works are **not** linked to a stage by a `stage_id` foreign key. A stage maps to its
   works by matching the estimate line's **`parent_item_number`** against the stage's
   **`section_key`**, and the real data often carries a `"СЕКЦИЯ №N › …"` prefix.
   → **Fix:** call **`GET /construction/stages/{stageId}/works`**, which does the
   prefix-tolerant match server-side. Do **not** filter works by `stage_id`.

2. **Screen title shows "Наименование объекта -".**
   The title is being taken from the project field `object_full_name`, which is a
   **Forma/КС-2 document field** that is normally empty (the web never uses it as a
   title and omits it entirely when blank).
   → **Fix:** title the screen with **`project.name`** (what the web uses).
   Use `object_full_name` only inside Forma 2 / Forma 19 / act documents, and only
   when it is non-empty.

---

## Data model primer (read this first)

- A construction **project** has many **buildings** ("blocks", e.g. "А Блок 1 Тип-3").
- Each block's smeta is an **estimate** (`construction_estimate`). The estimate used for
  the Bosqichlar / works tree has `source_type = 'edinich'`. (There can also be a `vor`
  estimate used for template quantities.)
- A **"work"** is a top-level estimate line: a `construction_estimate_line` row with
  **`parent_line_id` empty AND `resource_type` empty**. Rows that have a `resource_type`
  (labor/equipment/material) are **resources of a work**, not works.
- **Sections / stages** are the distinct **`parent_item_number`** values across those
  works (e.g. "ОБЩЕСТРОИТЕЛЬНЫЕ РАБОТЫ(КЖ)"). The `construction_stages` table holds a row
  per section; each stage's **`section_key` = its name = the `parent_item_number` leaf**
  it groups. **There is no `stage_id` column on the work lines** — the link is by name.
- Plan quantity for a work resolves as `imported_quantity → original_quantity → quantity`
  (first non-zero). `done_quantity` is the executed amount.
- Progress is **cost-weighted**: `Σ(total_amount × min(done_qty/plan_qty, 1)) / Σ(total_amount)`.

---

## Correct flow for the Stages (Bosqichlar) screen

```
1. GET /construction/projects/{projectId}                 → project (title = project.name)
2. GET /construction/projects/{projectId}/buildings       → blocks; user picks one (building_id)
3. GET /construction/projects/{projectId}/stages          → stages for the project
                                                            (each has id, name, section_key, sub_stages,
                                                             status, totals)
4. For the selected stage:
   GET /construction/stages/{stageId}/works               → that stage's works (DO NOT match by stage_id)
5. (optional, server-computed progress so mobile doesn't calculate):
   GET /construction/estimates/{estimateId}/stages-progress
```

To find the block's `estimateId` for step 5: `GET /construction/projects/{id}/estimates`
and pick the building's estimate with `source_type = 'edinich'`.

---

## Endpoint reference

### Project / title
- **`GET /construction/projects/{id}`** → project object.
  - Use **`name`** for the screen title.
  - `object_full_name` is the Forma "Наименование объекта" field — **do not use as a
    title**; use only in Forma documents and only when non-empty.

### Blocks
- **`GET /construction/projects/{id}/buildings`** → array of blocks
  (`id`, `name`, …). The user selects one.

### Stages list
- **`GET /construction/projects/{id}/stages`** → array of stages. Key fields per stage:
  - `id`, `name`, **`section_key`** (the `parent_item_number` this stage groups),
    `status`, `stage_order`, `planned_budget`, `material_total`, `equipment_total`,
    `labor_total`, and nested **`sub_stages[]`**.
  - Map a stage → works **only** via the `/stages/{id}/works` endpoint below (or, if you
    must do it client-side, match `parent_item_number` to `section_key` *as a leaf*,
    tolerating a `"СЕКЦИЯ №N › "` prefix).

### Stage works  ← the fix for bug #1
- **`GET /construction/stages/{stageId}/works`** → the works belonging to that stage,
  matched server-side on the section name (prefix-tolerant). Each work includes
  `id`, `item_number`, `code`, `name`, `uom`, `quantity`, `done_quantity`,
  `unit_rate`, `total_amount`. This is the endpoint the backend explicitly intends mobile
  to use.
- **`GET /construction/stages/{stageId}/sub-stages`** → sub-stages of a stage.

### Progress / overview (server-computed — prefer these over computing on device)
- **`GET /construction/projects/{id}/stages/overview`** → block-level rollup:
  `blocks_count`, `stages_count`, `works_count`, `budget`, `block_readiness_percent`,
  `budget_hidden` (true for the `foreman` role — hide money when true).
- **`GET /construction/estimates/{id}/stages-progress`** → per-section + overall
  **cost-weighted progress** for one block, with each work's own ratio:
  ```json
  { "estimate_id": 30, "progress_pct": 1.2, "plan_cost": …, "done_cost": …, "works_count": 164,
    "sections": [ { "section": "ОБЩЕСТРОИТЕЛЬНЫЕ РАБОТЫ(КЖ)", "works_count": 25,
        "plan_cost": …, "done_cost": …, "progress_pct": 1.0,
        "works": [ { "id":…, "item_number":"1", "name":"…", "quantity":2305,
          "done_quantity":0, "total_amount":…, "progress_pct":0 } ] } ] }
  ```
- **`GET /construction/projects/{id}/in-progress`** → flat feed of items currently
  `in_progress` with a computed `progress_pct` (for a "what's active now" view).

### Estimate lines & KPIs
- **`GET /construction/estimates/{id}/lines?page=&page_size=20`** → paginated lines.
  Each line already carries a server-computed **`total_amount`** (= `unit_rate × quantity`),
  and resource `quantity` is the **persisted cascade** (`parent.quantity × norm_rate`) —
  mobile does **not** need to compute either.
- **`GET /construction/estimates/{id}/summary`** → headline KPI cards without loading the
  whole estimate: `labor`, `machines`, `materials`, `grand`, `work_count`, `filled_count`,
  `resource_count`. Sum across the block's estimate ids if a block spans several.
- **`GET /construction/estimates/{id}/forma2-summary?other_pct=0&vat=true`** → the Forma 2
  money roll-up (overhead 7%/3.2%/3.5%, "прочие", VAT 12%, grand total) — see fields
  `labor, machines, mat_standard, mat_equipment, mat_cable, overhead_*, other, subtotal,
  vat, grand`. Use this instead of replicating the Forma 2 math on device.

---

## Rules of thumb for mobile

- **Never** join works to stages by `stage_id` — that column does not exist on work lines.
  Use `/stages/{id}/works`.
- **Title** = `project.name`. `object_full_name` is a Forma-only field, usually empty.
- **Don't recompute money or progress on device** — the backend now returns line totals,
  the resource quantity cascade, KPI summaries, cost-weighted stage progress, and the
  Forma 2 roll-up. Computing them client-side risks drifting from the web numbers.
- A work = `parent_line_id` empty **and** `resource_type` empty. Anything with a
  `resource_type` is a resource of a work, not a work.
- Respect `budget_hidden` from the overview endpoint (hide amounts for the `foreman` role).
