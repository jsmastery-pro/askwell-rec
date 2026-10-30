import { z } from "zod";
import {
  HEX_COLOR_PATTERN,
  WIDGET_ANIMATIONS,
  WIDGET_HEADER_TEXT_MAX_LENGTH,
  WIDGET_LABEL_MAX_LENGTH,
  WIDGET_POSITIONS,
} from "./widget-options";

export const WidgetPositionSchema = z.enum(WIDGET_POSITIONS);
export const WidgetAnimationSchema = z.enum(WIDGET_ANIMATIONS);

/** `#rrggbb` */
export const HexColorSchema = z
  .string()
  .regex(HEX_COLOR_PATTERN, "Expected a hex color like #000000");

export const WidgetConfigSchema = z.object({
  buttonColor: HexColorSchema,
  position: WidgetPositionSchema,
  label: z.string().trim().min(1).max(WIDGET_LABEL_MAX_LENGTH),
  animation: WidgetAnimationSchema,
  headerText: z.string().trim().min(1).max(WIDGET_HEADER_TEXT_MAX_LENGTH),
  showBadge: z.boolean(),
});
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;

/** The Free look, and the starting config of every new project. */
export const DEFAULT_WIDGET_CONFIG = {
  buttonColor: "#000000",
  position: "bottom-right",
  label: "Chat with us",
  animation: "fade",
  headerText: "How can we help?",
  showBadge: true,
} as const satisfies WidgetConfig;
