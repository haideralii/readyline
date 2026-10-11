import type { z } from "zod";
import type { ExistingStep as ExistingStepSchema } from "./schema";

export type ExistingStep = z.infer<typeof ExistingStepSchema>;
