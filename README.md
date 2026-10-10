# One City, One Journey

**An offline-first journey planner that puts Metro, BRTS and AMTS legs into one plan, one fare estimate and honest transfer walks.**

Built solo in two hours on a moving train at **Metro Hacks, DevFest Gandhinagar '26** (GDG Gandhinagar x GDG Cloud Gandhinagar).
Problem statement: **PS-08, One City, One Journey** (City Public Transport).

![Planner](docs/screenshots/01-planner.png)

## The problem (PS-08)

Metro, BRTS and city buses are run by different operators with separate tickets. A commuter who combines them gets no single view of the journey, its total cost, or the transfer walks involved, and many give up and use a private vehicle.

**Deliverable asked for:** a journey planner prototype combining metro, BRTS and AMTS legs for a sample trip, with one fare estimate and transfer walking times. Bonus: fare-splitting logic between operators.

## What it does

- **One plan for three operators.** Pick From, To and a time. The planner returns the full journey: metro legs, BRTS and AMTS bus legs, waits, and walks between them.
- **One fare estimate**, with a per-operator fare breakdown.
- **Transfer walking times** (distance and minutes) at every change.
- **Every number says how much to trust it.** Each leg and fare line is tagged `REAL`, `ESTIMATE`, `SAMPLE` or `MISSING`. Missing data is shown, not hidden, and excluded from the total with a note.
- **Works offline.** A service worker caches the app and all data. Journeys can be saved and reopened with no network.
- **Warns instead of misleading.** If the only option means a long wait outside service hours, the planner says so.
- One-tap presets (for example Mahatma Mandir to APMC) and a Swap button.

| Mixed metro + metro | Outside service hours, with warning |
|---|---|
| ![East-West to North-South transfer](docs/screenshots/03-metro-transfer.png) | ![Late-night warning](docs/screenshots/02-late-night.png) |

## Why it holds up with poor or no network

The brief warns that coverage on the train is patchy, so the app is built for that:

- Plain HTML, CSS and JavaScript. No build step, no CDN, no runtime API calls, no external fonts or map tiles.
- Everything the planner needs is local JSON in `data/`, precached by `sw.js`.
- Saved journeys live in the browser and keep working offline.
- Missing or estimated data degrades gracefully into a labelled estimate rather than an error.

## Data: what is real and what is not

| Data | Source | Status in the app |
|---|---|---|
| Metro North-South and GIFT City trips (84 trips, key stations) | GMRC timetable, w.e.f. 18 May 2026 | `REAL` |
| Metro East-West line | GMRC frequencies only (no trip-level timetable) | `ESTIMATE` |
| Intermediate station times between timing points | Interpolated | `ESTIMATE` |
| AMTS, AJL (BRTS) and GTSL stops, routes and departures | GTFS feed by BLRTransit, valid 30 Sep 2026 to 29 Mar 2027 | `REAL` where a departure exists |
| BRTS fares | `fare_leg_rules` in the same GTFS feed | `REAL` |
| AMTS fares | Not in the feed | `MISSING`, excluded from the total |
| Metro fare | GMRC publishes no fare chart | `SAMPLE` placeholder, clearly flagged |
| Station coordinates and Gujarati names | OpenStreetMap export | used for distances and labels |

**Assumptions (all shown in the app footer):** bus ride time is estimated from straight-line distance at 18 km/h; walking is straight-line distance x 1.3 at 75 m/min; a 3-minute boarding buffer is added at metro stations.

## Fare-splitting logic (bonus: proposal)

Status: shown in the app as a labelled **PROPOSAL**, calculated on the planned journey.

1. The passenger buys **one integrated ticket** for the whole journey.
2. The total is shared between operators by **in-vehicle distance** (board stop to alight stop, straight line x 1.3), so each operator is paid for the km it carries.
3. A **clearing house** settles the shares between operators from tap-in and tap-out logs (for example on NCMC cards).
4. Where an operator's fare is unknown (today: AMTS), the method is shown on the known total only.

## Feasibility and PPP model

- **Authorities** (GMRC, AMC / AMTS, AJL, GTSL) own the data, the fare rules and the rebate policy.
- **A private partner** builds and operates the planner and the clearing platform, and keeps the data feeds fresh.
- **Funding:** a small clearing fee on settled fares, set by agreement, so the authority pays no upfront cost and the partner earns only as ridership grows.
- **Pilot path:** start with the two interchanges that already combine all three modes (for example Old High Court and the Sabarmati corridor), measure how many commuters switch from private vehicles, then widen.

## Known limitations

- No AMTS fares and no official metro fare chart, so totals are estimates and say so.
- East-West line times come from frequency, not a trip timetable.
- Bus legs outside the published service window are estimates.
- Walking uses straight-line distance, not the real footpath network.

## Run it

```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
python3 -m http.server 8000
```

Open `http://localhost:8000` once while online. The badge turns to **Offline-ready** when everything is cached; after that it works with the network off. To test, use Chrome DevTools, Application, Service Workers, Offline.

Service workers need `localhost` or HTTPS, so do not open `index.html` directly from the file system.

Tests are plain Node scripts in `tests/` (no dependencies). For example: `node tests/smoke.js`.

## Project structure

```
index.html  style.css  app.js   the app
sw.js                           service worker (offline cache)
lib/metro.js                    timetable, bus connections, delay model
lib/journey.js                  multimodal journey planner and fares
data/                           real and sample data (see table above)
tests/                          Node test scripts
docs/                           track notes and screenshots
```

## Data credits

- Metro timetable and rules: Gujarat Metro Rail Corporation (GMRC) public pages.
- Bus data: GTFS feed published by BLRTransit (AMTS, AJL, GTSL). No licence is stated in the feed; credited here.
- Map data: OpenStreetMap contributors (ODbL).

## Author

Nihar Prajapati. Built at Metro Hacks, DevFest Gandhinagar '26.
