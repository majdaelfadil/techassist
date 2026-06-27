# IT Maintenance Training Dataset Pipeline

Automated pipeline that scrapes real-world IT incident reports from Reddit and technical forums, cleans and deduplicates them, labels them using the Grok AI API (two-pass), and outputs ML-ready JSONL and CSV files.

**Target:** 50,000–100,000+ labeled IT incidents  
**Output:** Train/validation/test splits in JSONL + full CSV

---

## Requirements

- Node.js 18+
- npm
- A Grok API key from [x.ai](https://x.ai) (only needed for the `label` step)

---

## Setup

### 1. Install dependencies

```bash
cd scraping
npm install
```

### 2. Configure environment

```bash
copy .env.example .env
```

Open `.env` and set your Grok API key:

```
GROK_API_KEY=your_key_here
GROK_MODEL=grok-3-mini
```

The rest of the defaults work without changes.

---

## Running the pipeline

### Option A — Full pipeline (all steps at once)

```bash
npm run pipeline
```

This runs all 7 stages in order: scrape → clean → deduplicate → filter → label → generate → report.

> Requires `GROK_API_KEY` to be set. If not set, labeling is skipped and a warning is shown.

---

### Option B — Step by step

Run each stage individually in order:

#### Step 1: Scrape

Scrape IT incidents from all sources (Reddit + forums):

```bash
npm run scrape
```

Scrape from a specific source only:

```bash
npm run scrape:reddit
npm run scrape:serverfault
npm run scrape:spiceworks
npm run scrape:tomshardware
npm run scrape:vendors
```

**What it does:**
- Reddit: Searches `old.reddit.com` using 360 IT maintenance keywords across 10 subreddits using Puppeteer (no Reddit API needed)
- ServerFault: Uses Stack Exchange API v2.3
- Spiceworks / Tom's Hardware / Vendor communities: Puppeteer-based scraping

**Output:** `data/raw/raw_incidents.jsonl`

---

#### Step 2: Clean

Remove short/low-quality posts, normalize text, extract device information:

```bash
npm run clean
```

**Output:** `data/processed/cleaned_incidents.jsonl`

---

#### Step 3: Deduplicate

Remove near-duplicate incidents using multilingual sentence embeddings (cosine similarity threshold: 0.92):

```bash
npm run deduplicate
```

**Output:** `data/processed/deduplicated_incidents.jsonl`

---

#### Step 4: Filter

Score each incident's resolution quality (0–10) and assign gold/silver/bronze tiers:

```bash
npm run filter
```

- **Gold:** score ≥ 6 + accepted answer + OP confirmation
- **Silver:** score ≥ 3
- **Bronze:** score ≥ 1

**Output:** annotates `data/processed/deduplicated_incidents.jsonl` in place

---

#### Step 5: Label

Label incidents using Grok AI (two-pass) + deterministic rule engine:

```bash
npm run label
```

**Requires `GROK_API_KEY` in `.env`.**

- **Pass 1 (Grok):** extracts `problem_summary`, `device_type`, `brand`, `model`
- **Pass 2 (Grok):** generates `probable_causes`, `recommended_actions`, `required_parts`, `prevention_advice` — each with per-value confidence scores
- **Rule engine (deterministic):** classifies `service_type`, `urgency`, `technician_profile` from keyword scoring — no AI for these fields
- Checkpoint file saves progress every 50 incidents — safe to stop and resume

**Output:** `data/processed/labeled_incidents.jsonl`

---

#### Step 6: Generate dataset

Build final JSONL/CSV files and stratified train/validation/test splits:

```bash
npm run generate
```

**Output files:**

| File | Description |
|------|-------------|
| `data/output/dataset.jsonl` | Full labeled dataset |
| `data/output/dataset.csv` | Flat CSV version |
| `data/output/training_dataset.jsonl` | 80% train split |
| `data/output/validation_dataset.jsonl` | 10% validation split |
| `data/output/test_dataset.jsonl` | 10% test split |
| `data/output/pipeline_stats.json` | Record counts per stage |

---

#### Step 7: Report

Print class balance analysis and write `dataset_report.json`:

```bash
npm run report
```

Shows distribution of `device_type`, `service_type`, `urgency`, `technician_profile`, top causes, top parts, and flags underrepresented / overrepresented classes.

**Output:** `data/output/dataset_report.json`

---

### Check pipeline progress at any time

```bash
npm run stats
```

---

## Reddit scraping — how it works

No Reddit API credentials are needed. The scraper uses Puppeteer to navigate `old.reddit.com` (plain HTML, no JavaScript) and searches with **360 IT maintenance keywords** across **10 subreddits**:

| Subreddits |
|-----------|
| r/techsupport, r/sysadmin, r/networking, r/homelab |
| r/Ubiquiti, r/Cisco, r/HomeNetworking, r/computerrepair |
| r/printers, r/cctv |

**Keyword categories (30 keywords each):**

- Desktop PCs — slow, freeze, BSOD, boot loop, hardware failures
- Laptops — battery, screen, keyboard, overheating, charging port
- Printers — offline, paper jam, driver, toner, spooler
- Routers — offline, DNS, NAT, firmware, WAN failure
- Switches — port failure, VLAN, STP, PoE, broadcast storm
- Firewalls — VPN, rules, NAT, high CPU, interface down
- Access Points / WiFi — disconnecting, roaming, SSID, interference
- CCTV Cameras — offline, no video, night vision, PoE, stream
- NVR / DVR — recording, disk failure, playback, storage
- Servers — crash, RAID, backup, VMware, Active Directory
- UPS / Power — battery failure, overload, inverter, alarm
- Generic — offline, failure, timeout, authentication, firmware

---

## Output schema (per labeled incident)

```json
{
  "problem_description": "...",
  "device_type": "Router",
  "device_brand": "Cisco",
  "device_model": "RV345",
  "service_type": "Depannage",
  "urgency": "HAUTE",
  "probable_causes": ["Firmware bug", "Power fluctuation"],
  "recommended_actions": ["Update firmware", "Check power supply"],
  "required_parts": ["Power adapter"],
  "technician_profile": "Network Engineer",
  "prevention_advice": ["Schedule firmware updates", "Use UPS"],
  "label_quality": "gold",
  "source": "reddit/r/Cisco",
  "source_url": "https://old.reddit.com/r/Cisco/comments/...",
  "confidence_score": 0.87
}
```

---

## Configuration reference (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `GROK_API_KEY` | — | **Required for labeling** |
| `GROK_MODEL` | `grok-3-mini` | `grok-3-mini` (fast) or `grok-3` (higher quality) |
| `MAX_INCIDENTS_PER_SOURCE` | `10000` | Cap per scraping source |
| `MIN_BODY_LENGTH` | `50` | Minimum post body length in characters |
| `DEDUP_SIMILARITY_THRESHOLD` | `0.92` | Cosine similarity threshold for deduplication |
| `CONFIDENCE_THRESHOLD` | `0.60` | Minimum AI confidence score to keep a field value |
| `RESOLUTION_SCORE_THRESHOLD` | `1` | Minimum quality score for labeling (0–10) |
| `HEADLESS` | `true` | Set `false` to see the browser during scraping |
| `TRAIN_SPLIT` | `0.80` | Fraction for training set |
| `VALID_SPLIT` | `0.10` | Fraction for validation set |

---

## Troubleshooting

**Puppeteer fails to launch on Windows**

Install the required Chromium dependencies or use the bundled browser:

```bash
npx puppeteer browsers install chrome
```

**Grok API rate limit errors (429)**

The labeler automatically retries with exponential backoff. If it keeps failing, reduce `LABEL_BATCH_SIZE` in `.env` to `1`.

**Resume interrupted labeling**

Just run `npm run label` again. Progress is saved every 50 incidents in `data/processed/labeling_checkpoint.json`.

**Memory errors during deduplication**

The embedding model (`intfloat/multilingual-e5-base`) is quantized and loads on first run (~150 MB). If RAM is insufficient, reduce `MAX_INCIDENTS_PER_SOURCE` before scraping.
