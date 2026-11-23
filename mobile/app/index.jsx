import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

export default function EntryRoute() {
  useEffect(() => {
    SecureStore.getItemAsync('accessToken').then((token) => {
      router.replace(token ? '/catalogue' : '/login');
    }).catch(() => router.replace('/login'));
  }, []);

  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#7C3AED" /></View>;
}
