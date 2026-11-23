import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE } from '../src/api/apiConfig';

export default function LoginRoute() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signIn = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await axios.post(`${API_BASE}/api/auth/login`, { identifier: identifier.trim(), password, platform: Platform.OS });
      await SecureStore.setItemAsync('accessToken', data.data.accessToken);
      await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);
      await SecureStore.setItemAsync('currentUser', JSON.stringify(data.data.user));
      router.replace('/catalogue');
    } catch (err) {
      const apiError = err.response?.data?.error ?? err.response?.data?.message;
      const message = typeof apiError === 'string'
        ? apiError
        : apiError
          ? JSON.stringify(apiError)
          : `Could not reach the API at ${API_BASE}. Check the API URL and server.`;
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.logo}>AG</Text>
        <Text style={styles.title}>Sales Order</Text>
        <Text style={styles.subtitle}>Sign in to your field sales account</Text>
        <TextInput value={identifier} onChangeText={setIdentifier} autoCapitalize="none" placeholder="Mobile number or email" style={styles.input} />
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" style={styles.input} onSubmitEditing={signIn} />
        {Boolean(error) && <Text style={styles.error}>{error}</Text>}
        <Pressable onPress={signIn} disabled={busy || !identifier || !password} style={[styles.button, (busy || !identifier || !password) && styles.disabled]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
        <Text style={styles.footnote}>Use an account created in the Sales Order backend.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F3FF', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 20, gap: 12 },
  logo: { alignSelf: 'center', width: 54, height: 54, borderRadius: 16, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', color: '#fff', backgroundColor: '#7C3AED', fontSize: 21, fontWeight: '900' },
  title: { textAlign: 'center', color: '#111827', fontSize: 24, fontWeight: '900' },
  subtitle: { textAlign: 'center', color: '#6B7280', marginBottom: 12 },
  input: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 12, padding: 14, color: '#111827' },
  error: { color: '#B91C1C', fontSize: 13 },
  button: { backgroundColor: '#7C3AED', borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  footnote: { color: '#9CA3AF', fontSize: 11, textAlign: 'center' },
});
