# Marusic

> ## ⚠️ For educational purposes only
>
> This project is published **solely as an educational reference** — a study of
> how a streaming-player UI, a media proxy, invite-only auth, UPnP/Cast output
> and a PWA fit together. It is **not** a product, not a service, and is not
> intended for public deployment or for downloading or redistributing music you
> do not own the rights to.
>
> It is **not affiliated with, endorsed by, or connected to** YouTube, YouTube
> Music, Google, Spotify, Tidal, Qobuz, Sonos, or any other service named here.
> All trademarks belong to their owners. Using it may violate those services'
> Terms of Service, and copyright law varies by country — **you alone are
> responsible** for how you use this code and for complying with the law where
> you live. The author accepts no liability. See [Disclaimer](#disclaimer).

A Spotify-style web music player for YouTube Music, with its backend ported
from [involvex/youtube-music-cli](https://github.com/involvex/youtube-music-cli):
search and metadata go through the YouTube Music Innertube API (`youtubei.js`,
same as the CLI's MusicService), and audio streams are resolved with
**yt-dlp** — the CLI's audio extractor — then proxied to the browser with
Range support so seeking works.

## Features

- **Accounts & auth** — invite-only sign-up (pattern from animeMarwan):
  scrypt-hashed passwords, cookie sessions in SQLite, a seeded admin, login
  rate limiting, and an in-app admin panel (invite / disable / delete members)
- **Account settings** — change your display name and password in-app
  (a password change signs out every other device)
- **Per-user libraries** — playlists, liked songs, history, saved albums, and
  followed artists belong to the signed-in user
- **Search** songs, albums, **artists, and public playlists** on YouTube Music,
  with **typeahead suggestions**
- **Artist pages** — top songs, albums, singles & EPs, and "fans also like";
  artist names are clickable everywhere, and you can **follow** artists
- **Lyrics** for the current track (YT Music lyrics), time-synced: the line
  you're on is highlighted, and clicking a line seeks to it
- **Full player**: play/pause, next/prev, seek, volume, shuffle, repeat (off/all/one)
- **Full-screen Now Playing** — the cover and transport on one side, lyrics /
  queue / jam as tabs down the other. On phones tap the mini player for the
  same screen with those three as bottom sheets; swipe down to dismiss
- **Artwork at the size it's drawn** — YT Music hands out 60px thumbnails, so
  every cover asks for the resolution its box actually needs (and 2x on
  retina) instead of upscaling
- **Autoplay** — when the queue runs out, related songs keep playing
  (toggle in the player's queue tab)
- **Playback survives reloads** — the queue, current track, and position are
  restored (paused) when you come back
- **Gapless-ish transitions** — the next track's stream URL is resolved in the
  background while the current one plays
- **Queue**: add to queue, view/jump within the player's queue tab
- **Playlists**: create, rename, delete, add/remove songs, **drag to reorder**,
  **share with other members** (revocable links), **export/import JSON**, and
  save copies of public YT Music playlists
- **Liked Songs** and **play history** ("Jump back in")
- **Jam sessions** — a shared queue with one speaker: start a jam and the
  device you started it on plays the audio; everyone who joins with the
  6-letter code (or invite link) becomes a synchronized remote control —
  they see the queue and live progress, add songs, and (if the host allows)
  play/pause/skip/seek, all over server-sent events. The host can move the
  sound to whichever of their devices they're on ("Play here"), kick
  members, and end the jam; jam autoplay refills the queue with similar
  songs, and if the host leaves, the longest-standing member inherits the
  jam. Jams are in-memory and ephemeral — a server restart ends them.
- **Made for you** — daily mixes built from your listening history via
  YT Music's automix
- **Radio**: moods & genres as endless stations — first batch from the genre's
  featured playlists, refilled with YT Music's automix "up next". Stations paint
  instantly on their YT Music genre colour, then swap in real cover art fetched
  lazily (`POST /api/radio/art`, cached server-side for the process)
- **Trending** shelf on Home (YT Music Explore) — leads with a **Trending
  Singles** playlist holding every trending track, then the trending albums &
  EPs beside it; `#/trending` opens both together on one page
- **Content-type visual language** — playlists, singles, albums/EPs and stations
  each get their own silhouette, corner mark and colour, so you can tell what a
  card is before reading it (see below)
- **Quality selector** (high / medium / low, like the CLI's stream settings)
- **Downloads** — each track's menu lists the real YouTube audio formats
  (codec / bitrate / size) plus FLAC and MP3 convert options (ffmpeg, bundled),
  and a **true lossless FLAC** option (see below)
- **Play on other devices** — one output button covers **smart TVs and Sonos
  speakers** (any browser — the server drives them over UPnP/DLNA),
  **Chromecast** (Chrome), and **AirPlay** (Safari on Apple devices); the
  device plays the stream while the app becomes the remote (see below)
- **Installable PWA** — manifest + service worker cache the app shell, so it
  installs to a phone's home screen or desktop
- Media-key support via the Media Session API

## Lossless (FLAC) downloads

The download menu leads with a **true lossless** option that matches the track
by artist + title and streams the real 16/24-bit FLAC. Two keyless, no-account
sources are searched at once and the best match wins (the popover shows which
one it came from):

- **Tidal** — via the [SpotiFLAC](https://github.com/spotbye/SpotiFLAC)
  `hifi-api` mirror pool ([binimum/hifi-api](https://github.com/binimum/hifi-api)):
  a text search returns a Tidal track id, then a FLAC CDN url is decoded from
  the base64 `/track` manifest. The mirrors are queried in parallel, so any one
  that's up serves the download.
- **Qobuz** — the public `get-music`/`download-music` API shape from
  [fabiodalez-dev/MusicFLAC](https://github.com/fabiodalez-dev/MusicFLAC) /
  squid.wtf.

Both are public community proxies that rotate hostnames and go down often; when
neither has a reachable match the menu says so and you still get the
YouTube-sourced formats and FLAC/MP3 conversions. Point `TIDAL_API_BASE` and/or
`LOSSLESS_API_BASE` (comma-separated) at working/self-hosted instances for
reliability. YouTube itself has no true lossless, so the "convert to FLAC"
option is a lossless *container* of a lossy source, not CD-quality audio.

> Intended for personal use. These proxies stream from Tidal/Qobuz without an
> account, which is legally gray in many places — running your own hifi-api
> instance against your own subscription is the clean path.

> Note: SpotiFLAC's own no-account sources route through the author's
> deliberately-encrypted private proxy; that key isn't reused here. Marusic only
> talks to openly public instances or one you configure.

## Playing on other devices (TVs, Sonos, Chromecast, AirPlay)

The output button (next to the quality selector; on phones it's the **Cast**
action in the full-screen Now Playing sheet) opens a device menu: **this
device**, **Chromecast**, **AirPlay**, and every **speaker or smart TV** found
on the network. Whichever you pick plays the audio while every control in the
app — play/pause, seek, next/prev, the volume slider — drives that device.
Track ends advance the normal queue (autoplay, radio and repeat included), and
switching outputs hands playback over at the same position, in any direction
(computer → TV → Chromecast → back). Remote outputs pause while you're in a
jam — a jam already has exactly one speaker.

### Speakers & TVs over UPnP (works from any browser)

Sonos speakers **and DLNA smart TVs** (Samsung, LG, Sony, Philips…) speak the
same UPnP `AVTransport`/`RenderingControl` protocol, so one code path drives
them all: they're found with an SSDP scan and controlled by the **server**
over plain UPnP (`lib/upnp.js`, zero dependencies) — so it works from Edge,
Firefox, anything, with no Chrome and no Apple hardware. The device fetches an
AAC stream (`q=sonos`; neither Sonos nor most TVs play YouTube's usual
webm/opus) using the same cast-token auth as a Chromecast, and the next track
is pre-armed on the device (`SetNextAVTransportURI`) so transitions are
gapless. The Sonos app — or the TV's own now-playing screen — shows
title/artist/artwork for the playing track.

Unlike Sonos, which always answers on port 1400 at fixed service paths, a TV
puts its renderer wherever it likes and often hosts several unrelated UPnP
devices on the same IP (a Samsung panel advertises a DIAL receiver and a
screen-mirroring service alongside the renderer). So discovery reads each
device description and keeps only the one that actually exposes
`AVTransport`, taking its control URLs from that description.

- Nothing appearing? SSDP multicast must reach the device: same subnet, no
  VPN, and the TV must be awake. In **docker** (bridge networks block
  multicast) list them explicitly: `UPNP_IPS=192.168.1.50,192.168.1.51`.
- The device must be able to reach the server (`CAST_BASE_URL` /
  the LAN-adapter guess / the tunnel hostname — same rules as Chromecast,
  below). Windows: allow Node through the firewall for the profile your
  network uses (Private *or* Public — check which, they're separate rules).
- The server only ever sends UPnP commands to devices that discovery or
  `UPNP_IPS` produced — client-supplied addresses are rejected (SSRF guard).
- A page reload while a device is playing lets the current track finish (plus
  the pre-armed next one); reopen the device menu and pick it again to
  re-attach.
- Seeking depends on the device. Sonos honours `REL_TIME` seeks; some TVs
  (the Samsung Odyssey tested here included) silently ignore them and keep
  playing from where they were — so moving the scrubber, or handing a
  part-played track over from another output, may start the track from the
  beginning on those sets.

### AirPlay (Safari on Apple devices)

In Safari on iPhone/iPad/Mac the menu grows an **AirPlay…** entry that opens
Apple's system picker — pick an AirPlay-2 Sonos (or any AirPlay speaker) and
Safari routes the player's audio there. Playback stays on the device, so
every control simply keeps working. AirPlay senders only exist on Apple
hardware; on Windows, use the direct UPnP path above instead — same speakers
and TVs, no Apple device needed.

### Chromecast (Chrome)

Marusic is a Google Cast **sender**: in Chrome (desktop or Android, on
`localhost` or an HTTPS hostname like the tunnel) the menu's **Chromecast…**
entry opens Chrome's device picker. Chrome over a bare LAN IP
(`http://192.168…`) isn't a secure context, so Cast is disabled there — and
no other browser gets the Cast API at all; the menu says so instead of
hiding.

**Picker finds no devices?** Chrome discovers Chromecasts with mDNS: same
Wi-Fi/subnet, **VPNs often break discovery** (disconnect and retry), and
firewalls that block mDNS (UDP 5353) do too. Sanity check: Chrome menu →
Cast… — if Chrome itself can't see the device, the app can't either.

### How devices authenticate

A Chromecast or Sonos fetches `/api/stream/...` itself and has no session
cookie, so the app mints a signed short-lived **cast token**
(`POST /api/cast/token`, HMAC with a per-boot secret) that rides the stream
URL. The token grants stream access only, dies with a server restart (the
next track just mints a new one), and stops working if the user is disabled.

Reachability: the device fetches the stream from the server itself.

- **Cloudflare tunnel / real hostname** — works as-is; the device uses the
  same HTTPS origin as the browser.
- **Dev on `http://localhost:3000`** — stream URLs are rewritten to this
  machine's LAN IP (preferring physical adapters over VPN/virtual ones). If
  the guess is wrong, set `CAST_BASE_URL=http://<your-lan-ip>:3000`.
  Firewalls that block inbound LAN connections to Node will block devices
  too.

If you've installed the PWA, hard-refresh once (Ctrl+Shift+R) after an update
so the service worker picks up the new shell.

## Requirements

- Node.js >= 22.5
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) on the PATH
  (`winget install yt-dlp.yt-dlp` / `brew install yt-dlp`), or set `YTDLP_PATH`
- ffmpeg is bundled via `ffmpeg-static` (no system install needed)

## Run it

```bash
npm install
npm start          # http://localhost:3000
```

First run seeds an admin account — in dev that's
`marwansummakieh97@gmail.com` / `changeme` (override with `ADMIN_EMAIL` /
`ADMIN_PASSWORD`, see `.env.example`). Sign in, open the account menu (top
right) → **Manage users** to invite people; each invite is a one-time link
where the person sets their own password. There is no open registration.

Data lives in `data/marusic.sqlite` (users, sessions, invites, and each
user's playlists / liked songs / history / saved albums / followed artists).

## Tests

```bash
npm test          # node:test suite for the SQLite layer (no network needed)
```

CI runs the same suite on every push (`.github/workflows/ci.yml`).

## Docker

The image is published to GHCR for `linux/amd64` and `linux/arm64` on every
`v*` release, so nothing has to be built to run it:

```bash
docker run -p 3000:3000 \
  -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD=something-strong \
  -v marusic-data:/app/data ghcr.io/marwansummakieh/marusic:latest
```

| Tag | What it is |
| --- | --- |
| `latest` | the newest `v*` release — the default |
| `1.4.2`, `1.4` | that release, pinned |
| `edge` (or `main`) | the tip of `main`, built on every push |

The image bundles the standalone yt-dlp binary; ffmpeg comes from
`ffmpeg-static`. Production refuses to boot without real admin credentials.
Building it yourself is still one command — `docker build -t marusic .`.

## NAS + Cloudflare tunnel

`docker-compose.yml` runs the app plus a `cloudflared` connector, so nothing
is port-forwarded and the app gets HTTPS (which the PWA install needs). The
NAS needs two files and no source checkout:

```bash
curl -O https://raw.githubusercontent.com/MarwanSummakieh/marusic/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/MarwanSummakieh/marusic/main/.env.example
# edit .env — ADMIN_EMAIL, ADMIN_PASSWORD, TUNNEL_TOKEN
docker compose up -d
```

Updating is then two commands, and the same two forever:

```bash
docker compose pull && docker compose up -d
```

The library survives it — the SQLite database lives in the `marusic-data`
volume, not in the container. To have it update itself instead, start the
stack with `docker compose --profile autoupdate up -d` and a Watchtower
container will check GHCR every six hours.

Pin a version by setting `MARUSIC_TAG` in `.env` (`MARUSIC_TAG=1.4`); left
unset it follows `latest`.

The tunnel token goes in `.env` as `TUNNEL_TOKEN` (Cloudflare Zero Trust →
Networks → Tunnels → your tunnel → the token from the connector command).
`.env` is gitignored, so the token and admin password stay out of the repo.
In the tunnel's **Public hostname** settings, point your hostname at
`http://marusic:3000` — cloudflared reaches the app over the compose network.

The compose file sets `TRUST_PROXY=1`; behind the tunnel every request
arrives from cloudflared's IP, and without trust-proxy the login rate limiter
would count all users as one client.

To run a working copy instead of the published image, add the build override:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## Android app + Android Auto

`android/` is a native Kotlin app (Compose phone UI + Media3
`MediaLibraryService`) that plays through the same server. In the car,
Android Auto renders the app's browse tree — Home (trending, daily mixes),
Library (playlists, liked, history, albums, artists), Radio — and voice
works ("play &lt;something&gt; on marusic" hits `/api/search`).

Auth: the app signs in once with email + password, then exchanges the
session for a long-lived **device token** (`POST /api/device/token`) sent as
`Authorization: Bearer …` on every request, including `/api/stream`. Device
tokens survive password changes and are revocable per device
(`GET`/`DELETE /api/device/tokens`). Sign out revokes the token.

Shared listening works on the phone the same way it does on the web, both
kinds of it: a **jam** (one device makes sound, the rest are synchronized
remotes — the host can hand the audio to this phone with "Play here") and
**listen together** (every device plays its own stream, aligned to the server
clock). The kind is chosen when the session starts. The app holds its clock
offset with round trips to `/api/jam/time` and places the playhead once per
track boundary rather than chasing the server mid-song, which is what keeps
two phones in a call actually together.

Build (needs JDK 17 + Android SDK; or just open `android/` in Android
Studio):

```bash
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
adb install app/build/outputs/apk/debug/app-debug.apk
```

On first launch enter the server URL (the tunnel hostname, or
`http://<lan-ip>:3000` for dev — cleartext is allowed by the app's network
config), email, and password.

Sideloaded apps are hidden by Android Auto until developer mode is on:
Android Auto settings → tap **Version** 10× → menu → **Developer settings**
→ enable **Unknown sources**. To test without a car, use the [Desktop Head
Unit](https://developer.android.com/training/cars/testing/dhu) (`sdkmanager
"extras;google;auto"`), enable head unit server in Android Auto's developer
menu, then `adb forward tcp:5277 tcp:5277 && desktop-head-unit`.

Notes:
- Skipping to a not-yet-played track can take a few seconds the first time —
  the server shells out to yt-dlp to resolve the stream. The app prefetches
  the next queue item to hide this, same as the web client.
- When the queue runs out, autoplay appends `/api/reco/:id` results, and
  played tracks land in history via `POST /api/history`.

### Releases

Release builds are signed with `android/keystore/marusic-release.keystore`
(credentials in `android/keystore.properties`; both gitignored — **back the
keystore up**, installed release builds only update if signed with the same
key):

```bash
cd android && ./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
```

`.github/workflows/build.yml` packages both halves on pushes to `main`,
`v*` tags, and manual dispatch: the server's multi-arch Docker image (pushed
to GHCR as `edge` from `main` and as `latest` + the semver tags from a `v*`
tag), a debug APK artifact always, and a signed release APK artifact when
these repo secrets exist:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 android/keystore/marusic-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | `storePassword` from `android/keystore.properties` |

## Content-type visual language

Every browsable card carries three cues, so its type is legible before you read
a word of it. `TYPES` in `public/app.js` is the single source; the shapes and
hues live under "Content-type visual language" in `public/styles.css`, and the
legend on Home spells the whole system out once.

| Type       | Silhouette                          | Hue     |
| ---------- | ----------------------------------- | ------- |
| Playlist   | sheets stacked above the cover      | violet  |
| Mix        | same stack (it is a playlist)       | green   |
| Single     | a vinyl disc peeking out the right  | amber   |
| Album      | a sleeve spine down the left (8px)  | blue    |
| EP         | the same spine, half as wide (4px)  | teal    |
| Station    | a tuning dial — cover in a ring     | pink    |
| Artist     | a bare circle, no corner mark       | neutral |

Each also gets a corner mark on the artwork and a chip beside its subtitle, both
in the type's hue. Covers with no image fall back to that type's glyph rather
than a generic note, so a missing image still tells you what the thing is.

## How it maps to youtube-music-cli

| CLI (MusicService)            | Marusic equivalent                          |
| ----------------------------- | ------------------------------------------- |
| `search` (songs/albums)       | `GET /api/search?q=` (also artists + playlists) |
| `getReleaseTracks` / album    | `GET /api/album/:browseId`, `GET /api/playlist/:browseId` |
| artist browse                 | `GET /api/artist/:channelId`                |
| lyrics browse                 | `GET /api/lyrics/:videoId`                  |
| search suggestions            | `GET /api/suggest?q=`                       |
| `getSuggestions` (up next)    | `GET /api/reco/:id`, radio refills, autoplay, `GET /api/mixes` |
| `getGenres` + genre playlists | `GET /api/radio/stations`, `/api/radio/queue`, `POST /api/radio/art` |
| `getTrending` (Explore)       | `GET /api/trending` → `{ singles, releases }` |
| `getStreamUrl`                | `GET /api/stream/:id?q=high` (yt-dlp → Range proxy) |

Why yt-dlp instead of the CLI's JS extractors: YouTube now serves SABR-only
streaming responses, which currently breaks `@distube/ytdl-core`,
`youtube-ext`, and youtubei.js downloads. yt-dlp tracks those changes.
Intended for personal use.

## Disclaimer

**This software is provided for educational and research purposes only.**

- **No affiliation.** Marusic is not affiliated with, authorised by, endorsed
  by, or in any way officially connected to YouTube, YouTube Music, Google LLC,
  Spotify, Tidal, Qobuz, Sonos, Apple, or any other company or service
  referenced in this repository. All product names, logos, trademarks and
  brands are the property of their respective owners and are used here only to
  describe what the code interoperates with.
- **No content is hosted or distributed.** This repository contains no audio,
  no metadata dumps and no media of any kind. It is source code that talks to
  third-party endpoints; whatever those endpoints return is theirs, not the
  author's.
- **Terms of Service.** Accessing YouTube Music, Tidal or Qobuz through
  unofficial clients or public proxies is likely to breach those services'
  Terms of Service. The lossless sources in particular are third-party
  community proxies the author neither operates nor controls.
- **Copyright.** Downloading, converting, storing or sharing copyrighted music
  without permission is illegal in most jurisdictions. Nothing here is an
  invitation to do that. Use it only with content you own or that is licensed
  for such use, and support artists through official channels.
- **Your responsibility.** By using, running, or modifying this code you accept
  that you do so entirely at your own risk and that you alone are responsible
  for complying with all applicable laws and agreements in your jurisdiction.
- **No warranty.** The software is provided "as is", without warranty of any
  kind, express or implied. The author is not liable for any claim, damages or
  other liability arising from its use.

If you are a rights holder and believe something in this repository is
inappropriate, please open an issue and it will be addressed promptly.
