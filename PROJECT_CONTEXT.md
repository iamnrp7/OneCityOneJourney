# Metro Hacks – project context (read this first)

Event: Metro Hacks (DevFest Gandhinagar '26). Solo, ~2h build on a moving train, Mahatma Mandir -> APMC -> Mahatma Mandir.
The challenge is announced on the night. Likely tracks: Metro Operations, City Public Transport.

## Hard constraints
- MUST work fully OFFLINE (judges may enable airplane mode). No CDN links, no API calls at runtime, no external fonts/tiles.
- No backend. Data is local JSON in /data, user data in IndexedDB (localStorage only for tiny prefs).
- One flow that works end to end beats many half-built screens. Mobile-first, big tap targets, works on a phone and laptop.
- Submission needs: public repo, one-line pitch, what works right now. Keep README honest about real vs sample data.

## Data in /data (all from official GMRC pages unless noted)
- stations.json: 54 stations. corridors {NS, EW, GIFT} = ordered station ids. `lat/lon` and `name_gu` (Gujarati) from OpenStreetMap for all but sabarmati-rly-station. `timing_point` = has published times. `integration_from_map` read off the route map image (verify).
- timetable_trips.json: 84 trips (N01..N42 northbound from APMC, S01..S42 southbound from Mahatma Mandir/GIFT City), effective 2026-05-18. Times only at key stations: apmc, old-high-court, motera-stadium, koteshwar-road, gnlu, infocity, sachivalaya, mahatma-mandir, gift-city. Intermediate times are NOT published: interpolate and label as estimated.
- segment_minutes.json: median/min/max minutes between consecutive timing points, computed from the trips.
- service_rules.json: frequencies, first/last trains, run times per line.
- fare_rules.json: ticket media, validity, penalties. There is NO station-to-station fare chart. Any amounts are sample data.
- lost_and_found.json / .csv: 45 real found-item notices (Apr-Sep 2026) with station ids. Useful as realistic operations data.

## Bus data (GTFS feed, valid 2026-09-30 to 2027-03-29, publisher BLRTransit; credit them; licence unknown)
- bus_stops.json: 3,203 stops [id,name,lat,lon] (AMTS + AJL stops use AMC_ ids, GTSL Gandhinagar uses GTSL_).
- bus_routes.json: 633 routes [route_id, agency(AMTS|AJL|GTSL), short, long]. 474 AMTS, 149 AJL (BRTS), 16 GTSL.
- bus_stop_routes.json: stop_id -> [[route_index, trips_per_day, first, last]] (route_index = position in bus_routes.json).
- bus_route_stops.json: one representative ordered stop list per route+direction (no shapes in the feed).
- bus_near_metro.json: nearest bus stops (<=800 m, straight line) to each metro station with their busiest routes.
- bus_departures_near_metro.json: real departure times (minutes after midnight) per route/headsign at the bus stops nearest each metro station. Used by Metro.connect().
- brts_fares.json: BRTS adult/child fare matrix by area (INR). AMTS fares are NOT in the feed. All trips run 7 days a week.
- Gap worth exploiting: Gandhinagar stations have almost no nearby bus stops (e.g. Mahatma Mandir ~1.6 km, Sachivalaya ~0.85 km), while Ahmedabad stations mostly have one within a few hundred metres.

## Facts worth knowing
- End-to-end APMC <-> Mahatma Mandir takes 78-83 min one way (round trip is roughly 2h40m+).
- Regular service north of Koteshwar Road ends ~21:20 (last Mahatma Mandir departure 21:00), so tonight's ride is a special run. Don't model it as a normal timetable trip.
- Interchanges: Old High Court (NS<->EW), GNLU (NS<->GIFT City branch).
- Digital QR tickets: phone/battery/network failure is treated as ticketless travel (per fare rules). A real offline pain point.
- Older GMRC PDFs show Sachivalaya->Mahatma Mandir as "work in progress"; that is outdated.

## Working style for the AI
1. Read the challenge text, then reply with a 5-line plan and the ONE flow. No code yet.
2. Build in vertical slices. After each slice, say how to test it offline.
3. Prefer plain HTML/CSS/JS or the existing starter. Add no dependency that needs the network at runtime.
4. Stop adding features 30 min before the end. Final 20 min: README, demo data, demo script, screenshots.
5. Label estimated or sample data in the UI.

## Helper library: lib/metro.js (no dependencies; browser global `Metro` or Node require)
- `await Metro.load('data/')` then: `Metro.journeys(from,to,afterMin,n)` next trains on the NS/GIFT corridor (times at non-timing stations are interpolated, `estimated:true`).
- `Metro.stationsAhead(tripId,from)`, `Metro.tripTimes(tripId)` for stop lists with times.
- `Metro.nearbyBus(stationId)`, `Metro.connect(stationId,arriveMin)` buses you can still catch after walking (flags `gap` when nearest stop >400 m), `Metro.brtsFare(stopA,stopB,child)`.
- `Metro.simulateDelay({tripId,stationId,delayMin,recover,hmin,turnback})`, `Metro.rakeChains(turnback)`, `Metro.minHeadway()` for the delay ripple (assumptions documented in the code).
- `Metro.toMin('08:15')`, `Metro.toStr(495)`, `Metro.haversine(lat1,lon1,lat2,lon2)`.
- Sanity test: `node tests/smoke.js`.
See docs/TRACKS.md for per-track plans and docs/PROMPT.md for the handover prompt.

## Starter app (already built): plain HTML/CSS/JS, offline PWA
Files: index.html, app.js, style.css, sw.js (service worker), lib/metro.js, data/. No build, no installs.
Run: `python3 -m http.server 8000` in this folder (or `npx serve`), open http://localhost:8000 once online, then it works offline.
Tab 1 "Train + bus": From/To/time -> next 3 trains (estimated stations marked ≈) -> buses you can still catch at arrival, last-mile gap warning.
Tab 2 "Delay ripple": pick a trip, station and delay -> later trains affected and why.
Adapt, don't rewrite: change the tabs/screens to the announced challenge and keep the offline setup (add any new data file to the list in sw.js and bump `V`).
