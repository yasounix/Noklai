import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getResolvedTTSLanguage,
  formatSpokenMemoryText,
  RELATION_LABELS_BY_LANG
} from '../src/utils/speechHelper.js';

test('TTS Voice Fallback - Preferred language available', () => {
  const voices = [
    { language: 'en-US', identifier: 'com.apple.voice.compact.en-US.Samantha' },
    { language: 'hi-IN', identifier: 'hi-in-x-hie-local' },
    { language: 'as-IN', identifier: 'as-in-voice-1' }
  ];
  const lang = getResolvedTTSLanguage('as', voices);
  assert.equal(lang, 'as-IN');
});

test('TTS Voice Fallback - Assamese missing falls back to Hindi', () => {
  const voices = [
    { language: 'en-US', identifier: 'en-us-voice' },
    { language: 'hi-IN', identifier: 'hi-in-voice' }
  ];
  const lang = getResolvedTTSLanguage('as', voices);
  assert.equal(lang, 'hi-IN', 'Should prioritize Hindi when Assamese is absent');
});

test('TTS Voice Fallback - Assamese and Hindi missing falls back to English', () => {
  const voices = [
    { language: 'bn-IN', identifier: 'bn-in-voice' },
    { language: 'en-IN', identifier: 'en-in-voice' }
  ];
  const lang = getResolvedTTSLanguage('as', voices);
  assert.equal(lang, 'en-IN', 'Should prioritize English over Bengali if Hindi is absent');
});

test('TTS Voice Fallback - Assamese, Hindi, and English missing falls back to Bengali', () => {
  const voices = [
    { language: 'bn-IN', identifier: 'bn-in-voice' }
  ];
  const lang = getResolvedTTSLanguage('as', voices);
  assert.equal(lang, 'bn-IN', 'Should fall back to Bengali when others are absent');
});

test('TTS Voice Fallback - Empty voices list gracefully defaults with regional dialect', () => {
  assert.equal(getResolvedTTSLanguage('hi', []), 'hi-IN');
  assert.equal(getResolvedTTSLanguage('as', []), 'as-IN');
  assert.equal(getResolvedTTSLanguage('bn', []), 'bn-IN');
  assert.equal(getResolvedTTSLanguage('en', []), 'en-IN');
});

test('Dementia-friendly spoken memory text formatting', () => {
  const enText = formatSpokenMemoryText({
    personName: 'Raj',
    relation: 'Son',
    notes: 'Lives in Guwahati.',
    language: 'en'
  });
  assert.equal(enText, 'This is Raj, your Son. Lives in Guwahati.');

  const hiText = formatSpokenMemoryText({
    personName: 'राज',
    relation: 'Son',
    notes: 'गुवाहाटी में रहते हैं।',
    language: 'hi'
  });
  assert.equal(hiText, 'यह राज हैं, आपके बेटे। गुवाहाटी में रहते हैं।');

  const asText = formatSpokenMemoryText({
    personName: 'ৰাজ',
    relation: 'Son',
    notes: 'গুৱাহাটীত থাকে।',
    language: 'as'
  });
  assert.equal(asText, 'এখেত ৰাজ, আপোনাৰ ল’ৰা। গুৱাহাটীত থাকে।');

  const bnText = formatSpokenMemoryText({
    personName: 'রাজ',
    relation: 'Son',
    notes: 'গুয়াহাটিতে থাকেন।',
    language: 'bn'
  });
  assert.equal(bnText, 'ইনি রাজ, আপনার ছেলে। গুয়াহাটিতে থাকেন।');
});

test('All 16 specified relation types are mapped across languages', () => {
  const expectedRelations = [
    'Father', 'Mother', 'Son', 'Daughter', 'Spouse',
    'Friend', 'Grandson', 'Granddaughter', 'Brother', 'Sister',
    'Daughter-in-law', 'Son-in-law', 'Uncle', 'Aunty',
    'Caregiver/Nurse', 'Other'
  ];

  for (const rel of expectedRelations) {
    assert.ok(RELATION_LABELS_BY_LANG.en[rel], `Missing English translation for ${rel}`);
    assert.ok(RELATION_LABELS_BY_LANG.hi[rel], `Missing Hindi translation for ${rel}`);
    assert.ok(RELATION_LABELS_BY_LANG.as[rel], `Missing Assamese translation for ${rel}`);
    assert.ok(RELATION_LABELS_BY_LANG.bn[rel], `Missing Bengali translation for ${rel}`);
  }
});

