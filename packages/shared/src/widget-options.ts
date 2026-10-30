// Zod-free, so the widget loader can use them (through `@askwell/shared/embed`) without bundling zod.

export const WIDGET_POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"] as const;
export type WidgetPosition = (typeof WIDGET_POSITIONS)[number];

export const WIDGET_ANIMATIONS = ["fade", "slide", "scale"] as const;
export type WidgetAnimation = (typeof WIDGET_ANIMATIONS)[number];

export const WIDGET_LABEL_MAX_LENGTH = 40;
export const WIDGET_HEADER_TEXT_MAX_LENGTH = 60;

/** `#rrggbb` */
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
