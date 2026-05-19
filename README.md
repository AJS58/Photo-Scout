# Photo Scout PWA v9

Photo Scout is a GitHub Pages-ready Progressive Web App for photographic location scouting.

## Included in this build

- 5-second premium splash screen with progress line
- Polished Photo Scout home-screen icon assets
- In-app camera preview
- Front/rear camera switching
- Gallery import
- Rule-of-thirds grid
- Live histogram toggle
- Draggable histogram panel
- Zebra/clipping warning overlay prototype
- Camera zoom slider where supported by the browser/device
- GPS capture
- Open-Meteo 5-day forecast after GPS capture
- Sunrise/sunset and estimated golden-hour display
- Moon phase display
- Save locations locally
- Save weather and GPS with a location
- Return-visit planner
- .ics calendar export
- Share support where available
- Camera info / metadata overlay
- Exposure control panel that shows EV/ISO sliders only where the browser exposes those camera controls

## Important limitation

Manual exposure compensation and ISO are limited by browser/device support. iOS Safari often does not expose full manual camera controls to PWAs. The controls are included, but they only appear when the camera API reports support. A future Capacitor/native build can provide deeper camera control.

## Uploading to GitHub Pages

Upload the full contents of this folder, preserving the folder structure:

- index.html
- manifest.json
- sw.js
- css/
- js/
- data/
- assets/

After replacing an older version, refresh with `?v=6` and remove/re-add the iPhone home-screen icon so iOS updates the icon cache.


## v10 updates
- Saved location detail cards for GPS, weather/light, notes and recommendations.
- Planner tab upgraded with details and calendar export.
- Map links for GPS locations.
- Share/export text scouting report.
- Weather fallback now saves estimated light/moon data if live forecast cannot be reached.


## v14 update
- Strong black rule-of-thirds grid for bright outdoor use.
- Cache version bumped to force GitHub Pages refresh.


## v15 update
- Replaced random genre selection with local browser-based subject/genre detection.
- Analyses sky, vegetation, brightness, contrast, edge detail, likely horizon, low-light cues, possible faces where supported, and highlight risk.
- Adds visible detection notes and candidate scores to the analysis screen.
- No image is uploaded for this local prototype analysis.

## v16 beta polish
- Confidence explanation for local subject/genre detection
- Manual genre override with instant recommendation update
- Scoring breakdown for light, composition, weather, access and return potential
- Tester feedback tool with copy/download options
- Privacy/safety screen for beta testers
- Field warnings for offline and low-battery conditions where supported
- HTML scouting report export
