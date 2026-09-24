import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

/**
 * InlineAuthCard
 * Embedded, defensive email/password sign-in and registration card.
 * Handles client-side validation, rate-limit cooldowns, profile verification, and clear error states.
 */
export default function InlineAuthCard({
  initialRole = 'patient',
  onSuccess,
  title,
  subtitle,
}) {
  const { isDarkMode } = useTheme();
  const { currentLanguage } = useLanguage();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(initialRole);
  const [loading, setLoading] = useState(false);

  // Validation & Error states
  const [errorMessage, setErrorMessage] = useState('');
  const [errorType, setErrorType] = useState(null); // 'rate_limit' | 'not_found' | 'unconfirmed' | 'duplicate' | 'profile_missing'
  const [successMessage, setSuccessMessage] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Field-level error messages
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

  // Cooldown countdown effect
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

  // Client-side field validation
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

  const defaultTitle = isSignUp
    ? 'Create NOKLAI Account'
    : initialRole === 'caregiver'
    ? 'Sign In to Manage Memories'
    : 'Sign In to View Family Photos';

  const defaultSubtitle = isSignUp
    ? 'Create a secure account to protect family photos and memory data.'
    : 'Family memory photos are kept private and secure. Sign in to access your family album.';

  const handleAuth = async () => {
    // 1. Client-side pre-validation
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
        // --- SIGN UP FLOW ---
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
          // Check for rate limit
          if (
            error.code === 'over_email_send_rate_limit' ||
            error.status === 429 ||
            (error.message && error.message.toLowerCase().includes('rate limit'))
          ) {
            setErrorType('rate_limit');
            setCooldownSeconds(60);
            setErrorMessage(
              'Supabase email sending limit reached (shared test tier). Please wait 60 seconds before trying again.'
            );
          } else if (error.code === 'email_address_invalid') {
            setErrorMessage('The email address format or domain could not be verified. Please use a standard email (e.g. name@gmail.com).');
          } else {
            setErrorMessage(error.message || 'Account registration failed. Please check your credentials.');
          }
          setLoading(false);
          return;
        }

        // Check for duplicate/ghost user
        if (data?.user?.identities && data.user.identities.length === 0) {
          setErrorType('duplicate');
          setErrorMessage(
            'An account with this email address already exists. Please switch to Sign In or reset your password.'
          );
          setLoading(false);
          return;
        }

        // Check if email confirmation is required (session is null)
        let activeUser = data?.user;
        let activeSession = data?.session;

        if (activeUser && !activeSession) {
          // Attempt server-side auto-confirmation via Edge Function
          const confirmRes = await AuthService.autoConfirmUser(activeUser.id);
          if (confirmRes.success) {
            // Auto-confirmation succeeded! Immediately log in to establish active session
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
          setErrorMessage(
            'Account created! Please check your email inbox to confirm your account, or ask your administrator to enable immediate sign-in.'
          );
          setLoading(false);
          return;
        }

        // Check/ensure profile was created in public.profiles
        if (activeUser) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', activeUser.id)
            .maybeSingle();

          if (!existingProfile) {
            // Self-healing fallback: insert profile row if trigger didn't run
            const { error: upsertErr } = await supabase.from('profiles').upsert({
              id: activeUser.id,
              role: role || initialRole,
              full_name: fullName.trim(),
              phone: phone.trim() || null,
              preferred_language: currentLanguage || 'en',
            });

            if (upsertErr) {
              setErrorType('profile_missing');
              setErrorMessage(
                'Your account was created, but your profile details could not be saved. Please retry or contact support.'
              );
              setLoading(false);
              return;
            }
          }
        }

        // Definite success state
        setSuccessMessage('Account created successfully! Loading your album...');
        setTimeout(() => {
          if (onSuccess) onSuccess(activeUser);
        }, 600);
      } else {
        // --- SIGN IN FLOW ---
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.code === 'invalid_credentials' || error.message.includes('Invalid login credentials')) {
            setErrorType('not_found');
            setErrorMessage(
              'No account found with this email, or incorrect password. If you have not created an account yet, please create one.'
            );
          } else if (error.code === 'email_not_confirmed' || error.message.includes('Email not confirmed')) {
            setErrorType('unconfirmed');
            setErrorMessage(
              'Your email address has not been confirmed yet. Please check your inbox for the verification link, or disable "Confirm email" in the Supabase Dashboard.'
            );
          } else if (error.status === 429 || (error.message && error.message.toLowerCase().includes('rate limit'))) {
            setErrorType('rate_limit');
            setCooldownSeconds(60);
            setErrorMessage('Too many sign-in attempts. Please wait 60 seconds.');
          } else {
            setErrorMessage(error.message || 'Unable to sign in. Please verify your credentials.');
          }
          setLoading(false);
          return;
        }

        setSuccessMessage('Signed in successfully! Loading memories...');
        setTimeout(() => {
          if (onSuccess) onSuccess(data?.user);
        }, 500);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setErrorMessage('An unexpected network error occurred. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const cardBg = isDarkMode ? noklaiTheme.colors.cardDark || '#1E232E' : '#FFFFFF';
  const textColor = isDarkMode ? noklaiTheme.colors.textDark || '#F3F4F6' : '#1A1A1A';
  const subtextColor = isDarkMode ? '#9CA3AF' : '#666666';
  const inputBg = isDarkMode ? '#262D3B' : '#FAFAFA';
  const inputBorder = isDarkMode ? '#374151' : '#E0E0E0';
  const inputTextColor = isDarkMode ? '#F9FAFB' : '#111827';

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/* Icon & Title */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={28} color="#5B409E" />
        </View>
        <Text style={[styles.title, { color: textColor }]}>
          {title || defaultTitle}
        </Text>
        <Text style={[styles.subtitle, { color: subtextColor }]}>
          {subtitle || defaultSubtitle}
        </Text>
      </View>

      {/* Success Notification Banner */}
      {successMessage ? (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={18} color="#15803D" />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}

      {/* Error Message Banner */}
      {errorMessage ? (
        <View
          style={[
            styles.errorBox,
            errorType === 'rate_limit' && styles.rateLimitBox,
          ]}
        >
          <Ionicons
            name={errorType === 'rate_limit' ? 'timer-outline' : 'alert-circle'}
            size={18}
            color={errorType === 'rate_limit' ? '#B45309' : '#DC2626'}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.errorText,
                errorType === 'rate_limit' && styles.rateLimitText,
              ]}
            >
              {errorMessage}
            </Text>
            {cooldownSeconds > 0 && (
              <Text style={styles.countdownBadge}>
                Retry available in: {cooldownSeconds}s
              </Text>
            )}
            {errorType === 'not_found' && !isSignUp && (
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => {
                  setIsSignUp(true);
                  setErrorMessage('');
                  setErrorType(null);
                }}
              >
                <Text style={styles.quickActionBtnText}>
                  👉 Create Account with {email || 'this email'}
                </Text>
              </TouchableOpacity>
            )}
            {errorType === 'duplicate' && isSignUp && (
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => {
                  setIsSignUp(false);
                  setErrorMessage('');
                  setErrorType(null);
                }}
              >
                <Text style={styles.quickActionBtnText}>
                  👉 Switch to Sign In
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : null}

      {/* Form Fields */}
      <View style={styles.form}>
        {isSignUp && (
          <>
            <Text style={[styles.label, { color: textColor }]}>Full Name *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBg,
                  borderColor:
                    touched.fullName && fieldErrors.fullName
                      ? '#DC2626'
                      : inputBorder,
                  color: inputTextColor,
                },
              ]}
              placeholder="e.g. Sara Sharma"
              placeholderTextColor="#9CA3AF"
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

            <Text style={[styles.label, { color: textColor }]}>I am a *</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[
                  styles.roleBtn,
                  role === 'patient' && styles.roleBtnActive,
                  { borderColor: role === 'patient' ? '#5B409E' : inputBorder },
                ]}
                onPress={() => setRole('patient')}
                activeOpacity={0.8}
              >
                <Text style={styles.roleEmoji}>👴</Text>
                <Text
                  style={[
                    styles.roleText,
                    role === 'patient' && styles.roleTextActive,
                  ]}
                >
                  Patient
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleBtn,
                  role === 'caregiver' && styles.roleBtnActive,
                  { borderColor: role === 'caregiver' ? '#5B409E' : inputBorder },
                ]}
                onPress={() => setRole('caregiver')}
                activeOpacity={0.8}
              >
                <Text style={styles.roleEmoji}>👨‍⚕️</Text>
                <Text
                  style={[
                    styles.roleText,
                    role === 'caregiver' && styles.roleTextActive,
                  ]}
                >
                  Caregiver
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: textColor }]}>
              Phone Number (Optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBg,
                  borderColor: inputBorder,
                  color: inputTextColor,
                },
              ]}
              placeholder="10-digit mobile number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </>
        )}

        <Text style={[styles.label, { color: textColor }]}>Email Address *</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: inputBg,
              borderColor:
                touched.email && fieldErrors.email ? '#DC2626' : inputBorder,
              color: inputTextColor,
            },
          ]}
          placeholder="name@example.com"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
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

        <Text style={[styles.label, { color: textColor }]}>Password *</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: inputBg,
              borderColor:
                touched.password && fieldErrors.password
                  ? '#DC2626'
                  : inputBorder,
              color: inputTextColor,
            },
          ]}
          placeholder="At least 6 characters"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          autoCapitalize="none"
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

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!isFormValid || loading || cooldownSeconds > 0) &&
              styles.submitBtnDisabled,
          ]}
          onPress={handleAuth}
          disabled={!isFormValid || loading || cooldownSeconds > 0}
          activeOpacity={0.85}
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

        {/* Toggle Mode Button */}
        <TouchableOpacity
          style={styles.switchModeBtn}
          onPress={() => {
            setIsSignUp(!isSignUp);
            setErrorMessage('');
            setErrorType(null);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.switchModeText}>
            {isSignUp
              ? 'Already have an account? Sign In'
              : "Don't have an account yet? Create Account"}
          </Text>
        </TouchableOpacity>

        {/* Security & Privacy Badge */}
        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed" size={13} color="#7A6899" />
          <Text style={styles.privacyText}>
            Protected with Row-Level Security and private encrypted storage.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E8E4DF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0ECF9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
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
  quickActionBtn: {
    marginTop: 8,
    backgroundColor: '#FFF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B409E',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  form: {
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inlineError: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 4,
    fontWeight: '500',
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
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    backgroundColor: '#FAF9F6',
  },
  roleBtnActive: {
    backgroundColor: '#F0ECF9',
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
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#5B409E',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: '#5B409E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  switchModeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
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
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  privacyText: {
    fontSize: 11,
    color: '#7A6899',
    textAlign: 'center',
  },
});
