// One-off: import a Takeout HTML watch-history + music library CSV into
// Marusic for one user. Dry-run by default; pass --commit to write.
//
// Local mode (writes the SQLite file directly, run from the repo root):
//   node --experimental-sqlite import-takeout-html.js <takeoutDir> <email> [--commit]
//
// Remote mode (talks to a running instance over its API — use this for the
// NAS; the instance must run a build with /api/import/youtube):
//   set MARUSIC_PASSWORD=...   (your login password, via env — not argv)
//   node import-takeout-html.js <takeoutDir> <email> --server https://your-host [--commit]
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const serverIx = args.indexOf("--server");
const server = serverIx >= 0 ? String(args[serverIx + 1] || "").replace(/\/+$/, "") : "";
const [dir, email] = args.filter((a) => a !== "--commit" && a !== "--server" && a !== server);
if (!dir || !email) {
  console.error("usage: node import-takeout-html.js <takeoutDir> <email> [--server URL] [--commit]");
  process.exit(1);
}

const decode = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
   .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
   .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");

/* ---------------- watch-history.html → plays ---------------- */
const html = fs.readFileSync(path.join(dir, "history", "watch-history.html"), "utf8");
const blocks = html.split('<div class="outer-cell');
const byId = new Map();
let musicPlays = 0, videoPlays = 0, undated = 0;

for (const block of blocks.slice(1)) {
  const watch = block.match(/Watched\s*<a href="[^"]*[?&]v=([\w-]{6,20})[^"]*">([\s\S]*?)<\/a>/);
  if (!watch) continue; // removed videos, ads, search entries
  const isMusic =
    /mdl-typography--title">\s*YouTube Music</.test(block) ||
    block.includes("https://music.youtube.com/watch");
  if (!isMusic) { videoPlays++; continue; }
  musicPlays++;

  const id = watch[1];
  let title = decode(watch[2]).trim();
  const chan = block.slice(watch.index).match(/<a href="https:\/\/www\.youtube\.com\/channel\/[^"]*">([\s\S]*?)<\/a>/);
  const artist = chan ? decode(chan[1]).replace(/\s*-\s*Topic$/, "").trim() : "";
  // the HTML export writes "Artist - Title" as the link text — strip the echo
  if (artist && title.toLowerCase().startsWith(artist.toLowerCase() + " - "))
    title = title.slice(artist.length + 3).trim();

  const time = block.match(/(\w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2}:\d{2}\s*[AP]M)/);
  const at = time ? Date.parse(time[1]) || 0 : 0;
  if (!at) undated++;

  const cur = byId.get(id);
  if (cur) {
    cur.plays++;
    if (at > cur.lastPlayed) cur.lastPlayed = at;
  } else {
    byId.set(id, { id, title: title.slice(0, 200), artist: artist.slice(0, 120), plays: 1, lastPlayed: at });
  }
}

const songs = [...byId.values()]
  .sort((a, b) => b.plays - a.plays || b.lastPlayed - a.lastPlayed)
  .slice(0, 1000);

/* ---------------- music library songs.csv → likes ---------------- */
// tiny CSV reader that respects quoted fields
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (cell || row.length) { row.push(cell); rows.push(row); row = []; cell = ""; }
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const csvPath = path.join(dir, "music (library and uploads)", "music library songs.csv");
const libRows = fs.existsSync(csvPath) ? parseCsv(fs.readFileSync(csvPath, "utf8")).slice(1) : [];
const librarySongs = libRows
  .filter((r) => /^[\w-]{6,20}$/.test(r[0] || ""))
  .map((r) => ({
    id: r[0],
    title: (r[1] || "Unknown Title").slice(0, 200),
    album: (r[2] || "").slice(0, 200),
    artist: r.slice(3).filter(Boolean).join(", ").slice(0, 120),
    duration: 0,
    image: "",
  }));

/* ---------------- report ---------------- */
console.log(`target:        ${server || "local SQLite (data/marusic.sqlite)"}`);
console.log(`history rows:  ${musicPlays} music plays / ${videoPlays} regular videos skipped / ${undated} undated`);
console.log(`unique songs:  ${byId.size} → importing top ${songs.length}`);
console.log(`library CSV:   ${librarySongs.length} songs → liked`);
console.log("top of the import:");
for (const s of songs.slice(0, 10))
  console.log(`  ${String(s.plays).padStart(4)}x  ${s.title} — ${s.artist}  (last ${s.lastPlayed ? new Date(s.lastPlayed).toISOString().slice(0, 10) : "unknown"})`);

/* ---------------- write: remote (API) or local (SQLite) ---------------- */
if (server) {
  const password = process.env.MARUSIC_PASSWORD;
  if (!password) { console.error("\nset MARUSIC_PASSWORD for remote mode"); process.exit(1); }

  const login = await fetch(`${server}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) { console.error(`\nlogin failed: ${login.status} ${await login.text()}`); process.exit(1); }
  const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
  const auth = { Cookie: cookie, "Content-Type": "application/json" };

  const lib = await fetch(`${server}/api/library`, { headers: auth }).then((r) => r.json());
  if (!Array.isArray(lib.liked)) { console.error("\nunexpected /api/library response"); process.exit(1); }
  const already = new Set(lib.liked.map((s) => s.id));
  const toLike = librarySongs.filter((s) => !already.has(s.id));
  console.log(`\nsigned in as ${email}; ${toLike.length} of ${librarySongs.length} library songs not yet liked there`);

  if (!commit) { console.log("DRY RUN — nothing written. Re-run with --commit."); process.exit(0); }

  const imp = await fetch(`${server}/api/import/youtube`, {
    method: "POST", headers: auth, body: JSON.stringify({ songs }),
  });
  if (!imp.ok) {
    console.error(`import failed: ${imp.status} — is the server running a build with /api/import/youtube?`);
    process.exit(1);
  }
  const { imported } = await imp.json();
  let liked = 0;
  for (const s of toLike) {
    const r = await fetch(`${server}/api/liked/toggle`, { method: "POST", headers: auth, body: JSON.stringify({ song: s }) });
    if (r.ok) liked++;
  }
  console.log(`COMMITTED to ${server}: ${imported} history rows merged, ${liked} songs liked.`);
} else {
  const db = await import("file://" + path.resolve("lib/db.js").replace(/\\/g, "/"));
  const user = db.getUserByEmail(email);
  if (!user) { console.error(`\nno user with email ${email}`); process.exit(1); }
  if (!commit) { console.log("\nDRY RUN — nothing written. Re-run with --commit."); process.exit(0); }

  const imported = db.importPlays(user.id, songs);
  const already = new Set(db.likedSongs(user.id).map((s) => s.id));
  let liked = 0;
  for (const s of librarySongs) {
    if (already.has(s.id)) continue;
    db.toggleLike(user.id, s); // absent → adds
    liked++;
  }
  console.log(`\nCOMMITTED locally: ${imported} history rows merged, ${liked} songs liked.`);
}
