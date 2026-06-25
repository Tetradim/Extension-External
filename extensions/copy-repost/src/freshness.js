(function installCopyRepostFreshness() {
  const global = typeof window !== "undefined" ? window : globalThis;
  const defaultFreshnessWindowMinutes = 10;
  const minFreshnessWindowMinutes = 1;
  const maxFreshnessWindowMinutes = 1440;

  function normalizeFreshnessWindowMinutes(value) {
    const numeric = Number.parseInt(String(value ?? ""), 10);
    if (
      !Number.isInteger(numeric) ||
      numeric < minFreshnessWindowMinutes ||
      numeric > maxFreshnessWindowMinutes
    ) {
      return defaultFreshnessWindowMinutes;
    }
    return numeric;
  }

  function payloadFreshness(payload, options = {}) {
    const maxAgeMinutes = normalizeFreshnessWindowMinutes(
      Object.hasOwn(options, "maxAgeMinutes") ? options.maxAgeMinutes : defaultFreshnessWindowMinutes
    );
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
    const timestampIso = typeof payload?.timestampIso === "string" ? payload.timestampIso.trim() : "";

    if (!timestampIso) {
      return { fresh: false, reason: "missing Discord timestamp", ageMs: null, maxAgeMs };
    }

    const messageMs = Date.parse(timestampIso);
    if (!Number.isFinite(messageMs)) {
      return { fresh: false, reason: "invalid Discord timestamp", ageMs: null, maxAgeMs };
    }

    const ageMs = nowMs - messageMs;
    if (ageMs > maxAgeMs) {
      return { fresh: false, reason: "message older than freshness window", ageMs, maxAgeMs };
    }

    return { fresh: true, reason: "fresh", ageMs, maxAgeMs };
  }

  global.CopyRepostFreshness = {
    defaultFreshnessWindowMinutes,
    maxFreshnessWindowMinutes,
    minFreshnessWindowMinutes,
    normalizeFreshnessWindowMinutes,
    payloadFreshness
  };
})();
