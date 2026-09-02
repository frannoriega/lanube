import {
  Armchair,
  BookOpen,
  Boxes,
  Building2,
  Camera,
  Coffee,
  Cpu,
  DoorOpen,
  FlaskConical,
  Gamepad2,
  Globe,
  GraduationCap,
  LayoutGrid,
  Laptop,
  Lightbulb,
  type LucideIcon,
  MapPin,
  MessagesSquare,
  Mic,
  Monitor,
  Music,
  Palette,
  Presentation,
  Printer,
  Projector,
  Rocket,
  Users,
  Video,
  Wifi,
  Wrench,
  // ── metadata (feature) icons — used by getMetadataIcon below ───────────────
  BarChart2,
  CheckCircle,
  Clock,
  Maximize,
  Package,
  Radio,
  Shield,
  Speaker,
  Star,
  Sun,
  Thermometer,
  Tv,
  Volume2,
  Zap,
} from "lucide-react";

/**
 * Curated, ordered set of icons a superadmin can assign to a Space (icon picker in the
 * spaces manager). The **keys are persisted** in `Space.iconName` and resolved back to a
 * component by {@link getSpaceIcon} — keep them stable. The same icon then appears on the
 * user sidebar, the space cards and the reservation calendar, so a renamed/added space stays
 * in sync automatically. Add new options by extending this record; nothing else changes.
 */
export const SPACE_ICONS = {
  LayoutGrid,
  Building2,
  Users,
  FlaskConical,
  MessagesSquare,
  Presentation,
  Projector,
  GraduationCap,
  Laptop,
  Monitor,
  Cpu,
  Coffee,
  BookOpen,
  Armchair,
  DoorOpen,
  Mic,
  Camera,
  Video,
  Printer,
  Wrench,
  Boxes,
  Wifi,
  Lightbulb,
  Rocket,
  Palette,
  Music,
  Gamepad2,
  Globe,
  MapPin,
} satisfies Record<string, LucideIcon>;

export type SpaceIconName = keyof typeof SPACE_ICONS;

/** Ordered `[name, Icon]` pairs for rendering the picker grid. */
export const SPACE_ICON_OPTIONS = Object.entries(SPACE_ICONS) as [
  SpaceIconName,
  LucideIcon,
][];

/** Fallback when a space has no icon (or an unknown/legacy name). */
export const FALLBACK_SPACE_ICON: LucideIcon = LayoutGrid;

export function getSpaceIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return FALLBACK_SPACE_ICON;
  return (
    (SPACE_ICONS as Record<string, LucideIcon>)[iconName] ?? FALLBACK_SPACE_ICON
  );
}

const METADATA_ICON_MAP: Record<string, LucideIcon> = {
  Wifi,
  Clock,
  Users,
  Monitor,
  Laptop,
  Zap,
  MapPin,
  BookOpen,
  Coffee,
  Printer,
  Camera,
  Volume2,
  Sun,
  Thermometer,
  Shield,
  Globe,
  Maximize,
  Star,
  CheckCircle,
  BarChart2,
  Mic,
  Projector,
  Tv,
  Package,
  Wrench,
  Building2,
  FlaskConical,
  MessagesSquare,
  Presentation,
  Radio,
  Speaker,
};

export function getMetadataIcon(iconName: string | undefined): LucideIcon {
  if (!iconName) return Star;
  return METADATA_ICON_MAP[iconName] ?? Star;
}
