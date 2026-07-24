/**
 * CategoryFilterBar.jsx — Horizontal scrollable category filter chips
 *
 * Shows "All" + category chips in a horizontal scroll view.
 * Highlights the selected category.
 * Also renders a "Schemes only" toggle chip.
 */

import React from 'react';
import {
  ScrollView, Pressable, Text, View, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CategoryFilterBar({
  categories = [],
  selectedCategory,
  onSelectCategory,
  schemesOnly,
  onToggleSchemes,
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* All */}
      <FilterChip
        label="All"
        icon="apps-outline"
        isSelected={!selectedCategory}
        onPress={() => onSelectCategory(null)}
      />

      {/* Schemes toggle */}
      <FilterChip
        label="🎁 Schemes"
        isSelected={schemesOnly}
        onPress={onToggleSchemes}
        accent="#F59E0B"
      />

      {/* Categories */}
      {categories.map((cat) => (
        <FilterChip
          key={cat.id}
          label={cat.name}
          isSelected={selectedCategory === cat.id}
          onPress={() =>
            onSelectCategory(selectedCategory === cat.id ? null : cat.id)
          }
        />
      ))}
    </ScrollView>
  );
}

function FilterChip({ label, icon, isSelected, onPress, accent = '#7C3AED' }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        isSelected && { backgroundColor: accent, borderColor: accent },
        pressed && styles.chipPressed,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={13}
          color={isSelected ? '#fff' : '#6B7280'}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        style={[
          styles.chipText,
          isSelected && styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  chipTextSelected: {
    color: '#fff',
  },
});
