// Safety-net script — runs once a day, server-side, via GitHub Actions.
//
// Purpose: if nobody has opened the page and pressed a button by the
// scheduled time, this makes sure the Google Sheet still gets *a* row for
// today, sourced from Dubai City of Gold, so tomorrow's color comparison
// never has to fall back to 2-day-old data.
//
// This does NOT render or publish a card image — it only guarantees a data
// point exists. If a real card is generated later the same day (by someone
// opening the page), that's a normal second entry for the day, handled the
// same way the page already handles any duplicate-same-day submission.
//
// No browser, no Chromium — plain server-side HTTP requests only, which
// aren't subject to the CORS restrictions a browser page has to work around.

const SHEET_CSV_URL   = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRub33VTkf7hfdese7_UisoO1l2p5d-mlfwOm87yk-RTIpButsdS7ItCzR--QEzmc0Kg65rix5a-2_3/pub?gid=248830664&single=true&output=csv";
const FORM_ACTION_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfguZexl6UCk9OrD5apwY670VnIDW-0OOEUQZEfsEEMtJ9aLw/formResponse";
const ENTRY_IDS = {
  '24': "entry.234121643",
  '22': "entry.2117019845",
  '21': "entry.1661776297",
  '18': "entry.1067166663",
  '14': "entry.1836842849",
};
const GOLD_SOURCE_URL = 'https://dubaicityofgold.com/';

function todayDubaiIso() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function isSameDubaiDay(timestampStr, todayIso) {
  const d = new Date(timestampStr);
  if (isNaN(d)) return false;
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(d) === todayIso;
}

// Minimal CSV parser — same logic as the page's, good enough for this
// Sheet's simple shape (no embedded commas/quotes expected in these columns).
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1);
}

async function fetchSheetRows() {
  const res = await fetch(SHEET_CSV_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (gold-card-fallback-bot)' } });
  if (!res.ok) throw new Error(`Sheet fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  return parseCSV(text).slice(1).filter(r => r.length >= 6 && r[1] !== '');
}

async function fetchGoldPricesFromSource() {
  const res = await fetch(GOLD_SOURCE_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (gold-card-fallback-bot)' } });
  if (!res.ok) throw new Error(`Source fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  console.log(`[fallback] Fetched source page directly (no relay needed server-side): ${html.length} chars`);

  const re = /sortd-gold-type[^>]*>\s*(\d+)K\s*Gold\s*<\/span>\s*<span[^>]*sortd-gold-value[^>]*>\s*AED\s*([\d,.]+)\s*<\/span>/gi;
  const found = {};
  let m;
  while ((m = re.exec(html)) !== null) {
    const karat = m[1];
    const val = parseFloat(m[2].replace(/,/g, ''));
    if (['24', '22', '21', '18', '14'].includes(karat) && !isNaN(val)) found[karat] = val;
  }
  const gotAll = ['24', '22', '21', '18', '14'].every(k => found[k] != null);
  if (!gotAll) {
    console.error(`[fallback] Only parsed ${Object.keys(found).length}/5 prices:`, found);
    console.error('[fallback] First 800 chars of fetched HTML for inspection:\n' + html.slice(0, 800));
    throw new Error('Could not parse all 5 prices from source HTML (site layout may have changed)');
  }
  return found;
}

async function submitToSheet(prices) {
  const body = new URLSearchParams();
  body.set(ENTRY_IDS['24'], prices['24']);
  body.set(ENTRY_IDS['22'], prices['22']);
  body.set(ENTRY_IDS['21'], prices['21']);
  body.set(ENTRY_IDS['18'], prices['18']);
  body.set(ENTRY_IDS['14'], prices['14']);
  // Server-side request — not subject to browser CORS, so unlike the page's
  // client-side submission we could read the response, but Google's
  // /formResponse endpoint doesn't return structured confirmation either
  // way. We verify success the same way the page does: re-check the Sheet.
  await fetch(FORM_ACTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0 (gold-card-fallback-bot)' },
    body,
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const todayIso = todayDubaiIso();
  console.log(`[fallback] Today (Asia/Dubai): ${todayIso}`);

  const rows = await fetchSheetRows();
  const lastRow = rows.length ? rows[rows.length - 1] : null;

  if (lastRow && isSameDubaiDay(lastRow[0], todayIso)) {
    console.log(`[fallback] Today's data already exists (last row: "${lastRow[0]}"). Nothing to do.`);
    return;
  }

  console.log('[fallback] No entry for today yet — fetching prices from Dubai City of Gold...');
  const prices = await fetchGoldPricesFromSource();
  console.log('[fallback] Parsed prices:', prices);

  await submitToSheet(prices);

  // Verify it actually landed, same pattern as the page's verifySaved().
  for (const delayMs of [2000, 3000, 4000]) {
    await sleep(delayMs);
    const freshRows = await fetchSheetRows();
    const freshLast = freshRows.length ? freshRows[freshRows.length - 1] : null;
    if (freshLast && isSameDubaiDay(freshLast[0], todayIso)) {
      console.log(`[fallback] Confirmed saved. New row: ${freshLast.join(', ')}`);
      return;
    }
  }

  throw new Error('Submitted to the Form but could not confirm the row landed in the Sheet within the expected time.');
}

main().catch(err => {
  console.error('[fallback] FAILED:', err.message);
  process.exit(1); // makes the GitHub Action show as failed, so it's visible in the Actions tab
});
