# Hava81 Score Model v2

Hava81 Score is a **decision-support suitability score**, not a meteorological severity scale and not a safety guarantee. It answers a practical question: “How favorable are the next hours for ordinary outdoor plans?”

## Inputs

When the real one-hour Open-Meteo layer is available, each forecast slot can use:

- air temperature and apparent temperature,
- relative humidity,
- precipitation probability **and** precipitation amount (mm),
- sustained 10 m wind and gusts,
- UV index,
- visibility,
- WMO weather code,
- air quality: the fresh exact-hour Open-Meteo European AQI (normalized to the 1–5 scale), falling back to the fresh current OpenWeather category.

The existing OpenWeather three-hour forecast remains the resilient fallback. Missing optional fields do not make the score fail; the UI exposes `high`, `medium`, or `basic` data coverage.

## Thermal stress

Provider apparent temperature is preferred. If it is unavailable, Hava81 derives a fallback using the US National Weather Service heat-index approach for hot/humid conditions (simple Steadman formula below 80 °F, Rothfusz regression above) and the NWS wind-chill equation for cold/windy conditions. The score uses smooth curves around the comfort range rather than abrupt temperature thresholds. A slot with a broken temperature or wind value never produces NaN: missing wind counts as calm and a missing temperature caps the hour at 89 (incomplete evidence).

References:

- NWS Heat Index equation: https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
- NWS Wind Chill: https://www.weather.gov/safety/cold-wind-chill-chart

## Rain

Probability and intensity are deliberately separate. A high chance of a trace amount is not treated like a lower-probability multi-millimeter downpour. When hourly precipitation amount is unavailable, probability alone provides a weaker fallback signal. When only the amount is known, it is full rain evidence: an unknown probability is never read as a 0 % chance. If both probability and amount are missing, rain is **unknown**, not dry: the individual hour is capped at 89 (good at most), and the day-plan confidence cannot count that hour as high-quality evidence. This is an evidence-completeness policy, not a claim that rain is likely.

## Wind

Sustained wind and gusts are evaluated together. Gusts can therefore reduce suitability even when the mean wind speed appears moderate.

## UV

UV starts contributing from UVI 3 and becomes progressively more important toward very-high/extreme values. This follows the WHO framing that protection is needed from UVI 3 upward and extra protection is needed at UVI 8+.

Reference: https://www.who.int/news-room/questions-and-answers/item/radiation-the-ultraviolet-(uv)-index

## Visibility and severe weather

Low visibility contributes continuously below 5 km. One WMO table (`WMO_SEVERITY` in `scoreWeatherWindow.ts`) drives the score, the reason codes and the plan gates:

- 28 points, score capped at 25: thunderstorm with hail (96, 99), freezing rain (66, 67), dense freezing drizzle (57);
- 20 points, named `severe-weather`, blocks plan windows: thunderstorm (95), light freezing drizzle (56), heavy snow (75, 86), heavy rain / violent showers (65, 82);
- 14 / 12 / 8 points: moderate snow (73), snow showers (85, also blocks plan windows), slight snow and snow grains (71, 77);
- fog (45, 48): 6 / 8 points.

A code only adds pressure for what the measured data does not already describe: fog adds nothing when visibility is measured, heavy-rain codes add nothing when the rain amount is known. The same phenomenon is therefore not counted twice (and does not trigger the compound penalty twice). High-impact combinations also apply score caps so an otherwise calm hour cannot hide a clearly hazardous signal; the caps live in one function (`applySafetyCaps`) used by the general and every activity score.

## Compound risk

Weather discomfort is not purely additive in real plans. When two or more material risk families occur in the same hour (for example heat + high UV, or rain + strong wind), a bounded compound-risk penalty is applied.

## 12-hour aggregation

The headline score covers the next 12 hours and is **time weighted**, so the same weather does not score differently merely because data arrives every one hour instead of every three hours. A slot never stands for more than one forecast step, so a gap is not credited to the hour before it. The most difficult quarter of the window receives additional weight, preventing a meaningful bad period from disappearing inside a simple average without letting one isolated point dominate the entire day.

The score reads the **hours you could use**: the same recommendable hours (see below) the best window is chosen from, so a cold 03:00 cannot drag down an evening plan. Weather does not remove an hour from the score — a storm hour is not recommendable, but it still counts. Umbrella and wind advice read every hour of the horizon, because the walk home at night still matters.

Hazard hours (hour score ≤ 25) limit the headline: any hazard hour caps it at 74 (caution); three or more hazard hours cap it at 54 (difficult). One thunderstorm hour is therefore a "plan around it" day, not a lost day. The day plan, activities and compare share this rule (`src/domain/decision/aggregateHorizon.ts`).

Forecast steps that already ended are dropped before scoring: at 14:20 the 14:00 slot is "now", the 13:00 slot is gone.

Current bands (`getScoreBand` in `src/domain/decision/scoreWeatherWindow.ts`; this list is checked against the code by `src/__tests__/docs.scoreModel.test.ts`):

- 97–100: Very good / Excellent (Çok uygun). Any named risk caps an hour at 96, so this band means "no warning at all".
- 75–96: Good (Uygun)
- 55–74: Caution (Dikkat)
- 0–54: Difficult (Zorlayıcı)

The UI shows the band word next to the score, not the numeric range.

## Air quality

Each slot uses the fresh exact-hour Open-Meteo European AQI when one exists for that timestamp (conflicting duplicate samples make that hour unknown). Otherwise the fresh current OpenWeather AQI is applied equally to the hour, so it lowers the level of the whole day but never makes "now" look worse than "later". Stale evidence is never used and timestamps are never interpolated. The air-quality card shows the worst index among the hours the score reads, so the card and the score cannot disagree. Running and children activities weight air quality more; laundry gives it zero weight (the AQI 5 safety cap still applies and stays visible).

## Which hours can be recommended

Every hour is scored and shown on the timeline, but only "recommendable" hours can become the best window (`src/domain/decision/eligibility.ts`):

- picnic, children/park, laundry: daylight hours only (`isDay` from Open-Meteo; older data falls back to the icon's `d`/`n` suffix; unknown daylight is not daylight);
- walking, running and the general day plan: 07:00–23:00 local (the 22:00 slot is the last);
- motorcycle: no restriction.

## Now or later

The best window is a range of adjacent near-best slots (within 3 points, no extra named risk) covering at most four hours. It lasts until the **last slot ends** (`endTime`): slots at 18:00, 19:00 and 20:00 are shown as 18:00–21:00, and a single three-hour step as a three-hour range.

"Now or later" is derived from the same 12-hour best window the UI shows: **now** only when the window contains the current hour (and that hour is in a good band), **later** when the window is ahead and clearly better (≥ 10 points) or the current hour is not recommendable (e.g. 01:00), otherwise **similar** and no window is promoted. Every day-plan verdict (score, best window, now/later, umbrella, wind) uses the same 12-hour horizon.

## Decision thresholds

Umbrella, wind, heat/cold and air-quality verdicts come from one file, `src/domain/decision/thresholds.ts`, read by the day plan, the Today headline, the commute plan and the score's reason codes:

- umbrella "yes": precipitation probability ≥ 50 % or ≥ 1 mm/h ("maybe": ≥ 25 % or ≥ 0.2 mm); "rain starts / stops" in the next-change line uses ≥ 50 % or ≥ 0.2 mm;
- strong wind: ≥ 13 m/s or gusts ≥ 20 m/s (caution: ≥ 8 m/s or gusts ≥ 13 m/s);
- heat: feels-like ≥ 30 °C (extreme ≥ 38 °C); cold: feels-like ≤ 7 °C (freezing ≤ 0 °C); personal sensitivity shifts heat/cold by 3 °C in the commute plan;
- air quality (OpenWeather 1–5): sensitive ≥ 3, poor ≥ 4, very poor 5.

## Activity, commute, comparison, and route

- Daily plan, compare, activity and commute use the same base slot scorer.
- Activity scores come from one intent scorer (`src/domain/plan/scoreHour.ts`) with per-activity profiles (`profiles.ts`). The profile **re-weights** the base penalties and replaces the general 22 °C comfort centre with its own comfort range; it never adds a second rain/wind/heat model on top, so no weather factor is counted twice. Personal temperature sensitivity shifts the comfort range.
- Profile gates decide which hours an activity may recommend: daylight / active hours, rain and wind limits (a slot is gated when it goes **above** the limit), and the absolute safety limits (gated **at or above**). Laundry and picnic also need rain evidence: with unknown precipitation they are not recommended and stay out of the good band (≤ 74).
- Laundry is about drying: heat and UV are not penalties. Drying power is the vapour-pressure deficit from temperature and dew point (Tetens; relative humidity is the fallback) plus the hour's sunshine duration: damp air costs up to 22 points, a sunless hour up to 8. Without humidity evidence no drying claim is made. Laundry keeps every safety cap except the human heat-exposure one.
- Mugginess: a high dew point (18 → 24 °C) costs running up to 12 points and children half of that, named "muggy" from about 20 °C. Apparent temperature alone understates how heavy humid air feels during exertion. Walking is not affected.
- Saharan dust: the context endpoint's 24-hour dust peak (µg/m³) counts for running, children (full weight) and walking (0.6) above the WHO PM10 guideline of 45 µg/m³ (up to 18 points at 200), named "dust" from 100 µg/m³. It is applied only while the context evidence is fresh and only to slots inside the 24 hours after the fetch. Laundry and motorcycle ignore it.
- Pollen is scored only for people who switch on "I have a pollen allergy": the higher of the fresh 24-hour grass and olive pollen peaks costs running, picnic and children up to 18 points (walking 0.8 of that) from 20 grains/m³, named "high pollen" from 50. Laundry and motorcycle ignore it, and without the setting pollen changes no score.
- Personal wind and rain tolerance ("I mind it" / balanced / "doesn't bother me") multiply only the comfort penalties for wind and rain (×1.3 / ×1 / ×0.7). Safety caps, the absolute gates and each activity's wind and rain limits are the same for everyone.
- Recommended windows fit the activity's whole duration (walk 60, run 45, picnic 120, children 60, laundry 90, motorcycle 45 minutes): every slot of the block must pass the gates. With hourly data, no fitting block means no window rather than a shorter one; three-hourly data falls back to the near-best range. Up to two non-overlapping alternatives are shown.
- "Why this range?" names the factor whose penalty most separates the window from the plan's other usable hours (at least 6 points), with the measured values on both sides; when no factor separates them, no reason is shown.
- Compare prefers the real one-hour data and falls back to the three-hour series if needed.
- Route scoring has fewer provider signals, so it uses continuous temperature, rain-probability and wind curves plus downside weighting instead of pretending it has UV/gust/visibility data it does not receive.

## Depends on the rain

When some of the hours a headline reads have a genuinely open rain chance (30–70 %), those hours are re-scored twice with the same scorer: as if the shower comes (90 %, at least 1 mm) and as if it stays away (5 %, 0 mm). Every other hour keeps its score, and the same aggregation gives a wet and a dry headline. The range is shown ("depends on the rain: 58 if it rains, 86 if it stays dry") only when the two differ by at least 8 points; the day plan, activities and coming days share this rule (`rainScenarioRange` in `aggregateHorizon.ts`). Lead time is not turned into an invented ± band: it stays the confidence label.

When two hours or two activity windows score the same, the one whose rain forecast is more decided (chance further from 50 %; unknown counts as most open) is preferred, then the earlier one.

## Coming days and weekend compare

`buildDayOutlook` (`src/domain/plan/dayOutlook.ts`) splits the five-day hourly forecast into local calendar days and scores each day with the same hour scorer, gates, duration-fit windows and aggregation as the live plan, restricted to that day's hours: "tomorrow" is what tomorrow's plan will say if the forecast holds. Today only counts the hours that are left, and a day with fewer than four usable hours is not summarised. Confidence follows lead time (medium beyond 24 h, low from 72 h) and is shown as "forecast" / "uncertain forecast". The current AQI reading is used only for today; later days use the exact-hour AQI forecast or nothing.

Compare can be switched from "next 12 hours" to a coming day. The winner is then decided by that day's score, and the current-conditions metrics (temperature, wind, rain now, AQI now) are replaced by the day's main factor so a Saturday verdict is never shown next to today's readings.

## Product interpretation

The UI shows the dominant approximate score impacts and the data-coverage level. Impact values are explanatory approximations, not an accounting identity: risk caps and downside weighting mean the displayed factor impacts do not have to sum exactly to `100 - score`.
