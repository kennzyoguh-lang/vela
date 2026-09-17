import { z } from "zod";

export const staffLeaderboardRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
