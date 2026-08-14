# Daily Gold Price Card — Setup Guide

This gives you exactly what you asked for:
- Date fills itself in (today, Dubai time).
- Time defaults to 10:00 AM, editable.
- You only ever type the **AED** price for each karat — on the same page, one button, no switching tabs.
- EUR / USD / SAR are calculated automatically from live exchange rates.
- Green / red / white is decided automatically by comparing to yesterday's numbers — no manual coloring.
- Works from a different laptop every day, because the "yesterday" data lives online (a Google Sheet), not on any one machine, and no one needs to sign in to read or write it.

**How the single page pulls this off:** typing your 5 AED numbers and clicking the button does two things silently in the background — it reads yesterday's row from your Sheet for the color comparison, and it submits today's numbers to a Google Form (which feeds the same Sheet) so tomorrow's card can compare against it. You never see or visit the Form.

It has two parts. **Do Part 1 first — one-time setup, about 10 minutes.**

---

## Part 1 — One-time setup

### 1. Create the Google Form (this is the invisible "database writer")

1. Go to [forms.google.com](https://forms.google.com) → new blank form.
2. Add 5 questions, all type **"Short answer"** with response validation set to **Number**, in this exact order:
   - `24` (عيار 24 — AED)
   - `22` (عيار 22 — AED)
   - `21` (عيار 21 — AED)
   - `18` (عيار 18 — AED)
   - `14` (عيار 14 — AED)
3. Check **Settings → Responses** and make sure "Restrict to users in your organization" is **off** (so submissions work without sign-in).
4. You will never open this Form again day-to-day — it's just the pipe into your Sheet.

### 2. Link it to a Sheet and publish that Sheet as CSV (for reading)

1. In the Form, go to **Responses** → click the green Sheets icon → **Create a new spreadsheet**.
2. Open that Sheet → **File → Share → Publish to web** → format **Comma-separated values (.csv)** → **Publish**.
3. Copy the URL — looks like `https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv`. This is what the page reads yesterday's prices from.

### 3. Get the Form's submit URL and field IDs (for writing)

1. In the Form editor, click the **⋮** menu (top right) → **Get pre-filled link**.
2. Type a different dummy number in each of the 5 fields (e.g. 1, 2, 3, 4, 5) so you can tell them apart, then click **Get link**, then **Copy link**.
3. Paste that link somewhere you can read it — it looks like:
   `https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform?usp=pp_url&entry.111111111=1&entry.222222222=2&entry.333333333=3&entry.444444444=4&entry.555555555=5`
4. Match each `entry.XXXXXXXXX=N` to the karat you typed there (the one set to `1` is عيار24, `2` is عيار22, and so on).
5. Your **form action URL** is the same link but ending in `/formResponse` instead of `/viewform` — e.g.
   `https://docs.google.com/forms/d/e/1FAIpQLSc.../formResponse`

### 4. Fill in the config at the top of `index.html`

Open `index.html` in any text editor and fill in the four placeholders near the top of the `<script>` section:

```js
const SHEET_CSV_URL   = "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv";
const FORM_ACTION_URL = "https://docs.google.com/forms/d/e/1FAIpQLSc.../formResponse";
const ENTRY_IDS = {
  '24': "entry.111111111",
  '22': "entry.222222222",
  '21': "entry.333333333",
  '18': "entry.444444444",
  '14': "entry.555555555",
};
```

### 5. Put the webpage on GitHub Pages

1. Create a new GitHub repo (e.g. `gold-price-card`), public.
2. Upload the edited `index.html` to the repo root.
3. Repo **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main` / root → Save.
4. After a minute, your page is live at `https://<your-username>.github.io/gold-price-card/`.

That's the whole one-time setup — you won't touch the Form, the config, or GitHub settings again.

---

## Fonts

Your original Avenir Black / Avenir Medium fonts are now embedded directly inside `index.html` — nothing to upload separately, nothing that can go missing. Price numbers use Avenir Black, the date/time uses Avenir Medium, matching your PSD exactly.

---

## Exchange rate source

The page uses **[fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api)** (the project was renamed from `currency-api` — same author, same data, same URLs still work), a free, keyless, open-source exchange rate feed served over jsDelivr's CDN. A few things worth knowing:

- **You never have to touch the code for it.** It's a live URL the page calls every time you click the button — it always returns the current rate, automatically, forever (or until the project is discontinued, which is the one real risk of any free API — see below).
- **Update frequency:** the maintainer refreshes it roughly once every 24 hours, not tick-by-tick. That matches how your original card worked (a daily 10 AM snapshot), so it's not a functional downgrade.
- **No key, no signup, no rate limit** for reasonable personal use like this.
- **Reliability:** it's a well-established community project (100M+ downloads), but it's still a free/volunteer-run service, not an SLA-backed paid API. If it ever goes down permanently, the page's FX calls would start failing (you'd see an error in the status line, and could still fall back to typing all 4 currencies by hand as a stopgap while a replacement source gets wired in).
- **If you'd rather use a specific bank's or exchange's official rate** instead, that's a one-line change (swap the `fetchFx()` URL) — let me know and I can switch it.

## Part 2 — Your daily routine

**Important: always use your live GitHub Pages link (`https://...github.io/...`), never open `index.html` directly as a local file.** Background saves to Google Sheets are blocked silently when run from a local file — the page will look like it worked but nothing will actually save. Hosted over `https://`, it works correctly, and the page now double-checks the save and tells you clearly if something went wrong (see below).

1. Open your GitHub Pages link (bookmark it — same link works on every laptop).
2. Type the 5 AED prices for today.
3. Adjust the time if it's not 10:00 AM.
4. Click **"إنشاء البطاقة وحفظ اليوم"**. The page reads yesterday's row, submits today's row in the background, computes EUR/USD/SAR from live rates, and colors every cell — all in one step, on one page.
   - If today's prices were already submitted earlier (by you or from another device), you'll get a confirmation popup before it saves a second entry for today — so an accidental double-click or double-run doesn't quietly duplicate your day's data. Choosing "Cancel" still renders/downloads the card, it just skips saving again.
5. Click **"تحميل الصورة PNG"** to download the finished card.

---

## Troubleshooting: "saved" but nothing shows up in the Sheet

1. **First, confirm you're on the `https://...github.io/...` link**, not a local file (see note above — this is the #1 cause).
2. If you are on the live link and it still can't confirm: open your pre-filled link from Setup Step 3 again, submit it with test values, and check the Sheet updates. If it doesn't, the Form itself may have changed (e.g. a question was edited/reordered) — you'd need to regenerate the entry IDs and I can rebuild the config.
3. If manual pre-filled-link submissions work but the page's background submission doesn't, double check the `FORM_ACTION_URL` in `index.html` ends in `/formResponse`, not `/viewform`.

If the Sheet is briefly unreachable, the card still renders (just without the color comparison — everything shows white until the Sheet is reachable again).

---

## Part 3 — Optional: generate from GitHub directly (no page needed)

Since the AED prices are the one thing only you know each day, full unattended automation isn't possible without them coming from somewhere — but if you'd rather type them into a GitHub form than open the webpage, the repo includes a workflow for that: **Actions tab → "Generate daily gold price card" → Run workflow**, type the 5 AED prices into the boxes, run it. It opens the page in a headless browser, submits and renders exactly like the button does, and commits the finished PNG to `output/gold-price-card.png` in the repo.

This is entirely optional — the webpage itself is already the simplest path for daily use.

---

## Notes

- The card design itself (background, logos, table lines, footer, gold-bar photo) is untouched — only the date, time, and 20 price numbers are generated dynamically.
- Exchange rates come from a free, keyless public API (`fawazahmed0/currency-api` via jsDelivr), refreshed daily. If you'd rather use a specific rate source (e.g. your own bank's rate), let me know and I can swap it in.
- Colors: green = higher than yesterday, red = lower, white = unchanged (matches your original AED/SAR/USD/EUR pattern where each currency is compared independently).
