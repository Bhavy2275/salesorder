/**
 * TeamLeaderboard.jsx — Salesperson performance table with rank, sparkline-like bars, medals
 */
import clsx from 'clsx';
import { Trophy, TrendingUp } from 'lucide-react';

const INR = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1,
}).format(n || 0);

const MEDALS = ['🥇', '🥈', '🥉'];

export default function TeamLeaderboard({ data = [], loading }) {
  const maxRevenue = data.length > 0 ? Math.max(...data.map((d) => Number(d.gross_revenue))) : 1;

  if (loading) return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="shimmer h-6 w-48 rounded mb-5" />
      {Array(6).fill(0).map((_, i) => (
        <div key={i} className="shimmer h-14 rounded-xl mb-2" />
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Trophy size={18} className="text-amber-500" />
        <div>
          <h3 className="text-base font-bold text-gray-900">Team Leaderboard</h3>
          <p className="text-xs text-gray-400">Ranked by gross revenue in period</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-sm">No data for selected period.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((rep, i) => {
            const pct = (Number(rep.gross_revenue) / maxRevenue) * 100;
            const conversion = Number(rep.conversion_rate);

            return (
              <div
                key={rep.salesperson_id}
                className={clsx(
                  'rounded-xl p-3 border transition-all',
                  i === 0 ? 'border-amber-200 bg-amber-50' :
                  i === 1 ? 'border-gray-200 bg-gray-50/60' :
                  i === 2 ? 'border-orange-100 bg-orange-50/40' :
                  'border-gray-100 bg-white hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="text-base w-8 text-center shrink-0">
                    {MEDALS[i] || <span className="text-xs font-bold text-gray-400">#{i + 1}</span>}
                  </div>

                  {/* Avatar */}
                  <div className={clsx(
                    'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold',
                    i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : 'bg-violet-500'
                  )}>
                    {rep.salesperson_name?.[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-900 truncate">{rep.salesperson_name}</p>
                      <p className="text-sm font-black text-gray-800 ml-2 shrink-0">{INR(rep.gross_revenue)}</p>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden mr-3">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400 shrink-0">
                        <span><span className="font-semibold text-gray-600">{rep.total_orders}</span> orders</span>
                        <span>
                          <span className={clsx('font-semibold', conversion >= 80 ? 'text-green-600' : conversion >= 60 ? 'text-amber-600' : 'text-red-500')}>
                            {conversion}%
                          </span> conv.
                        </span>
                        <span><span className="font-semibold text-gray-600">{rep.clients_visited}</span> clients</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
