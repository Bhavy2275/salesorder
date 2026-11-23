import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 to reach the host machine. For a physical
// phone, set EXPO_PUBLIC_API_URL to the development computer's LAN address.
export const API_BASE = process.env.EXPO_PUBLIC_API_URL
  || (Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000');
