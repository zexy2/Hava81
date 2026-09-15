# Hava81 data integrity contract

Hava81 is decision-first weather guidance. The interface must remain useful without overstating what a provider or model can prove.

## Provider boundaries

- OpenWeather is the core source for current conditions and forecast data.
- Open-Meteo is an additional context source for supported UV, dust, pollen and marine variables.
- Every modeled context surface should expose its provider and fetch freshness when that information is available.
- A provider outage, stale response or unavailable variable must remain visible as unavailable data; do not silently substitute an invented value.

## Precipitation language

- Open-Meteo 15-minute precipitation in regions where the provider documents interpolation is model guidance.
- It must not be labeled as radar, radar nowcast or observed precipitation.
- Product copy should prefer explicit wording such as “modeled precipitation guidance” when the distinction matters to a decision.

## Warnings and safety

- Official MGM warnings are authoritative only when Hava81 has a verified, stable, freshness-aware official feed.
- Until that feed is verified, Hava81 must not present scraped or inferred text as an official warning.
- Hava81 recommendations are general decision support, not medical, emergency, navigation or marine-safety advice.
- Route weather is an approximate corridor estimate, not turn-by-turn routing or road-safety assurance.

## Review checklist

Before shipping a weather or decision change, verify:

1. The source and model semantics are named in code or product copy.
2. Freshness, cache state and unavailable data remain distinguishable.
3. New thresholds are backed by existing product semantics or documented evidence.
4. Any warning or safety claim has an authoritative source and an explicit freshness check.
5. Tests cover the provider failure or missing-data path, not only the happy path.

This document is a product and engineering contract; it does not replace provider documentation or official emergency guidance.
