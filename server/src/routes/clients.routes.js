/** Lightweight client lookup used by the mobile checkout client picker. */
import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/rbac.js';
import { supabaseAdmin } from '../config/db.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();
router.use(authenticate, authorize('salesperson', 'manager', 'admin'));

router.get('/', async (req, res, next) => {
  try {
    const queryText = String(req.query.q || '').trim().slice(0, 80);
    let query = supabaseAdmin
      .from('clients')
      .select('id, business_name, contact_person, mobile_primary, delivery_address, payment_terms, price_tier')
      .is('deleted_at', null)
      .order('business_name', { ascending: true })
      .limit(Math.max(1, Math.min(parseInt(req.query.limit, 10) || 10, 25)));

    if (req.user.role === 'salesperson') query = query.eq('assigned_salesperson_id', req.user.id);
    if (queryText) {
      const safeText = queryText.replace(/[(),.%_\\]/g, ' ');
      query = query.or(`business_name.ilike.%${safeText}%,contact_person.ilike.%${safeText}%,mobile_primary.ilike.%${safeText}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return sendSuccess(res, { data: data || [] });
  } catch (err) {
    return next(err);
  }
});

export default router;
