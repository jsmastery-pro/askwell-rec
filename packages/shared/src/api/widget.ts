import { z } from "zod";
import { PublicKeySchema } from "../entities";
import { MESSAGE_MAX_LENGTH } from "../limits";
import { WidgetConfigSchema } from "../widget";

// GET /api/widget/config?key=pk_...
export const WidgetConfigRequestSchema = z.object({ key: PublicKeySchema });
export type WidgetConfigRequest = z.infer<typeof WidgetConfigRequestSchema>;

/** Plan-applied: Free always gets `DEFAULT_WIDGET_CONFIG`. */
export const WidgetConfigResponseSchema = z.object({ config: WidgetConfigSchema });
export type WidgetConfigResponse = z.infer<typeof WidgetConfigResponseSchema>;

// POST /api/widget/chat
export const WidgetChatRequestSchema = z.object({
  key: PublicKeySchema,
  visitorId: z.uuid(),
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
});
export type WidgetChatRequest = z.infer<typeof WidgetChatRequestSchema>;

export const WidgetChatResponseSchema = z.object({
  conversationId: z.uuid(),
  reply: z.string(),
});
export type WidgetChatResponse = z.infer<typeof WidgetChatResponseSchema>;
