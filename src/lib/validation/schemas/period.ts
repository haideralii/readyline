import { z } from "zod";

/**
 * REQ-023 FR-5, SR-3: the three optional strings a period-filtered route
 * accepts in its strict query (`period`, `from`, `to`). The shape itself
 * (the closed list, two real ISO dates, the order, the ten-year span) is
 * checked by `parsePeriodParams` in `src/lib/registers/period.ts`; nothing
 * here is trusted into a query, and a refusal answers 400 with no echo.
 */
export const PERIOD_QUERY_FIELDS = {
  period: z.string().max(20).optional(),
  from: z.string().max(10).optional(),
  to: z.string().max(10).optional(),
};
