/**
 * Step2_ClientDetails.jsx — Checkout Step 2: Client & Delivery Details
 *
 * Fields:
 * - Client search/select (SearchableDropdown from Supabase)
 * - Delivery address (pre-filled from client, editable)
 * - Expected delivery date (date picker)
 * - Payment terms (dropdown — pre-filled from client defaults)
 * - Order notes
 *
 * On submit → calls useCheckout.submitOrder() which creates the draft + reserves stock
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable,
  StyleSheet, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

const PAYMENT_TERMS = [
  { value: 'cash', label: 'Cash on Delivery' },
  { value: 'net_7', label: 'Net 7 Days' },
  { value: 'net_15', label: 'Net 15 Days' },
  { value: 'net_30', label: 'Net 30 Days' },
  { value: 'net_45', label: 'Net 45 Days' },
  { value: 'net_60', label: 'Net 60 Days' },
  { value: 'credit', label: 'Open Credit' },
];

export default function Step2_ClientDetails({ isLoading, error, onSubmit }) {
  // Client selection
  const [clientQuery, setClientQuery] = useState('');
  const [clients, setClients] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Delivery details
  const [deliveryLine1, setDeliveryLine1] = useState('');
  const [deliveryLine2, setDeliveryLine2] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryPincode, setDeliveryPincode] = useState('');
  const [deliveryLandmark, setDeliveryLandmark] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('cash');
  const [notes, setNotes] = useState('');
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);

  // Validation errors
  const [formErrors, setFormErrors] = useState({});

  // ── Search clients from API ─────────────────────────────────────────────
  const searchClients = useCallback(async (q) => {
    if (q.length < 2) { setClients([]); return; }
    setSearchLoading(true);
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      const { data } = await axios.get(`${API_BASE}/api/clients`, {
        params: { q, limit: 10 },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      });
      setClients(data.data || []);
      setShowDropdown(true);
    } catch {
      setClients([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchClients(clientQuery), 300);
    return () => clearTimeout(timer);
  }, [clientQuery, searchClients]);

  // ── Pre-fill delivery from client ───────────────────────────────────────
  const handleSelectClient = useCallback((client) => {
    setSelectedClient(client);
    setShowDropdown(false);
    setClientQuery(client.business_name);

    // Pre-fill delivery address from client record
    const addr = client.delivery_address;
    if (addr) {
      setDeliveryLine1(addr.line1 || '');
      setDeliveryLine2(addr.line2 || '');
      setDeliveryCity(addr.city || '');
      setDeliveryState(addr.state || '');
      setDeliveryPincode(addr.pincode || '');
      setDeliveryLandmark(addr.landmark || '');
    }

    // Pre-fill payment terms from client
    if (client.payment_terms) {
      setPaymentTerms(client.payment_terms);
    }
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const errs = {};
    if (!selectedClient) errs.client = 'Please select a client';
    if (!deliveryLine1.trim()) errs.deliveryLine1 = 'Street address is required';
    if (!deliveryCity.trim()) errs.deliveryCity = 'City is required';
    if (!deliveryState.trim()) errs.deliveryState = 'State is required';
    if (!deliveryPincode.trim() || !/^\d{4,10}$/.test(deliveryPincode.trim())) {
      errs.deliveryPincode = 'Valid pincode required';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }, [selectedClient, deliveryLine1, deliveryCity, deliveryState, deliveryPincode]);

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!validate()) return;

    const payload = {
      clientId: selectedClient.id,
      deliveryAddress: {
        line1: deliveryLine1.trim(),
        line2: deliveryLine2.trim() || undefined,
        city: deliveryCity.trim(),
        state: deliveryState.trim(),
        pincode: deliveryPincode.trim(),
        landmark: deliveryLandmark.trim() || undefined,
      },
      deliveryDate: deliveryDate || undefined,
      paymentTerms,
      notes: notes.trim() || undefined,
    };

    onSubmit(payload);
  }, [
    validate, selectedClient, deliveryLine1, deliveryLine2,
    deliveryCity, deliveryState, deliveryPincode, deliveryLandmark,
    deliveryDate, paymentTerms, notes, onSubmit,
  ]);

  const selectedPaymentLabel = PAYMENT_TERMS.find((t) => t.value === paymentTerms)?.label;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Global Error ──────────────────────────────────────────────────── */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* ── Section: Client ───────────────────────────────────────────────── */}
      <SectionHeader title="Client" icon="business-outline" />

      <View style={styles.fieldGroup}>
        <FieldLabel label="Search Client *" error={formErrors.client} />
        <View>
          <View style={[styles.inputRow, formErrors.client && styles.inputError]}>
            <Ionicons name="search-outline" size={16} color="#9CA3AF" />
            <TextInput
              style={styles.input}
              placeholder="Type business name or mobile..."
              placeholderTextColor="#9CA3AF"
              value={clientQuery}
              onChangeText={(t) => { setClientQuery(t); setSelectedClient(null); }}
              autoCorrect={false}
            />
            {searchLoading && <ActivityIndicator size="small" color="#7C3AED" />}
            {selectedClient && (
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            )}
          </View>

          {/* Dropdown results */}
          {showDropdown && clients.length > 0 && (
            <View style={styles.dropdown}>
              {clients.map((client) => (
                <Pressable
                  key={client.id}
                  onPress={() => handleSelectClient(client)}
                  style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
                >
                  <Text style={styles.dropdownName}>{client.business_name}</Text>
                  <Text style={styles.dropdownMeta}>
                    {client.mobile_primary} • {client.city}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Selected client info card */}
        {selectedClient && (
          <View style={styles.clientCard}>
            <View style={styles.clientCardHeader}>
              <View style={styles.clientAvatar}>
                <Text style={styles.clientAvatarText}>
                  {selectedClient.business_name[0]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientCardName}>{selectedClient.business_name}</Text>
                <Text style={styles.clientCardMeta}>
                  {selectedClient.contact_person} • {selectedClient.mobile_primary}
                </Text>
              </View>
              <Pressable onPress={() => { setSelectedClient(null); setClientQuery(''); }}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </Pressable>
            </View>
            {selectedClient.outstanding_balance > 0 && (
              <View style={styles.outstandingBanner}>
                <Ionicons name="warning-outline" size={14} color="#92400E" />
                <Text style={styles.outstandingText}>
                  Outstanding balance: ₹{selectedClient.outstanding_balance?.toLocaleString('en-IN')}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Section: Delivery Address ─────────────────────────────────────── */}
      <SectionHeader title="Delivery Address" icon="location-outline" />

      <View style={styles.fieldGroup}>
        <FormInput
          label="Street Address *"
          value={deliveryLine1}
          onChangeText={setDeliveryLine1}
          placeholder="House/Shop no., Street"
          error={formErrors.deliveryLine1}
        />
        <FormInput
          label="Line 2 (Optional)"
          value={deliveryLine2}
          onChangeText={setDeliveryLine2}
          placeholder="Area, Colony, Sector"
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <FormInput
              label="City *"
              value={deliveryCity}
              onChangeText={setDeliveryCity}
              placeholder="City"
              error={formErrors.deliveryCity}
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <FormInput
              label="Pincode *"
              value={deliveryPincode}
              onChangeText={setDeliveryPincode}
              placeholder="400001"
              keyboardType="numeric"
              maxLength={10}
              error={formErrors.deliveryPincode}
            />
          </View>
        </View>

        <FormInput
          label="State *"
          value={deliveryState}
          onChangeText={setDeliveryState}
          placeholder="State"
          error={formErrors.deliveryState}
        />

        <FormInput
          label="Landmark (Optional)"
          value={deliveryLandmark}
          onChangeText={setDeliveryLandmark}
          placeholder="Near landmark..."
        />
      </View>

      {/* ── Section: Order Details ────────────────────────────────────────── */}
      <SectionHeader title="Order Details" icon="document-text-outline" />

      <View style={styles.fieldGroup}>
        {/* Delivery date */}
        <View>
          <FieldLabel label="Expected Delivery Date" />
          <TextInput
            style={styles.inputBox}
            placeholder="YYYY-MM-DD (optional)"
            placeholderTextColor="#9CA3AF"
            value={deliveryDate}
            onChangeText={setDeliveryDate}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        {/* Payment terms */}
        <View>
          <FieldLabel label="Payment Terms" />
          <Pressable
            style={styles.inputBox}
            onPress={() => setShowPaymentDropdown((v) => !v)}
          >
            <View style={styles.inputRow}>
              <Text style={styles.inputText}>{selectedPaymentLabel}</Text>
              <Ionicons
                name={showPaymentDropdown ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#6B7280"
              />
            </View>
          </Pressable>

          {showPaymentDropdown && (
            <View style={styles.dropdown}>
              {PAYMENT_TERMS.map((term) => (
                <Pressable
                  key={term.value}
                  onPress={() => { setPaymentTerms(term.value); setShowPaymentDropdown(false); }}
                  style={({ pressed }) => [
                    styles.dropdownItem,
                    pressed && styles.dropdownItemPressed,
                    paymentTerms === term.value && styles.dropdownItemSelected,
                  ]}
                >
                  <Text style={[
                    styles.dropdownName,
                    paymentTerms === term.value && { color: '#7C3AED', fontWeight: '700' },
                  ]}>
                    {term.label}
                  </Text>
                  {paymentTerms === term.value && (
                    <Ionicons name="checkmark" size={16} color="#7C3AED" />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Notes */}
        <View>
          <FieldLabel label="Order Notes (Optional)" />
          <TextInput
            style={[styles.inputBox, styles.notesInput]}
            placeholder="Special instructions, delivery notes..."
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
          <Text style={styles.charCount}>{notes.length}/500</Text>
        </View>
      </View>

      {/* ── Submit Button ─────────────────────────────────────────────────── */}
      <Pressable
        onPress={handleSubmit}
        disabled={isLoading}
        style={({ pressed }) => [
          styles.submitBtn,
          pressed && styles.submitBtnPressed,
          isLoading && styles.submitBtnDisabled,
        ]}
      >
        {isLoading ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.submitBtnText}>Creating Order...</Text>
          </>
        ) : (
          <>
            <Text style={styles.submitBtnText}>Send OTP to Client</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </>
        )}
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionHeader({ title, icon }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={16} color="#7C3AED" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function FieldLabel({ label, error }) {
  return (
    <Text style={[styles.fieldLabel, error && { color: '#DC2626' }]}>
      {label}
      {error ? ` — ${error}` : ''}
    </Text>
  );
}

function FormInput({ label, error, style, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <FieldLabel label={label} error={error} />
      <TextInput
        style={[styles.inputBox, error && styles.inputError, style]}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: { flex: 1, fontSize: 13, color: '#DC2626', fontWeight: '500' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.5 },

  fieldGroup: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 4,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },

  inputBox: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  inputError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, fontSize: 14, color: '#111827' },
  inputText: { flex: 1, fontSize: 14, color: '#111827' },
  notesInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },
  charCount: { fontSize: 10, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },

  row: { flexDirection: 'row' },

  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 100,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  dropdownItemPressed: { backgroundColor: '#F5F3FF' },
  dropdownItemSelected: { backgroundColor: '#F5F3FF' },
  dropdownName: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  dropdownMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  clientCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  clientCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  clientCardName: { fontSize: 14, fontWeight: '700', color: '#4C1D95' },
  clientCardMeta: { fontSize: 11, color: '#7C3AED', marginTop: 2 },
  outstandingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  outstandingText: { fontSize: 12, color: '#92400E', fontWeight: '500' },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    padding: 18,
    marginTop: 8,
  },
  submitBtnPressed: { opacity: 0.85 },
  submitBtnDisabled: { backgroundColor: '#A78BFA' },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
