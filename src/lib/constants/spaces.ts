import {
  Building2,
  FlaskConical,
  LucideIcon,
  MessagesSquare,
  Presentation,
  LayoutGrid,
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
  Radio,
  Speaker,
} from "lucide-react";

const SPACE_ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  FlaskConical,
  MessagesSquare,
  Presentation,
};

export function getSpaceIcon(iconName: string): LucideIcon {
  return SPACE_ICON_MAP[iconName] ?? LayoutGrid;
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
