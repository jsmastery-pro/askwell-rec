import "server-only";
import {
  DEFAULT_WIDGET_CONFIG,
  PLAN_LIMITS,
  PlanSchema,
  WidgetConfigSchema,
  type CustomizationRights,
  type WidgetConfig,
} from "@askwell/shared";
import { createServiceClient } from "../supabase/service";

type StoredWidgetConfig = {
  button_color: string;
  position: string;
  label: string;
  animation: string;
  header_text: string;
  show_badge: boolean;
};

/**
 * The widget's look for a public key, with the owner's plan applied on the server:
 * each field the plan can't change is forced to `DEFAULT_WIDGET_CONFIG` (so Free always gets
 * the defaults and the badge). `null` for an unknown key. Returns the config only, never
 * project or owner ids. Used by `GET /api/widget/config` and the `/embed` panel.
 */
export async function getPublicWidgetConfig(publicKey: string): Promise<WidgetConfig | null> {
  // Public routes resolve the project from `public_key` only (project.md §7).
  const { data, error } = await createServiceClient()
    .from("projects")
    .select(
      "accounts(plan), widget_configs(button_color, position, label, animation, header_text, show_badge)",
    )
    .eq("public_key", publicKey)
    .maybeSingle();

  if (error) throw new Error(`getPublicWidgetConfig: ${error.message}`, { cause: error });
  if (!data) return null;

  // An unknown plan value gets Free's rights.
  const plan = PlanSchema.catch("free").parse(data.accounts?.plan);
  return applyPlan(data.widget_configs, PLAN_LIMITS[plan].customization);
}

function applyPlan(stored: StoredWidgetConfig | null, rights: CustomizationRights): WidgetConfig {
  // A missing or invalid row falls back to the defaults rather than failing the widget.
  const parsed = WidgetConfigSchema.safeParse(stored && toWidgetConfig(stored));
  if (!parsed.success) return { ...DEFAULT_WIDGET_CONFIG };
  const config = parsed.data;

  return {
    buttonColor: rights.buttonColor ? config.buttonColor : DEFAULT_WIDGET_CONFIG.buttonColor,
    position: rights.position ? config.position : DEFAULT_WIDGET_CONFIG.position,
    label: rights.label ? config.label : DEFAULT_WIDGET_CONFIG.label,
    animation: rights.animation ? config.animation : DEFAULT_WIDGET_CONFIG.animation,
    headerText: rights.headerText ? config.headerText : DEFAULT_WIDGET_CONFIG.headerText,
    showBadge: rights.hideBadge ? config.showBadge : DEFAULT_WIDGET_CONFIG.showBadge,
  };
}

function toWidgetConfig(row: StoredWidgetConfig) {
  return {
    buttonColor: row.button_color,
    position: row.position,
    label: row.label,
    animation: row.animation,
    headerText: row.header_text,
    showBadge: row.show_badge,
  };
}
