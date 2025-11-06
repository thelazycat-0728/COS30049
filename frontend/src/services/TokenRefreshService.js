import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

class TokenRefreshService {
  constructor() {
    this.refreshInterval = null;
    this.isRefreshing = false;
  }

  /**
   * ✅ Start automatic token refresh (every 15 minutes)
   */
  startAutoRefresh() {
    // Clear any existing interval
    this.stopAutoRefresh();

    console.log('Starting automatic token refresh (every 15 minutes)');

    

    // Set interval for 15 minutes (900000 ms)
    this.refreshInterval = setInterval(() => {
      this.refreshToken();
    }, 15 * 60 * 1000); // 15 minutes
  }

  /**
   * ✅ Stop automatic token refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      console.log('Stopping automatic token refresh');
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * ✅ Refresh access token
   */
  async refreshToken() {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing) {
      console.log('⏳ Token refresh already in progress, skipping...');
      return null;
    }

    try {
      this.isRefreshing = true;

      // Get refresh token from AsyncStorage
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      const accessToken = await AsyncStorage.getItem('authToken');

      if (!refreshToken) {
        console.log('⚠️ No refresh token found, skipping refresh');
        return null;
      }

      console.log('🔄 Refreshing access token...');

      // Call refresh endpoint
      const response = await fetch(`${API_BASE}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store new access token
        await AsyncStorage.setItem('authToken', data.accessToken);
        await AsyncStorage.setItem('refreshToken', data.refreshToken);
        
        console.log('✅ Access token refreshed successfully');
        
        return data.accessToken;
      } else {
        console.warn('⚠️ Token refresh failed:', data.error);

        // If refresh token is invalid/expired, clear storage
        if (response.status === 401) {
          console.log('🔒 Refresh token invalid, clearing auth data');
          await AsyncStorage.multiRemove(['authToken', 'refreshToken']);
          this.stopAutoRefresh();
        }

        return null;
      }
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return null;
    } finally {
      this.isRefreshing = false;
    }
  }

  
}

// Export singleton instance
export default new TokenRefreshService();