# Hava81 data honesty

Hava81 is decision-first weather guidance, not a replacement for official warnings or professional safety advice.

## What the product can claim

- Core current conditions and forecasts are normalized from server-side provider adapters.
- Environmental context such as UV, dust, pollen and marine signals is modeled context and is shown with provider/freshness attribution when available.
- Route weather is an approximate weather corridor sampled along a path. It is not turn-by-turn navigation, road-safety assurance or a guarantee of conditions between samples.

## What the product must not claim

- Hava81 must not present modeled guidance as an official warning.
- MGM MeteoUyarı is only authoritative when a stable, freshness-aware official source is verified and clearly attributed.
- Open-Meteo precipitation values that are interpolated for a region must not be labeled as radar nowcast.
- Marine context is informational and must not be presented as navigation or maritime safety advice.

## UI and operational requirements

1. Keep provider, fetch time/freshness and unavailable states visible where the data is used.
2. Prefer "modeled guidance" or "context" wording for non-official signals.
3. Preserve the distinction between an official hazard warning and Hava81's own action recommendation.
4. When a provider is degraded, fail closed on claims: show the limitation rather than inventing a value.
5. Any future warning integration must document source stability, freshness semantics and fallback behavior before release.

This document is intentionally short and normative so product copy, tests and deployment reviews can reference one source of truth.
