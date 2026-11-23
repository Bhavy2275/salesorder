/**
 * usePDF.js — Hook for downloading / sharing order PDF on mobile
 *
 * 1. Calls GET /api/orders/:id/pdf → gets signed Cloudinary URL
 * 2. Downloads the file to the device cache directory
 * 3. Opens sharing sheet (expo-sharing) or file viewer
 */
import { useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE } from '../api/apiConfig';

export function usePDF() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const downloadAndShare = async (orderId, orderNumber) => {
    setLoading(true);
    setError(null);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // 1. Get signed URL from backend
      const token = await SecureStore.getItemAsync('accessToken');
      const { data } = await axios.get(`${API_BASE}/api/orders/${orderId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const pdfUrl = data.data?.pdfUrl;
      if (!pdfUrl) throw new Error('PDF not available yet. Try again in a moment.');

      // 2. Download PDF to device cache
      const fileUri = `${FileSystem.cacheDirectory}order_${orderNumber}.pdf`;

      const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error('Download failed. Please retry.');
      }

      // 3. Open sharing sheet
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) throw new Error('Sharing is not available on this device.');

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Order #${orderNumber} — Sales Order`,
        UTI: 'com.adobe.pdf',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to download PDF.';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return { downloadAndShare, loading, error };
}
