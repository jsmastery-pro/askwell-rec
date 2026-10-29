import { z } from "zod";

export const WIDGET_POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"] as const;
export const WidgetPositionSchema = z.enum(WIDGET_POSITIONS);
export type WidgetPosition = z.infer<typeof WidgetPositionSchema>;

export const WIDGET_ANIMATIONS = ["fade", "slide", "scale"] as const;
export const WidgetAnimationSchema = z.enum(WIDGET_ANIMATIONS);
export type WidgetAnimation = z.infer<typeof WidgetAnimationSchema>;

export const WIDGET_LABEL_MAX_LENGTH = 40;
export const WIDGET_HEADER_TEXT_MAX_LENGTH = 60;

/** `#rrggbb` */
export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex color like #000000");

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
