# Hava81 v2.1–v3 Product Plan: Türkiye'nin Hava Karar Motoru

## Product thesis

Hava81 should not compete with Google, Apple Weather, AccuWeather, Windy or OpenWeather on raw weather display. The product advantage is converting weather data into simple, local, actionable decisions for people in Türkiye.

Core positioning:

> Google tells you the weather. Hava81 tells you what to do about it.

Primary brand line:

> Havayı değil, gününü planla.

## North-star experience

A user opens a city and understands within 5 seconds:

1. How suitable today is overall (Hava81 Score, 0–100).
2. The best and worst time windows for being outside.
3. Whether they should go now or wait.
4. Practical answers: umbrella, jacket, outdoor activity, heat/wind/air-quality risk.
5. Activity-specific advice for their own routine.

Raw meteorological values remain available, but the decision layer becomes the primary reason to return.

## Product principles

- Never invent data. If UV, sea or road data is not connected, mark it unavailable instead of estimating a fake value.
- Every recommendation must be explainable by weather inputs.
- Keep the first screen useful in under 5 seconds.
- Prefer a concrete decision over another chart.
- Türkiye-specific use cases are a strategic advantage.
- Mobile and desktop must expose the same core product capabilities.
- Recommendations are guidance, not safety guarantees.

## Phase 0 — UX access and instrumentation foundation

Target: immediately after v2.0.

### Deliverables

- Make Saved/Compare reachable on desktop as well as mobile.
- Add a visible compare entry when at least two favorite cities exist.
- Introduce product event abstraction for future analytics without locking to a vendor.
- Define activity types, score bands and decision reason codes.
- Add test fixtures for hot/cold/rain/wind/AQI edge cases.

### Acceptance criteria

- A desktop user can reach comparison without changing viewport.
- Compare works with 2–3 favorites.
- All decision rules have unit tests.
- No production behavior depends on analytics being available.

## Phase 1 — Hava81 Gün Planı (v2.1 core)

Target: first major differentiating release.

### Hava81 Score

A 0–100 score derived from the next forecast windows. The score is not a generic meteorology score; it represents how comfortable/useful the day is for normal outdoor plans.

Initial inputs:

- precipitation probability
- temperature / feels-like where available
- wind speed
- air quality
- severe hot/cold conditions

Later inputs:

- real UV index
- gusts
- visibility/fog
- pollen/dust where a trusted source exists

Score bands:

- 85–100: Çok iyi
- 70–84: İyi
- 50–69: Dikkat
- 0–49: Zorlayıcı

Every score must expose reason codes so the UI can explain why it changed.

### Day timeline

Show the next 6–8 forecast windows with a decision status rather than only numbers:

- green: good outdoor window
- amber: usable with caution
- red: avoid/defer if possible

Example:

- 06–09: Koşu için çok iyi
- 09–12: Dışarı çıkmak uygun
- 12–15: Sıcaklık yükseliyor
- 15–18: Çok sıcak
- 18–21: Daha rahat

### “Şimdi mi, sonra mı?”

Compare the current/nearest forecast window with the best upcoming window.

Examples:

- “Şimdi çık. 3 saat sonra yağmur riski artıyor.”
- “2–3 saat beklersen sıcaklık daha rahat olacak.”
- “Bugün belirgin bir avantajlı pencere yok.”

The recommendation must include the reason and time difference.

### Quick practical answers

Initial answers:

- Şemsiye: Evet / Hayır / Yanında olsa iyi olur
- Dışarı çıkmak: En iyi pencere
- Rüzgâr: Normal / Dikkat / Güçlü
- Hava kalitesi: Normal / Hassas gruplar dikkat

Do not show sunscreen/UV advice until a real UV provider is connected.

### Acceptance criteria

- Every supported city produces a deterministic plan with the same input data.
- 81/81 province release gate includes plan generation.
- “Now or later” never recommends waiting when the future window is materially worse.
- Scores include explainable reasons.
- Unit tests cover thresholds and boundary values.

## Phase 2 — Activity modes and personalization (v2.2)

Users choose what they care about instead of receiving one generic score.

Initial activity presets:

- Yürüyüş
- Koşu
- Piknik
- Çocukla dışarı
- Motosiklet
- Çamaşır kurutma
- Sahil / deniz (only after required data exists)

Each activity has a separate scoring profile. Example: wind matters more to motorcycle; rain and drying conditions matter more to laundry; heat/AQI matter more to running and children.

### Personal setup

Lightweight, optional local profile:

- favorite city/cities
- preferred activities
- approximate commute/outdoor times
- temperature sensitivity preference

No account should be required for the first useful experience. Local storage first; account sync only when retention proves demand.

### Acceptance criteria

- User can select 1–3 activities in under 20 seconds.
- Home screen prioritizes selected activities.
- Generic experience still works without personalization.

## Phase 3 — Comparison becomes a decision product (v2.2)

Current comparison only displays weather values. Upgrade it to answer a question.

Example:

“Bu hafta sonu İstanbul mı İzmir mi?”

Compare:

- Hava81 Score
- outdoor score
- rain
- wind
- AQI
- best time window
- selected activity score

Then output a plain-language winner with reasons.

Important: comparisons should say “better for X under these weather criteria”, not claim one city is universally better.

## Phase 4 — Smart alerts and retention (v2.3)

Goal: create a reason to return without opening the app manually.

Alert examples:

- “17:30 çıkışında yağmur başlayabilir; şemsiyeyi unutma.”
- “Sabah koşusu için 06:00–08:00 bugünün en iyi aralığı.”
- “Yarın motosiklet için kuvvetli rüzgâr bekleniyor.”
- “Favori şehrinde hava planını etkileyecek belirgin değişiklik var.”

Rules:

- opt-in only
- no spam
- notify only when a decision materially changes
- quiet hours
- deduplication
- transparent reason

Start with browser/PWA notifications if product metrics justify it.

## Phase 5 — Türkiye-specific moat (v2.4+)

Prioritize only trusted data sources.

Potential modules:

- coastal/sea suitability: sea temperature, waves, wind
- dust transport
- frost/icing warnings
- agriculture windows
- snow/road risk
- local air pollution
- pollen if a reliable source exists

These should be released as decision modules, not raw-data dashboards.

## Phase 6 — Route weather (v3 candidate)

High-differentiation feature:

User enters origin, destination and departure time.

Hava81 evaluates forecast conditions along the expected route and reports:

- rain segments
- strong wind
- temperature drops
- fog/visibility when data exists
- destination conditions
- whether a nearby departure window is meaningfully better

Example:

“İstanbul → Ankara: Bolu çevresinde yağmur ve düşük görüş riski; 09:30 çıkışı mevcut verilere göre daha rahat.”

This requires route provider integration and time/position interpolation, so it should not block v2.1/v2.2.

## Growth plan

### SEO: answer intent, not only city-weather keywords

Build useful indexable pages/sections around questions:

- İstanbul bugün şemsiye gerekir mi?
- İzmir bugün dışarı çıkmak için en iyi saat
- Ankara koşu için hava uygun mu?
- Antalya hafta sonu dışarı çıkılır mı?

Avoid mass-generated thin SEO pages. Every indexed page should contain a real computed answer, timestamp and source.

### Share loop

Create shareable decision cards:

- city
- Hava81 Score
- one key warning
- best outdoor time
- canonical city URL

Primary channels: WhatsApp, Instagram Stories, X.

### Content loop

Automated but editorially controlled city/ranking content:

- “Bugün dışarı çıkmak için en iyi 10 il”
- “Hafta sonu yağış riski en düşük şehirler”
- “Bugünün en sıcak / en rüzgârlı illeri”

Never present rankings without clear metric/time/source.

## Metrics

### Activation

- visitor searches/selects a city
- visitor views Day Plan
- visitor adds a favorite or selects an activity

### Retention

Track returning users at D1/D7/D30 where privacy-compliant analytics is enabled.

Key targets for early validation:

- > = 25% of city viewers interact with Day Plan or activity advice
- > = 10% add at least one favorite
- > = 5% use compare/share
- improve D7 return rate release over release

Do not optimize vanity traffic before return behavior improves.

## Technical architecture

### Decision engine

Keep the engine pure and testable:

`weather + forecast + AQI + optional future signals -> scored time slots + reasons + recommendations`

No UI strings inside the core scoring engine. Engine returns reason codes and values; UI/localization turns them into Turkish/English copy.

Suggested modules:

- `src/domain/decision/types.ts`
- `src/domain/decision/scoreWeatherWindow.ts`
- `src/domain/decision/buildDailyPlan.ts`
- `src/domain/decision/activityProfiles.ts`
- `src/domain/decision/compareCities.ts`

### Data layer

v2.1 uses existing OpenWeather current/3h forecast/AQI. Real UV and an independent fallback provider remain separate workstreams.

### Testing

- deterministic unit tests for every threshold
- city fixtures for different climates
- 81-province API + plan-generation gate
- Playwright flows for plan, favorites, compare, mobile and desktop
- accessibility checks for score colors (never color-only meaning)

## Release sequence

### v2.0.1 hotfix

- desktop compare access
- direct compare UX cleanup

### v2.1

- Hava81 Score
- Day Plan timeline
- Now or Later
- practical quick answers
- analytics event abstraction

### v2.2

- activity modes
- personalized home priorities
- decision-based city comparison
- share cards

### v2.3

- smart alerts/PWA retention loop
- real UV if provider is production-ready
- stronger observability

### v2.4+

- Türkiye-specific modules

### v3 candidate

- route weather

## Release discipline

Every release follows branch -> tests -> PR -> CI -> green environment -> smoke/real-data gate -> production -> rollback window.

No feature ships merely because it is visually complete; it must have a clear user decision, deterministic tests and a measurable product hypothesis.
