import { z } from "zod";
import { getApiContractMetadata } from "@shared/apiContract";
import { getAuthAdapter } from "./authAdapter";
import { getNotificationAdapter } from "../adapters/notifications";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  contract: publicProcedure.query(() => ({
    ...getApiContractMetadata(),
    authentication: getAuthAdapter().getOidcReadiness(),
  })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = (await getNotificationAdapter().notifyOwner(input)).accepted;
      return {
        success: delivered,
      } as const;
    }),
});
