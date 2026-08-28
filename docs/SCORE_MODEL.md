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
- current OpenWeather air-quality category.

The existing OpenWeather three-hour forecast remains the resilient fallback. Missing optional fields do not make the score fail; the UI exposes `high`, `medium`, or `basic` data coverage.

## Thermal stress

Provider apparent temperature is preferred. If it is unavailable, Hava81 derives a fallback using the US National Weather Service heat-index approach for hot/humid conditions and the NWS wind-chill equation for cold/windy conditions. The score uses smooth curves around the comfort range rather than abrupt temperature thresholds.

References:

- NWS Heat Index equation: https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
- NWS Wind Chill: https://www.weather.gov/safety/cold-wind-chill-chart

## Rain

Probability and intensity are deliberately separate. A high chance of a trace amount is not treated like a lower-probability multi-millimeter downpour. When hourly precipitation amount is unavailable, probability alone provides a weaker fallback signal.

## Wind

Sustained wind and gusts are evaluated together. Gusts can therefore reduce suitability even when the mean wind speed appears moderate.

## UV

UV starts contributing from UVI 3 and becomes progressively more important toward very-high/extreme values. This follows the WHO framing that protection is needed from UVI 3 upward and extra protection is needed at UVI 8+.

Reference: https://www.who.int/news-room/questions-and-answers/item/radiation-the-ultraviolet-(uv)-index

## Visibility and severe weather

Low visibility contributes continuously below 5 km. WMO codes for thunderstorms, hail, freezing rain, heavy snow/showers, snow, and fog add event-specific pressure. High-impact combinations also apply score caps so an otherwise calm hour cannot hide a clearly hazardous signal.

## Compound risk

Weather discomfort is not purely additive in real plans. When two or more material risk families occur in the same hour (for example heat + high UV, or rain + strong wind), a bounded compound-risk penalty is applied.

## 12-hour aggregation

The headline score covers the next 12 hours and is **time weighted**, so the same weather does not score differently merely because data arrives every one hour instead of every three hours. The most difficult quarter of the window receives additional weight, preventing a meaningful bad period from disappearing inside a simple average without letting one isolated point dominate the entire day.

Current bands:

- 90–100: Very good / Excellent
- 75–89: Good
- 55–74: Caution
- 0–54: Difficult

## Activity, commute, comparison, and route

- Daily plan, compare, activity and commute use the same base slot scorer.
- Activity scores apply smooth activity-specific sensitivity on top of the base score (running, walking, picnic, children, motorcycle, laundry).
- Compare prefers the real one-hour data and falls back to the three-hour series if needed.
- Route scoring has fewer provider signals, so it uses continuous temperature, rain-probability and wind curves plus downside weighting instead of pretending it has UV/gust/visibility data it does not receive.

## Product interpretation

The UI shows the dominant approximate score impacts and the data-coverage level. Impact values are explanatory approximations, not an accounting identity: risk caps and downside weighting mean the displayed factor impacts do not have to sum exactly to `100 - score`.
