/**
 * AI integration configuration.
 * Reads from env vars — gracefully disabled when not configured.
 *
 * Required env vars (all optional — AI features disabled if absent):
 *   OPENCLAW_URL        - Base URL of the OpenClaw instance
 *   AI_AUTO_APPROVE     - 'true'/'1' to auto-apply suggestions without manual approval
 *   AI_MAX_SHIFT_PCT    - Max allowed % change per asset per suggestion (safety guard)
 */

export interface AIConfig {
  /** Base URL of OpenClaw instance, e.g. "http://localhost:8080" */
  openclawUrl: string;
  /** Auto-apply suggestions without manual approval step */
  autoApprove: boolean;
  /** Max allowed absolute % shift per asset in a single suggestion (default: 20) */
  maxAllocationShiftPct: number;
  /** Whether AI features are enabled (false when OPENCLAW_URL is not set) */
  enabled: boolean;
}

function parseBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Singleton AI configuration derived from environment variables.
 * All AI features are disabled (enabled=false) when OPENCLAW_URL is not set.
 */
export const aiConfig: AIConfig = (() => {
  const openclawUrl = process.env.OPENCLAW_URL ?? "";
  const enabled = openclawUrl.length > 0;

  if (!enabled) {
    console.info("[AIConfig] OPENCLAW_URL not set — AI suggestions disabled");
  }

  return {
    openclawUrl,
    enabled,
    autoApprove: parseBoolean(process.env.AI_AUTO_APPROVE),
    maxAllocationShiftPct: parsePositiveNumber(process.env.AI_MAX_SHIFT_PCT, 20),
  };
})();
