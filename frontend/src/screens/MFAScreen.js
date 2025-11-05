import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TokenRefreshService from "../services/TokenRefreshService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

const MFAScreen = ({ route, navigation }) => {
  const { user, tempToken, login } = route.params || {};

  const { username, email, password } = user || {};

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Refs for input fields
  const inputRefs = useRef([]);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleGoBack();
        return true;
      }
    );

    return () => backHandler.remove();
  }, [login]);

  /**
   * Handle code input
   */
  const handleCodeChange = (text, index) => {
    // Only allow numbers
    if (text && !/^\d+$/.test(text)) return;

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (index === 5 && text) {
      const fullCode = newCode.join("");
      if (fullCode.length === 6) {
        handleVerifyCode(fullCode);
      }
    }
  };

  /**
   * Handle backspace
   */
  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Verify MFA code
   */
  const handleVerifyCode = async (fullCode = null) => {
    const verificationCode = fullCode || code.join("");

    if (verificationCode.length !== 6) {
      Alert.alert("Error", "Please enter all 6 digits");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/auth/verify-mfa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tempToken,
          code: verificationCode,
          login,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (login) {
          const accessToken = data?.accessToken;
          const refreshToken = data?.refreshToken;

          await AsyncStorage.setItem("authToken", accessToken);
          await AsyncStorage.setItem("refreshToken", refreshToken);

          TokenRefreshService.startAutoRefresh();

          // Automatically navigate to the main app after successful login
          navigation.reset({
            index: 0,
            routes: [{ name: "MainApp" }],
          });
        } else {
          Alert.alert("Success", "Account verified! You can now log in.", [
            {
              text: "OK",
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Login" }],
                });
              },
            },
          ]);
        }
      } else {
        Alert.alert("Error", data.error || "Invalid verification code");
        // Clear code inputs
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error("MFA verification error:", error);
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resend verification code
   */
  const handleResendCode = async () => {
    if (countdown > 0) return;

    try {
      setResending(true);

      const response = await fetch(`${API_BASE}/auth/resend-mfa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tempToken }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert("Success", "Verification code sent to your email");
        setCountdown(60); // 60 seconds cooldown
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        Alert.alert("Error", data.error || "Failed to resend code");
      }
    } catch (error) {
      console.error("Resend code error:", error);
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setResending(false);
    }
  };

  /**
   * Go back to login
   */
  const handleGoBack = () => {
    Alert.alert(
      "Cancel Verification",
      "Are you sure you want to go back? You will need to log in again.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Go Back",
          style: "destructive",
          onPress: () => {
            if (!login) {
              const cleanupRegistration = async () => {
                try {
                  await fetch(`${API_BASE}/auth/cleanup`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${tempToken}`,
                    },
                  });
                } catch (error) {
                  console.error("Cleanup registration error:", error);
                }
              };

              cleanupRegistration().finally(() => {
                navigation.goBack();
              });
            }

            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={24} color="#2e7d32" />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed" size={48} color="#2e7d32" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Two-Factor Authentication</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{"\n"}
            <Text style={styles.email}>{email}</Text>
          </Text>

          {/* Code Input */}
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[styles.codeInput, digit && styles.codeInputFilled]}
                value={digit}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={index === 0}
                editable={!loading}
              />
            ))}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (loading || code.join("").length !== 6) &&
                styles.verifyButtonDisabled,
            ]}
            onPress={() => handleVerifyCode()}
            disabled={loading || code.join("").length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify Code</Text>
            )}
          </TouchableOpacity>

          {/* Resend Code */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            {countdown > 0 ? (
              <Text style={styles.resendCountdown}>Resend in {countdown}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResendCode} disabled={resending}>
                {resending ? (
                  <ActivityIndicator size="small" color="#2e7d32" />
                ) : (
                  <Text style={styles.resendLink}>Resend Code</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Help Text */}
          <View style={styles.helpContainer}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#666"
            />
            <Text style={styles.helpText}>
              The code will expire in 10 minutes
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  iconContainer: {
    alignItems: "center",
    marginVertical: 30,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#e8f5e9",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2e7d32",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
  },
  email: {
    fontWeight: "600",
    color: "#2e7d32",
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
    backgroundColor: "#f8f9fa",
  },
  codeInputFilled: {
    borderColor: "#2e7d32",
    backgroundColor: "#e8f5e9",
  },
  verifyButton: {
    backgroundColor: "#2e7d32",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#2e7d32",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyButtonDisabled: {
    backgroundColor: "#b0b0b0",
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: "#666",
  },
  resendLink: {
    fontSize: 14,
    color: "#2e7d32",
    fontWeight: "600",
  },
  resendCountdown: {
    fontSize: 14,
    color: "#999",
  },
  helpContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
  },
  helpText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 8,
  },
});

export default MFAScreen;
