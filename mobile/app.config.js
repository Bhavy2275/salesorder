/** Expo native Bluetooth permissions for the receipt printer module. */
export default {
  expo: {
    name: 'Sales Order',
    slug: 'salesorder-mobile',
    scheme: 'salesorder',
    platforms: ['android', 'ios'],
    plugins: [
      'expo-router',
      [
        '@ricka7x/expo-thermal-printer',
        { bluetoothPermission: 'Allow Sales Order to connect to the receipt printer.' },
      ],
    ],
    ios: {
      bundleIdentifier: 'com.salesorder.salesorder',
      supportsTablet: true,
    },
    android: {
      package: 'com.salesorder.salesorder',
      permissions: ['BLUETOOTH', 'BLUETOOTH_ADMIN', 'BLUETOOTH_CONNECT', 'BLUETOOTH_SCAN'],
    },
  },
};
