<template>
  <div class="p-6">
    <h1 class="text-xl font-bold mb-4">Test: Pre-Run Context Form</h1>
    <PreRunContextForm :aiFields="mockFields" @confirm="handleConfirm" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PreRunContextForm from './components/PreRunContextForm.vue'

const mockFields = ref({
  focus_keyword: 'egg cup',
  product_type: 'kitchen accessory',
  audience: 'European home decorators',
  buyer_vs_receiver: 'self',
  personalization: {
    name: false,
    date: false,
    color: true,
    size: false
  },
  style_trend: 'minimalist',
  seasonal_context: 'year-round',
  gift_emotion: 'AI_INFER_FAILED',
  relationship_type: 'AI_INFER_FAILED',
  tone_profile: {
    framing: 'functional elegance',
    voice: 'informative',
    lexicon_style: 'simple'
  },
  audience_profile: {
    persona_type: 'practical homemaker',
    cultural_context: 'European',
    style_alignment: 'modern',
    language_register: 'casual'
  },
  mockup_style: 'clean',
  mockup_mood: 'calm',
  mockup_color: 'neutral',
  fallback_profile: 'default-neutral',
  retry_reason: 'inference_failed_due_to_sparse_input'
})

const handleConfirm = (payload) => {
  console.log('Gebruiker heeft bevestigd:', payload)
}
</script>
