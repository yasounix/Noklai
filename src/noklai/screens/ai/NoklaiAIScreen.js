import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { noklaiTheme } from '../../theme/noklaiTheme';
import { useTheme } from '../../../context/ThemeContext';
import { useNoklai } from '../../context/NoklaiContext';

export default function NoklaiAIScreen({ onClose }) {
  const { isDarkMode } = useTheme();

  const {
    role,
    activePatientName,
    activePatientId,
    activePatient,
    caregiverName,
    reminders,
    computedStats,
    realGamePerformance,
    realRecentActivity,
    analyticsData,
    setAiModalVisible,
  } = useNoklai();

  const isCaregiver = role === 'caregiver';
  const pName = activePatientName || 'Patient';
  const cName = caregiverName || 'Caregiver';

  // --------------------------------------------------
  // PATIENT-SPECIFIC CHAT STORAGE
  // --------------------------------------------------

  const chatStorageKey = `@noklai_ai_chat_${activePatientId || 'P001'}`;

  const defaultGreeting = isCaregiver
    ? `Hello ${cName}! I am your Noklai Care Assistant. I can help analyze ${pName}'s cognitive performance, suggest stimulating cultural games, or generate a care summary.`
    : `Hello ${pName}! I am your friendly Noklai companion. How are you feeling today? I can help you remember your daily routine, family stories, or play a game with you!`;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --------------------------------------------------
  // LOAD PREVIOUS CHAT HISTORY
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setIsHistoryLoaded(false);

      try {
        const savedMessages = await AsyncStorage.getItem(chatStorageKey);

        if (cancelled) return;

        if (savedMessages) {
          const parsedMessages = JSON.parse(savedMessages);

          if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
            setMessages(parsedMessages);
          } else {
            setMessages([
              {
                id: 'msg-0',
                sender: 'ai',
                text: defaultGreeting,
                timestamp: 'Just now',
              },
            ]);
          }
        } else {
          setMessages([
            {
              id: 'msg-0',
              sender: 'ai',
              text: defaultGreeting,
              timestamp: 'Just now',
            },
          ]);
        }
      } catch (error) {
        console.log('Error loading AI chat history:', error);

        if (!cancelled) {
          setMessages([
            {
              id: 'msg-0',
              sender: 'ai',
              text: defaultGreeting,
              timestamp: 'Just now',
            },
          ]);
        }
      } finally {
        if (!cancelled) {
          setIsHistoryLoaded(true);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [chatStorageKey]);

  // --------------------------------------------------
  // SAVE CHAT HISTORY
  // --------------------------------------------------

  const saveHistory = async (updatedMessages) => {
    try {
      await AsyncStorage.setItem(
        chatStorageKey,
        JSON.stringify(updatedMessages)
      );
    } catch (error) {
      console.log('Error saving AI chat history:', error);
    }
  };

  // --------------------------------------------------
// CLEAR CHAT HISTORY
// --------------------------------------------------

const clearChatHistory = async () => {
  try {
    await AsyncStorage.removeItem(chatStorageKey);

    setMessages([
      {
        id: 'msg-0',
        sender: 'ai',
        text: defaultGreeting,
        timestamp: 'Just now',
      },
    ]);
  } catch (error) {
    console.log('Error clearing AI chat history:', error);
  }
};

  // --------------------------------------------------
  // QUICK QUESTIONS
  // --------------------------------------------------

  const quickChips = isCaregiver
    ? [
        `How is ${pName} doing?`,
        'Suggest next brain exercise',
        "Summarize this week's progress",
        'Explain Cognitive Vitality Index',
      ]
    : [
        'What is my schedule today?',
        'Tell me a Northeast story',
        'Remind me about my medicine',
        'Who is visiting me today?',
      ];

  // --------------------------------------------------
  // BUILD REAL NOKLAI DATA FOR AI
  // --------------------------------------------------

  const buildPatientContext = () => {
    return {
      patient: {
        id: activePatientId || null,
        name: activePatientName || null,
        age: activePatient?.age || null,
        relation: activePatient?.relation || null,
        status: activePatient?.status || null,
      },

      caregiver: {
        name: caregiverName || null,
      },

      reminders: Array.isArray(reminders)
        ? reminders.map((item) => ({
            title: item?.title || null,
            time: item?.time || null,
            done: !!item?.done,
          }))
        : [],

      cognitiveStats: computedStats
        ? {
            gamesToday: computedStats.gamesToday,
            avgAccuracy: computedStats.avgAccuracy,
            totalPlayTimeMinutes: computedStats.totalPlayTimeMinutes,
            daysActiveThisWeek: computedStats.daysActiveThisWeek,
            currentLevel: computedStats.currentLevel,
            accuracyWeeklyDelta: computedStats.accuracyWeeklyDelta,
            vitalityIndex: computedStats.vitalityIndex,
          }
        : null,

      gamePerformance: Array.isArray(realGamePerformance)
        ? realGamePerformance
        : [],

      recentActivity: Array.isArray(realRecentActivity)
        ? realRecentActivity
        : [],

      analytics: analyticsData || null,
    };
  };

  // --------------------------------------------------
  // GEMINI AI
  // --------------------------------------------------

  const askGemini = async (question, previousMessages) => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Gemini API key is missing.');
    }

    const noklaiData = buildPatientContext();

    const systemInstruction = `
You are Noklai AI Assistant, an AI companion inside the Noklai application.

Your job is to answer the user's questions using the conversation history and the REAL Noklai data provided below.

IMPORTANT RULES:

1. NEVER invent patient information.
2. NEVER invent family members, visitors, medicines, appointments, memories, scores, schedules, diagnoses, or activities.
3. If information is not present in the provided Noklai data, clearly say that the information is not available.
4. Do not pretend that a medicine, visitor, family member, event, or memory exists when it is not in the data.
5. Use previous conversation messages when they are relevant.
6. Do not always give the same fixed response. Answer the actual question.
7. Keep answers simple and friendly for patients.
8. For caregivers, you can provide more detailed explanations based only on available data.
9. If the user asks about cognitive performance, explain the available recorded data without diagnosing a medical condition.
10. If the user asks to play a game, respond conversationally and suggest an appropriate available game or activity.
11. If the user asks something unrelated to Noklai, you may answer normally when appropriate.
12. Reply in the same language as the user whenever possible.

CURRENT NOKLAI DATA:
${JSON.stringify(noklaiData, null, 2)}
`;

    // Keep recent conversation context
    const recentConversation = previousMessages
      .slice(-10)
      .filter((message) => message?.text)
      .map((message) => ({
        role: message.sender === 'user' ? 'user' : 'model',
        parts: [
          {
            text: String(message.text),
          },
        ],
      }));

      let response;
      let data;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        response = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [
                  {
                    text: systemInstruction,
                  },
                ],
              },
      
              contents: [
                ...recentConversation,
                {
                  role: 'user',
                  parts: [
                    {
                      text: question,
                    },
                  ],
                },
              ],
      
              generationConfig: {
                maxOutputTokens: 500,
              },
            }),
          }
        );
      
        data = await response.json();
      
        // Retry only for temporary 503 errors.
// Do NOT retry 429 quota errors.
if (response.status === 503 && attempt < 3) {
  console.log(
    `Gemini busy. Retrying... attempt ${attempt + 1}`
  );

  await new Promise(resolve =>
    setTimeout(resolve, attempt * 2000)
  );

  continue;
}

if (response.status === 429) {
  console.log('Gemini quota exceeded. No retry.');
  break;
}
      
        break;
      }
      
      if (!response.ok) {
        console.log('Gemini API error:', data);
        throw new Error(
          data?.error?.message || 'Gemini request failed.'
        );
      }
    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .filter(Boolean)
        .join('\n')
        .trim();

    if (!reply) {
      throw new Error('Gemini returned an empty response.');
    }

    return reply;
  };

  // --------------------------------------------------
  // SEND MESSAGE
  // --------------------------------------------------

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();

    if (!query || isLoading || !isHistoryLoaded) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: 'Just now',
    };

    const messagesAfterUser = [...messages, userMessage];

    setMessages(messagesAfterUser);
    setInput('');
    setIsLoading(true);

    // Save user's message immediately
    await saveHistory(messagesAfterUser);

    try {
      const reply = await askGemini(query, messages);

      const aiMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: reply,
        timestamp: 'Just now',
      };

      const finalMessages = [...messagesAfterUser, aiMessage];

      setMessages(finalMessages);

      // Save user + AI message together
      await saveHistory(finalMessages);
    } catch (error) {
      console.log('AI error:', error);

      const errorMessage = {
        id: `ai-error-${Date.now()}`,
        sender: 'ai',
        text:
          "I'm having trouble connecting to my AI service right now. Please try again in a moment.",
        timestamp: 'Just now',
      };

      const finalMessages = [...messagesAfterUser, errorMessage];

      setMessages(finalMessages);
      await saveHistory(finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------
  // CLOSE
  // --------------------------------------------------

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setAiModalVisible(false);
    }
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: isDarkMode
            ? noklaiTheme.colors.backgroundDark
            : noklaiTheme.colors.background,
        },
      ]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* HEADER */}

        <View
          style={[
            styles.headerBar,
            {
              backgroundColor: isDarkMode
                ? noklaiTheme.colors.cardBackgroundDark
                : noklaiTheme.colors.cardBackground,

              borderBottomColor: isDarkMode
                ? noklaiTheme.colors.borderDark
                : noklaiTheme.colors.border,
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <View style={styles.sparkleCircle}>
              <Ionicons
                name="sparkles"
                size={20}
                color="#FFFFFF"
              />
            </View>

            <View>
              <Text
                style={[
                  styles.headerTitle,
                  {
                    color: isDarkMode
                      ? noklaiTheme.colors.textPrimaryDark
                      : noklaiTheme.colors.textPrimary,
                  },
                ]}
              >
                Noklai AI Assistant
              </Text>

              <Text style={styles.headerSub}>
                {isCaregiver
                  ? 'Caregiver Companion & Analytics'
                  : 'Friendly Memory Companion'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
  onPress={clearChatHistory}
  style={styles.closeButton}
  accessibilityLabel="Clear Chat History"
>
  <Ionicons
    name="trash-outline"
    size={24}
    color={isDarkMode ? '#9CA3AF' : '#656F7D'}
  />
</TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityLabel="Close AI Assistant"
          >
            <Ionicons
              name="close-circle"
              size={28}
              color={isDarkMode ? '#9CA3AF' : '#656F7D'}
            />
          </TouchableOpacity>
        </View>

        {/* QUICK CHIPS */}

        <View style={styles.chipsContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={quickChips}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSend(item)}
                disabled={isLoading || !isHistoryLoaded}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isDarkMode
                      ? '#28243D'
                      : '#F3E8FF',

                    borderColor: isDarkMode
                      ? '#47396B'
                      : '#E9D5FF',

                    opacity:
                      isLoading || !isHistoryLoaded ? 0.5 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={13}
                  color="#7E22CE"
                  style={{ marginRight: 6 }}
                />

                <Text style={styles.chipText}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{
              paddingHorizontal: 16,
            }}
          />
        </View>

        {/* CHAT */}

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => {
            const isAi = item.sender === 'ai';

            return (
              <View
                style={[
                  styles.messageRow,
                  isAi
                    ? styles.aiMessageRow
                    : styles.userMessageRow,
                ]}
              >
                {isAi && (
                  <View style={styles.aiAvatar}>
                    <Ionicons
                      name="sparkles"
                      size={16}
                      color="#FFFFFF"
                    />
                  </View>
                )}

                <View
                  style={[
                    styles.bubble,

                    isAi
                      ? [
                          styles.aiBubble,
                          {
                            backgroundColor: isDarkMode
                              ? '#1E2430'
                              : '#FFFFFF',

                            borderColor: isDarkMode
                              ? '#2B3545'
                              : '#E5E7EB',
                          },
                        ]
                      : [
                          styles.userBubble,
                          {
                            backgroundColor: isCaregiver
                              ? noklaiTheme.colors.primary
                              : noklaiTheme.colors.patientGreen,
                          },
                        ],
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      {
                        color: isAi
                          ? isDarkMode
                            ? noklaiTheme.colors.textPrimaryDark
                            : noklaiTheme.colors.textPrimary
                          : '#FFFFFF',
                      },
                    ]}
                  >
                    {item.text}
                  </Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.loadingRow}>
                <View style={styles.aiAvatar}>
                  <Ionicons
                    name="sparkles"
                    size={16}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={[
                    styles.loadingBubble,
                    {
                      backgroundColor: isDarkMode
                        ? '#1E2430'
                        : '#FFFFFF',
                    },
                  ]}
                >
                  <ActivityIndicator size="small" />

                  <Text
                    style={[
                      styles.loadingText,
                      {
                        color: isDarkMode
                          ? noklaiTheme.colors.textPrimaryDark
                          : noklaiTheme.colors.textPrimary,
                      },
                    ]}
                  >
                    Noklai AI is thinking...
                  </Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* INPUT */}

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: isDarkMode
                ? noklaiTheme.colors.cardBackgroundDark
                : noklaiTheme.colors.cardBackground,

              borderColor: isDarkMode
                ? noklaiTheme.colors.borderDark
                : noklaiTheme.colors.border,
            },
          ]}
        >
          <TextInput
            placeholder={
              isCaregiver
                ? 'Ask about Aaji or request suggestions...'
                : 'Talk with your memory helper...'
            }
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
            style={[
              styles.input,
              {
                color: isDarkMode
                  ? noklaiTheme.colors.textPrimaryDark
                  : noklaiTheme.colors.textPrimary,
              },
            ]}
            onSubmitEditing={() => handleSend(input)}
            editable={!isLoading && isHistoryLoaded}
          />

          <TouchableOpacity
            onPress={() => handleSend(input)}
            disabled={
              !input.trim() ||
              isLoading ||
              !isHistoryLoaded
            }
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  input.trim() &&
                  !isLoading &&
                  isHistoryLoaded
                    ? isCaregiver
                      ? noklaiTheme.colors.primary
                      : noklaiTheme.colors.patientGreen
                    : '#CBD5E1',
              },
            ]}
          >
            <Ionicons
              name="send"
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sparkleCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: noklaiTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  headerSub: {
    fontSize: 12,
    color: '#656F7D',
    marginTop: 1,
  },

  closeButton: {
    padding: 4,
  },

  chipsContainer: {
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: noklaiTheme.radii.full,
    borderWidth: 1,
    marginRight: 8,
  },

  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7E22CE',
  },

  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  aiMessageRow: {
    justifyContent: 'flex-start',
  },

  userMessageRow: {
    justifyContent: 'flex-end',
  },

  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: noklaiTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  bubble: {
    maxWidth: '80%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: noklaiTheme.radii.xl,
  },

  aiBubble: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },

  userBubble: {
    borderBottomRightRadius: 4,
  },

  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 10,
  },

  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: noklaiTheme.radii.xl,
    borderBottomLeftRadius: 4,
    gap: 8,
  },

  loadingText: {
    fontSize: 14,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 12,
    borderRadius: noklaiTheme.radii.full,
    borderWidth: 1.5,
  },

  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },

  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});