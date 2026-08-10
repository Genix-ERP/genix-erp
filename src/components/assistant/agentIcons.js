import {
  Bot, Wallet, TrendingUp, Package, ShoppingCart, Users, HardHat,
  UserCheck, CheckSquare, Factory,
} from 'lucide-react';

// Backend agent catalog icon name → lucide component. Shared by the workspace
// (suggestion chips) and the Studio (module group headers).
export const AGENT_ICONS = {
  bot: Bot,
  wallet: Wallet,
  'trending-up': TrendingUp,
  package: Package,
  'shopping-cart': ShoppingCart,
  users: Users,
  'hard-hat': HardHat,
  'user-check': UserCheck,
  'check-square': CheckSquare,
  factory: Factory,
};

export default AGENT_ICONS;
