# Sales Order Mobile

## Development setup

1. Install Node.js 22.13+ and Android Studio (Android SDK 36) for Android builds. iOS builds require macOS and Xcode 26.4+.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`. Use `http://10.0.2.2:5000` for the Android emulator, `http://localhost:5000` for the iOS simulator, or the development computer's LAN IP for a physical phone.
3. From this directory run `npm install`, then `npm run android` (or `npm run ios`). The first native build takes longer; later starts use the installed development build.
4. Start the API from `../server` after configuring `server/.env` and applying the Supabase migrations. A real user and client assigned to that salesperson are needed for checkout.

The receipt printer uses native Bluetooth code. Expo Go is not supported. Pair the SRS588 in Android Bluetooth settings; on iOS the printer must expose BLE. After the first successful order, choose the printer on the success screen; subsequent confirmations print automatically. If printing fails, the confirmed order remains saved and can be printed again from that screen.

## Order flow

Sign in → Catalogue → Cart → Checkout → client and delivery details → client OTP → printed 58 mm receipt.

Warehouse routes are available at `/warehouse` and `/warehouse/[id]` for warehouse and admin accounts.
