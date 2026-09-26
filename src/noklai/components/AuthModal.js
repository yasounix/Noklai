import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../modules/supabaseClient';
import { AuthService } from '../../services/AuthService';
import { noklaiTheme } from '../theme/noklaiTheme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

// ==============================================================================
// TODO (PRODUCTION LAUNCH READINESS):
// Confirm email is currently OFF in development to prevent Supabase's built-in 
// rate-limit blocks (2-3 emails/hr on shared SMTP) and streamline initial onboarding 
// for elderly/non-technical caregivers in North East India.
// Before production launch, we need to revisit this:
// 1. Re-enable email confirmation paired with a dedicated custom SMTP provider (e.g. Resend, SendGrid)
//    with a smooth in-app polling/deep-link verification flow.
// 2. OR implement phone-based verification (SMS OTP or WhatsApp OTP) as a lighter alternative.
// ==============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthModal({ visible, onClose, onSuccess, initialRole = 'caregiver' }) {
  const { isDarkMode } = useTheme();
  const { currentLanguage } = useLanguage();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(initialRole);
  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [errorType, setErrorType] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const [fieldErrors, setFieldErrors] = useState({
    fullName: '',
    email: '',
    password: '',
  });
  const [touched, setTouched] = useState({
    fullName: false,
    email: false,
    password: false,
  });

  useEffect(() => {
    let timer;
    if (cooldownSeconds > 0) {
      timer = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const validateField = (field, value) => {
    let err = '';
    if (field === 'fullName' && isSignUp) {
      if (!value.trim()) {
        err = 'Full name is required';
      }
    } else if (field === 'email') {
      if (!value.trim()) {
        err = 'Email address is required';
      } else if (!EMAIL_REGEX.test(value.trim())) {
        err = 'Please enter a valid email (e.g. name@gmail.com)';
      }
    } else if (field === 'password') {
      if (!value) {
        err = 'Password is required';
      } else if (value.length < 6) {
        err = 'Password must be at least 6 characters';
      }
    }
    setFieldErrors((prev) => ({ ...prev, [field]: err }));
    return err;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const val = field === 'fullName' ? fullName : field === 'email' ? email : password;
    validateField(field, val);
  };

  const isFormValid = isSignUp
    ? Boolean(
        fullName.trim() &&
        email.trim() &&
        EMAIL_REGEX.test(email.trim()) &&
        password.length >= 6 &&
        !fieldErrors.fullName &&
        !fieldErrors.email &&
        !fieldErrors.password
      )
    : Boolean(
        email.trim() &&
        EMAIL_REGEX.test(email.trim()) &&
        password.length >= 6 &&
        !fieldErrors.email &&
        !fieldErrors.password
      );

  const handleAuth = async () => {
    const nameErr = validateField('fullName', fullName);
    const emailErr = validateField('email', email);
    const passErr = validateField('password', password);
    setTouched({ fullName: true, email: true, password: true });

    if (isSignUp && (nameErr || emailErr || passErr)) {
      setErrorMessage('Please correct the highlighted fields before submitting.');
      return;
    }
    if (!isSignUp && (emailErr || passErr)) {
      setErrorMessage('Please enter a valid email and password.');
      return;
    }

    if (cooldownSeconds > 0) {
      setErrorMessage(`Rate limit cooldown active. Please wait ${cooldownSeconds}s.`);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setErrorType(null);
    setSuccessMessage('');

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              role: role || initialRole,
              full_name: fullName.trim(),
              phone: phone.trim() || null,
              preferred_language: currentLanguage || 'en',
            },
          },
        });

        if (error) {
          if (
            error.code === 'over_email_send_rate_limit' ||
            error.status === 429 ||
            (error.message && error.message.toLowerCase().includes('rate limit'))
          ) {
            setErrorType('rate_limit');
            setCooldownSeconds(60);
            setErrorMessage('Supabase email limit reached. Please wait 60 seconds before trying again.');
          } else if (error.code === 'email_address_invalid') {
            setErrorMessage('Please use a valid email address with an existing domain (e.g. name@gmail.com).');
          } else {
            setErrorMessage(error.message || 'Registration failed. Please check your details.');
          }
          setLoading(false);
          return;
        }

        if (data?.user?.identities && data.user.identities.length === 0) {
          setErrorType('duplicate');
          setErrorMessage('An account with this email already exists. Please switch to Sign In.');
          setLoading(false);
          return;
        }

        let activeUser = data?.user;
        let activeSession = data?.session;

        if (activeUser && !activeSession) {
          const confirmRes = await AuthService.autoConfirmUser(activeUser.id);
          if (confirmRes.success) {
            const { data: signInData, error: signInErr } = await AuthService.signInWithPassword(
              email.trim(),
              password
            );
            if (!signInErr && signInData?.session) {
              activeSession = signInData.session;
              activeUser = signInData.user || activeUser;
            }
          }
        }

        if (activeUser && !activeSession) {
          setErrorType('unconfirmed');
          setErrorMessage('Account created! Please check your email inbox to confirm your account before signing in.');
          setLoading(false);
          return;
        }

        if (activeUser) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', activeUser.id)
            .maybeSingle();

          if (!existingProfile) {
            const { error: upsertErr } = await supabase.from('profiles').upsert({
              id: activeUser.id,
              role: role || initialRole,
              full_name: fullName.trim(),
              phone: phone.trim() || null,
              preferred_language: currentLanguage || 'en',
            });
            if (upsertErr) {
              setErrorMessage('Account was created, but saving profile details failed. Please retry.');
              setLoading(false);
              return;
            }
          }
        }

        setSuccessMessage('Account created successfully!');
        setTimeout(() => {
          if (onSuccess) onSuccess(activeUser);
          onClose();
        }, 500);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.code === 'invalid_credentials' || error.message.includes('Invalid login credentials')) {
            setErrorType('not_found');
            setErrorMessage('No account found with this email, or incorrect password. Please create an account.');
          } else if (error.code === 'email_not_confirmed' || error.message.includes('Email not confirmed')) {
            setErrorType('unconfirmed');
            setErrorMessage('Your email address has not been confirmed yet. Please check your inbox.');
          } else if (error.status === 429 || (error.message && error.message.toLowerCase().includes('rate limit'))) {
            setErrorType('rate_limit');
            setCooldownSeconds(60);
            setErrorMessage('Too many sign-in attempts. Please wait 60 seconds.');
          } else {
            setErrorMessage(error.message || 'Invalid email or password. Please verify your credentials.');
          }
          setLoading(false);
          return;
        }

        setSuccessMessage('Signed in successfully!');
        setTimeout(() => {
          if (onSuccess) onSuccess(data?.user);
          onClose();
        }, 500);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setErrorMessage('An unexpected network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View
          style={[
            styles.modalContent,
            { backgroundColor: isDarkMode ? noklaiTheme.colors.cardDark || '#1E232E' : '#FFFFFF' },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={20} color="#5B409E" />
              </View>
              <Text
                style={[
                  styles.title,
                  { color: isDarkMode ? noklaiTheme.colors.textDark || '#F3F4F6' : '#1A1A1A' },
                ]}
              >
                {isSignUp ? 'Create NOKLAI Account' : 'Sign In to NOKLAI'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            {isSignUp
              ? 'Set up a secure account to protect family photos and memory data.'
              : 'Sign in to access encrypted family memory photos and cognitive progress.'}
          </Text>

          {successMessage ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={16} color="#15803D" />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={[styles.errorBox, errorType === 'rate_limit' && styles.rateLimitBox]}>
              <Ionicons
                name={errorType === 'rate_limit' ? 'timer-outline' : 'alert-circle'}
                size={16}
                color={errorType === 'rate_limit' ? '#B45309' : '#DC2626'}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.errorText, errorType === 'rate_limit' && styles.rateLimitText]}>
                  {errorMessage}
                </Text>
                {cooldownSeconds > 0 && (
                  <Text style={styles.countdownBadge}>Retry available in: {cooldownSeconds}s</Text>
                )}
              </View>
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContainer}>
            {isSignUp && (
              <>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: isDarkMode ? '#FFF' : '#333',
                      borderColor: touched.fullName && fieldErrors.fullName ? '#DC2626' : (isDarkMode ? '#444' : '#DDD'),
                    },
                  ]}
                  placeholder="e.g. Priom Sarma"
                  placeholderTextColor="#999"
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    if (touched.fullName) validateField('fullName', text);
                  }}
                  onBlur={() => handleBlur('fullName')}
                />
                {touched.fullName && fieldErrors.fullName ? (
                  <Text style={styles.inlineError}>{fieldErrors.fullName}</Text>
                ) : null}

                <Text style={styles.label}>I am a *</Text>
                <View style={styles.roleRow}>
                  <TouchableOpacity
                    style={[styles.roleBtn, role === 'patient' && styles.roleBtnActive]}
                    onPress={() => setRole('patient')}
                  >
                    <Text style={styles.roleEmoji}>👴</Text>
                    <Text style={[styles.roleText, role === 'patient' && styles.roleTextActive]}>
                      Patient
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.roleBtn, role === 'caregiver' && styles.roleBtnActive]}
                    onPress={() => setRole('caregiver')}
                  >
                    <Text style={styles.roleEmoji}>👨‍⚕️</Text>
                    <Text style={[styles.roleText, role === 'caregiver' && styles.roleTextActive]}>
                      Caregiver
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Phone Number (Optional)</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: isDarkMode ? '#FFF' : '#333',
                      borderColor: isDarkMode ? '#444' : '#DDD',
                    },
                  ]}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </>
            )}

            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: isDarkMode ? '#FFF' : '#333',
                  borderColor: touched.email && fieldErrors.email ? '#DC2626' : (isDarkMode ? '#444' : '#DDD'),
                },
              ]}
              placeholder="name@example.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (touched.email) validateField('email', text);
              }}
              onBlur={() => handleBlur('email')}
            />
            {touched.email && fieldErrors.email ? (
              <Text style={styles.inlineError}>{fieldErrors.email}</Text>
            ) : null}

            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: isDarkMode ? '#FFF' : '#333',
                  borderColor: touched.password && fieldErrors.password ? '#DC2626' : (isDarkMode ? '#444' : '#DDD'),
                },
              ]}
              placeholder="At least 6 characters"
              placeholderTextColor="#999"
              secureTextEntry
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (touched.password) validateField('password', text);
              }}
              onBlur={() => handleBlur('password')}
            />
            {touched.password && fieldErrors.password ? (
              <Text style={styles.inlineError}>{fieldErrors.password}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, (!isFormValid || loading || cooldownSeconds > 0) && styles.submitBtnDisabled]}
              onPress={handleAuth}
              disabled={!isFormValid || loading || cooldownSeconds > 0}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {cooldownSeconds > 0
                    ? `Wait ${cooldownSeconds}s`
                    : isSignUp
                    ? 'Create Secure Account'
                    : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeBtn}
              onPress={() => {
                setIsSignUp(!isSignUp);
                setErrorMessage('');
                setErrorType(null);
              }}
            >
              <Text style={styles.switchModeText}>
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : "Don't have an account yet? Create Account"}
              </Text>
            </TouchableOpacity>

            <View style={styles.privacyNote}>
              <Ionicons name="shield-checkmark" size={14} color="#7A6899" />
              <Text style={styles.privacyText}>
                Photos are stored in private encrypted storage with strict link authorization.
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE7F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 16,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  successText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  rateLimitBox: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
  },
  rateLimitText: {
    color: '#92400E',
  },
  countdownBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    marginTop: 4,
  },
  formContainer: {
    paddingBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginTop: 10,
    marginBottom: 4,
  },
  inlineError: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 4,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    backgroundColor: '#FAF9F6',
  },
  roleBtnActive: {
    backgroundColor: '#EDE7F6',
    borderColor: '#5B409E',
  },
  roleEmoji: {
    fontSize: 18,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  roleTextActive: {
    color: '#5B409E',
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: '#5B409E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  switchModeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchModeText: {
    color: '#5B409E',
    fontSize: 13,
    fontWeight: '600',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  privacyText: {
    fontSize: 11,
    color: '#7A6899',
    textAlign: 'center',
  },
});
