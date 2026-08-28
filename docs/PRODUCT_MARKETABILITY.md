# Hava81 product marketability filter

## Why this exists

The weather category is crowded. Hava81 must not ship features merely because weather apps usually have them. A feature is worth product space only when it helps a user make a recurring decision faster, can be demonstrated in a few seconds, and is backed by data whose meaning we can explain.

## Commodity features are not the moat

Useful but non-differentiating capabilities include raw current conditions, hourly/daily forecasts, generic radar/maps, AQI/UV cards, severe-weather notifications, feels-like values, and route weather by themselves. Hava81 may use these as inputs or supporting surfaces, but marketing should not present their mere existence as the reason to switch.

## Product gate

Before adding or expanding a feature, require all of the following:

1. **Recurring job:** a normal person can plausibly use it at least weekly, preferably daily.
2. **Action output:** it ends in a concrete choice such as go now, wait, take an umbrella, change the time, or choose one city over another.
3. **Ten-second demo:** the value can be shown in one short screen recording without explaining meteorology.
4. **Trustworthy semantics:** every recommendation maps to real forecast/model inputs; uncertainty and model-only data stay explicit.
5. **Better than a glance at a generic forecast:** the user should not get the same answer by reading temperature and rain probability for five seconds.

If a proposal fails this gate, defer it even if it is visually attractive or common in competing apps.

## Marketable core

### 1. Çıkış planı / Out-and-back plan

User saves when they normally leave and return. Hava81 compares the nearest forecast windows and answers the everyday preparation question directly: umbrella or not, whether return-time rain/wind worsens, and whether the temperature changes materially.

Example demo line:

> 08:30'da çıkıyorsun, 18:00'de dönüyorsun: şemsiyeyi al; dönüşte yağmur riski belirgin artıyor.

This is intentionally routine-first, not another hourly chart.

### 2. Decision-change alerts

Notify only when the user's decision changes materially: a previously safe commute becomes rainy, the best activity window moves, or a favorite city's plan becomes difficult. Long-term value requires reliable background/server-side delivery rather than only an open-tab notification.

### 3. Question-led comparison

Comparison should answer a real choice (for example, which favorite city is better for a weekend picnic under current weather criteria) rather than display two weather columns.

### 4. Türkiye-specific trusted context

Official warnings, frost/icing, dust, pollen, marine or road modules matter only when a stable source and freshness semantics are verified. Never manufacture a Turkey-specific moat by relabeling modeled data as an official or observed warning.

## Explicit de-priorities

- decorative weather animations with no decision value
- additional generic charts or cards that repeat existing raw data
- pseudo-radar / interpolated precipitation presented as nowcast
- weak "AI" copy that cannot explain the underlying inputs
- route claims that imply navigation-grade routing before a real route provider exists
- official-warning branding without a verified official feed

## Positioning

Primary promise:

> Havayı değil, gününü planla.

Proof should come from concrete recurring decisions, not from the number of weather metrics on screen.
