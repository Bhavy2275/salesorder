/**
 * QuantityStepper.jsx — Add / Remove quantity control
 *
 * Used on product cards and the cart screen.
 * Renders either as a compact inline stepper (on cards)
 * or a larger variant (on detail/cart screen).
 *
 * Shows "Add" button when qty = 0, stepper when qty > 0.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

export default function QuantityStepper({
  quantity = 0,
  onAdd,
  onRemove,
  onSetQty,
  maxQty,
  disabled = false,
  size = 'sm',   // 'sm' | 'lg'
}) {
  const isLarge = size === 'lg';

  const handleAdd = () => {
    if (disabled) return;
    if (maxQty !== undefined && quantity >= maxQty) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd?.();
  };

  const handleRemove = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemove?.();
  };

  // ── "Add" button — shown when qty is 0 ────────────────────────────────────
  if (quantity === 0) {
    return (
      <Pressable
        onPress={handleAdd}
        disabled={disabled}
        style={({ pressed }) => [
          styles.addButton,
          isLarge && styles.addButtonLg,
          pressed && styles.pressed,
          disabled && styles.disabledBtn,
        ]}
      >
        <Ionicons name="add" size={isLarge ? 18 : 14} color="#fff" />
        <Text style={[styles.addText, isLarge && styles.addTextLg]}>
          {disabled ? 'Out of Stock' : 'Add'}
        </Text>
      </Pressable>
    );
  }

  // ── Stepper — shown when qty > 0 ──────────────────────────────────────────
  return (
    <View style={[styles.stepper, isLarge && styles.stepperLg]}>
      <Pressable
        onPress={handleRemove}
        style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Ionicons
          name={quantity === 1 ? 'trash-outline' : 'remove'}
          size={isLarge ? 18 : 14}
          color="#7C3AED"
        />
      </Pressable>

      <Text style={[styles.qtyText, isLarge && styles.qtyTextLg]}>
        {quantity}
      </Text>

      <Pressable
        onPress={handleAdd}
        disabled={maxQty !== undefined && quantity >= maxQty}
        style={({ pressed }) => [
          styles.stepBtn,
          pressed && styles.pressed,
          maxQty !== undefined && quantity >= maxQty && styles.disabledBtn,
        ]}
        hitSlop={8}
      >
        <Ionicons name="add" size={isLarge ? 18 : 14} color="#7C3AED" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  addButtonLg: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  addTextLg: {
    fontSize: 16,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',  // violet-100
    borderRadius: 8,
    overflow: 'hidden',
  },
  stepperLg: {
    borderRadius: 12,
    minWidth: 120,
  },
  stepBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4C1D95',  // violet-900
    minWidth: 24,
    textAlign: 'center',
  },
  qtyTextLg: {
    fontSize: 20,
    minWidth: 40,
  },
  pressed: {
    opacity: 0.7,
  },
  disabledBtn: {
    opacity: 0.4,
  },
});
