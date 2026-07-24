/**
 * cartStore.js — Global Cart State (Zustand)
 *
 * Manages the in-memory shopping cart during an order session.
 * Persisted to AsyncStorage so it survives app backgrounding.
 *
 * Cart item shape:
 * {
 *   productId: string,
 *   name: string,
 *   sku_code: string,
 *   unit: string,
 *   unit_price: number,      // Price at time of adding to cart
 *   mrp: number,
 *   gst_percent: number,
 *   quantity: number,
 *   free_qty: number,        // From scheme (e.g., buy 10 get 1 free)
 *   scheme_id: string|null,
 *   scheme_name: string|null,
 *   image_url: string|null,
 *   stock_qty: number,
 *   allow_backorder: boolean,
 * }
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Scheme calculation helpers ───────────────────────────────────────────────

/**
 * Calculate free items from a quantity-based scheme.
 * e.g. Buy 10 Get 1 Free: order 20 → get 2 free.
 */
function calculateFreeQty(quantity, scheme) {
  if (!scheme || scheme.scheme_type !== 'quantity_based') return 0;
  if (!scheme.buy_quantity || !scheme.free_quantity) return 0;
  return Math.floor(quantity / scheme.buy_quantity) * scheme.free_quantity;
}

/**
 * Calculate the line-level discount for a cart item.
 */
function calculateLineDiscount(item) {
  if (!item.scheme_id) return 0;

  if (item.free_qty > 0) {
    // Value of free items is the discount
    return item.free_qty * item.unit_price;
  }

  if (item.scheme?.discount_percent) {
    return (item.unit_price * item.quantity * item.scheme.discount_percent) / 100;
  }

  if (item.scheme?.discount_flat) {
    return item.scheme.discount_flat;
  }

  return 0;
}

// ─── Cart totals calculator ───────────────────────────────────────────────────

function computeTotals(items) {
  let subtotal = 0;
  let totalGst = 0;
  let totalDiscount = 0;

  items.forEach((item) => {
    const lineSubtotal = item.unit_price * item.quantity;
    const lineGst = (lineSubtotal * item.gst_percent) / 100;
    const lineDiscount = calculateLineDiscount(item);

    subtotal += lineSubtotal;
    totalGst += lineGst;
    totalDiscount += lineDiscount;
  });

  const grandTotal = subtotal + totalGst - totalDiscount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    total_gst: Math.round(totalGst * 100) / 100,
    discount_amount: Math.round(totalDiscount * 100) / 100,
    grand_total: Math.max(0, Math.round(grandTotal * 100) / 100),
    item_count: items.length,
    total_quantity: items.reduce((sum, i) => sum + i.quantity + i.free_qty, 0),
  };
}

// ─── Zustand Store ────────────────────────────────────────────────────────────

export const useCartStore = create(
  persist(
    (set, get) => ({
      // ── State ───────────────────────────────────────────────────────────────
      items: [],          // CartItem[]
      clientId: null,     // Selected client for this order
      clientName: null,
      notes: '',
      deliveryDate: null,

      // ── Computed (derived, not stored — call getCartTotals()) ───────────────

      // ── Actions ─────────────────────────────────────────────────────────────

      /**
       * Add a product to cart or increment its quantity.
       * If the product is already in cart, increments by `qty`.
       */
      addToCart: (product, qty = 1) => {
        const { items } = get();
        const existingIndex = items.findIndex((i) => i.productId === product.id);

        if (existingIndex >= 0) {
          // Product already in cart — update quantity
          const updated = [...items];
          const item = { ...updated[existingIndex] };
          item.quantity = item.quantity + qty;
          item.free_qty = calculateFreeQty(item.quantity, item.scheme);
          updated[existingIndex] = item;
          set({ items: updated });
        } else {
          // New item
          const newItem = {
            productId: product.id,
            name: product.name,
            sku_code: product.sku_code,
            unit: product.unit,
            unit_price: product.effective_price,
            mrp: product.mrp,
            gst_percent: product.gst_percent,
            quantity: qty,
            free_qty: calculateFreeQty(qty, product.scheme),
            scheme_id: product.scheme?.id || null,
            scheme_name: product.scheme?.name || null,
            scheme: product.scheme || null,
            image_url: product.images?.[0] || null,
            stock_qty: product.stock_qty,
            allow_backorder: product.allow_backorder,
          };
          set({ items: [...items, newItem] });
        }
      },

      /**
       * Set the exact quantity for a cart item.
       * If qty <= 0, removes the item.
       */
      setQuantity: (productId, qty) => {
        const { items } = get();

        if (qty <= 0) {
          set({ items: items.filter((i) => i.productId !== productId) });
          return;
        }

        const updated = items.map((item) => {
          if (item.productId !== productId) return item;
          return {
            ...item,
            quantity: qty,
            free_qty: calculateFreeQty(qty, item.scheme),
          };
        });

        set({ items: updated });
      },

      /** Remove a product from cart entirely. */
      removeFromCart: (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) });
      },

      /** Clear the entire cart (after order is placed or user resets). */
      clearCart: () => {
        set({
          items: [],
          clientId: null,
          clientName: null,
          notes: '',
          deliveryDate: null,
        });
      },

      /** Set the client for this order. */
      setClient: (clientId, clientName) => {
        set({ clientId, clientName });
      },

      /** Update order-level metadata. */
      setOrderMeta: (meta) => {
        set(meta);
      },

      /** Get quantity of a specific product in cart (0 if not present). */
      getItemQty: (productId) => {
        const item = get().items.find((i) => i.productId === productId);
        return item?.quantity || 0;
      },

      /** Check if a product is in the cart. */
      isInCart: (productId) => {
        return get().items.some((i) => i.productId === productId);
      },

      /** Get computed cart totals. Pure calculation — no DB calls. */
      getCartTotals: () => {
        return computeTotals(get().items);
      },
    }),
    {
      name: 'ag-cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist items and client — not derived state
      partialize: (state) => ({
        items: state.items,
        clientId: state.clientId,
        clientName: state.clientName,
        notes: state.notes,
        deliveryDate: state.deliveryDate,
      }),
    }
  )
);
