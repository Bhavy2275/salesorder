/**
 * StatusBadge.jsx — Order status chip (Web Admin)
 */
import clsx from 'clsx';
import { Clock, Package, Truck, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const CONFIG = {
  placed:     { label: 'Pending',    icon: Clock,       cls: 'badge-placed' },
  picking:    { label: 'Picking',    icon: Loader2,     cls: 'badge-picking' },
  packed:     { label: 'Packed',     icon: Package,     cls: 'badge-packed' },
  dispatched: { label: 'Dispatched', icon: Truck,       cls: 'badge-dispatched' },
  delivered:  { label: 'Delivered',  icon: CheckCircle, cls: 'badge-delivered' },
  cancelled:  { label: 'Cancelled',  icon: XCircle,     cls: 'badge-cancelled' },
};

export default function StatusBadge({ status, size = 'sm' }) {
  const cfg = CONFIG[status] || CONFIG.placed;
  const Icon = cfg.icon;
  return (
    <span className={clsx('badge', cfg.cls, size === 'lg' && 'text-sm px-3 py-1.5')}>
      <Icon size={size === 'lg' ? 14 : 11} />
      {cfg.label}
    </span>
  );
}
