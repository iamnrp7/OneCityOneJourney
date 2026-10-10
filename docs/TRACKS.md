# The two tracks in the DevFest email, and what this kit can do for each

The challenge text is only announced on the night. The email gave these example ideas:
- **Metro Operations:** a fault logger staff can use with no signal; a coach-crowding guide for the platform; a delay simulator that shows how one late train affects the rest.
- **City Public Transport:** the last mile from the station exit to your sector; "will I make my bus?" at an interchange; a journey card that works underground.
- "One flow that works end to end beats five half-built screens." Judges may switch on airplane mode during the demo.

## How well the data supports each idea
| Idea | Real data we have | Missing / must be sample | Fit |
|---|---|---|---|
| Delay simulator | Full trip timetable (84 trips, key stations), line rules | Rake rotation, dwell times, signalling limits (assumed, flagged) | Excellent |
| Fault logger | Station list, lines, trips (to tag "which train"), real lost-and-found notices as a pattern | Fault types and fault history (invent a realistic list, label as sample) | Good, but generic |
| Coach crowding guide | Frequencies, peak windows, station list | Coach/door positions, ridership (synthetic only) | Weak |
| Last mile from station exit | OSM station coordinates, 3,203 bus stops, 633 routes, real bus departure times near every station | Sector/neighbourhood polygons, walking network (use straight line x 1.3) | Excellent |
| "Will I make my bus?" | Metro arrival times + real bus departure times near each station | None for NS/GIFT corridor | Excellent |
| Journey card that works underground | Next trains, stations ahead with times, interchanges, ticket validity rules | Metro fare chart (not published; do not invent) | Good |

## Recommended build per track (pick after the challenge text is announced)

### Operations -> "Delay Ripple" (delay simulator)
One flow: pick a trip and a station, set a delay with a slider -> see which later trains are hit, why (headway or rake rotation) and by how much, drawn on a time-distance (Marey) diagram of the day.
- Data: `timetable_trips.json`, `Metro.simulateDelay()`, `Metro.rakeChains()` (shows the timetable implies about 13 rakes, an assumption to state openly).
- Controls to expose: delay, recovery per segment, minimum headway, turnback time.
- Nice extra only if time remains: "what to tell passengers at station X" using `Metro.journeys()` with the delayed times.
- If the challenge is the fault logger instead: offline form (station, asset, severity, note) -> IndexedDB queue -> supervisor summary -> export CSV/JSON/QR. Use the lost-and-found data as the model for realistic records.

### Public Transport -> "Station Connect" (last mile + will I make my bus + journey card)
One flow: choose From, To and a time -> card shows next 3 trains (departure, arrival, stations ahead) -> on arrival, the buses you can still catch with walk time and wait, a tight-connection warning, and a "no bus within 400 m" flag at the last-mile gap stations -> works offline and can be saved as a card.
- Data: `Metro.journeys()`, `Metro.connect()`, `bus_near_metro.json`, `bus_departures_near_metro.json`, `Metro.brtsFare()` for BRTS routes.
- The story: of the 34 stations on the main corridor with coordinates, 11 have no bus stop within 400 m, mostly in Gandhinagar (Mahatma Mandir 1.6 km, GNLU 1.3 km, Raysan 1.2 km, Sector 24 1.05 km, Sachivalaya 0.85 km). That is the pitch.
- Gaps to be honest about: no AMTS fares; walking distance is straight-line x 1.3; the East-West line has frequencies only (no trip times), so train times there are estimates from `service_rules.json`.

## Winning checklist (applies to both)
1. Define the single flow in one sentence before writing code.
2. Real data wherever it exists, sample data clearly labelled in the UI and README.
3. Works in airplane mode: service worker caches everything, no CDN, no API calls.
4. A 60-second demo script and a screen recording of it, made on the train.
5. Submission on time: public repo, one-line pitch, what works right now. The form closes one hour after the hackathon ends.
