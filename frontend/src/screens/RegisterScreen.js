import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const RegisterScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // In production, prefer an https URL and load from config/env
  const API_BASE = 'http://10.0.2.2:5000';

  const validateEmail = (value) => /\S+@\S+\.\S+/.test(value || '');
  const validatePassword = (value) => {
    if (typeof value !== 'string') return false;
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSymbol = /[^A-Za-z0-9]/.test(value);
    const hasMinLen = value.length >= 8;
    return hasUpper && hasLower && hasNumber && hasSymbol && hasMinLen;
  };
  const validateName = (value) => (value || '').trim().length >= 2;

  const isUsernameTaken = async (username) => {
    try {
      const url = `${API_BASE}/auth/check-username?username=${encodeURIComponent(username)}`;
      const res = await fetch(url, { method: 'GET' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // If the check endpoint fails, fail open to avoid blocking registration unnecessarily
        return false;
      }
      return !!data?.exists;
    } catch (e) {
      // Network issues: don't block the user, just skip availability check
      return false;
    }
  };

  const handleRegister = async () => {
    try {
      if (submitting) return;
      const username = (fullName || '').trim();
      const emailTrimmed = (email || '').trim().toLowerCase();

      // Client-side validation (keeps UI intact; alerts for feedback)
      if (!validateName(username)) {
        Alert.alert('Invalid name', 'Please enter your full name.');
        return;
      }
      if (!validateEmail(emailTrimmed)) {
        Alert.alert('Invalid email', 'Please enter a valid email address.');
        return;
      }
      if (!validatePassword(password)) {
        Alert.alert(
          'Weak password',
          'Password must include uppercase, lowercase, number, and symbol (min 8 characters).'
        );
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Mismatch', 'Passwords do not match.');
        return;
      }

      // Check username availability before proceeding
      
      const taken = await isUsernameTaken(username);
      if (taken) {
        Alert.alert('Username taken', 'That username is already in use. Please choose another.');
        return;
      }

      setSubmitting(true);

      
      

      // Secure API request (JSON, POST). Backend hashes and stores securely.
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email: emailTrimmed, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error || `Registration failed (HTTP ${res.status})`;
        Alert.alert('Error', msg);
        return;
      }

      // Success: backend persists user; prompt login for MFA flow
      Alert.alert('Success', 'Account created. Please sign in.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (e) {
      console.log(e);
      Alert.alert('Network error', 'Unable to register. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const goToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to get started</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
              <TextInput
                style={styles.input}
                placeholder="Create a password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword(prev => !prev)} // Toggle function
              >
                <Ionicons
                  name={showPassword ? 'eye' : 'eye-off'} // Change icon based on state
                  size={24}
                  color="#6c757d"
                />
              </TouchableOpacity>
              </View>  
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
              <Text style={styles.registerButtonText}>Create Account</Text>
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={goToLogin}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },

  passwordToggle: {
    flex: 1, // Allows TextInput to take up most of the space
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: 'transparent',
    position: 'absolute',
    right: 0,
  },
  registerButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: '#666',
    fontSize: 16,
  },
  loginLink: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default RegisterScreen;
