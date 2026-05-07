import { Gamepad2, ChefHat, TrendingUp, Shuffle, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  'pattern-match':      Gamepad2,
  'kitchen-dodgeball':  ChefHat,
  'skrillatime':        TrendingUp,
  'chooser':            Shuffle,
};

export function ExplorationIcon({ id, size = 20 }: { id: string; size?: number }) {
  const Icon = ICONS[id];
  return Icon ? <Icon size={size} strokeWidth={1.5} className="text-fg-muted" /> : null;
}
