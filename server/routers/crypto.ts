import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { buildLiveScanner } from "../crypto/marketService";

export const cryptoRouter = router({
  scanner: publicProcedure.input(z.object({ forceRefresh: z.boolean().optional() }).optional()).query(({ input }) => buildLiveScanner(input?.forceRefresh ?? false)),
});
