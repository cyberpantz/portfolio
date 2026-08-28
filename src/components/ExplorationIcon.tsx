import {
  Gamepad2,
  ChefHat,
  TrendingUp,
  Shuffle,
  ListChecks,
  CloudSun,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  'quizzolator': ListChecks,
  'pattern-match': Gamepad2,
  'wage-gap': TrendingUp,
  'weather-vibe': CloudSun,
  'chooser': Shuffle,
  'kitchen-dodgeball': ChefHat,
};

export function ExplorationIcon({ id, size = 20 }: { id: string; size?: number }) {
  const Icon = ICONS[id];
  return Icon ? <Icon size={size} strokeWidth={1.5} className="text-fg-muted" /> : null;
}
