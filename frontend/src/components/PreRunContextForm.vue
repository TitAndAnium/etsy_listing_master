<template>
  <form class="grid grid-cols-2 gap-4 p-4 max-w-5xl mx-auto">
    <div v-for="field in mappedFields" :key="field.key" class="col-span-1">
      <label class="font-semibold block mb-1">{{ field.label }}</label>

      <!-- Text input -->
      <input v-if="field.type === 'text'" v-model="form[field.key]" class="w-full p-2 border rounded" :readonly="field.readonly" />

      <!-- Dropdown select -->
      <select v-else-if="field.type === 'dropdown'" v-model="form[field.key]" class="w-full p-2 border rounded">
        <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
      </select>

      <!-- Checkbox group for personalization -->
      <div v-else-if="field.type === 'checkbox-group'">
        <div v-for="(val, key) in form.personalization" :key="key" class="flex items-center gap-2">
          <input type="checkbox" v-model="form.personalization[key]" />
          <label>{{ key }}</label>
        </div>
      </div>

      <!-- Badge/readonly values -->
      <div v-else-if="field.type === 'badge-array'" class="flex flex-wrap gap-2">
        <span v-for="item in form[field.key]" :key="item" class="bg-gray-200 rounded-full px-3 py-1 text-sm">{{ item }}</span>
      </div>

      <!-- Warning if retry_reason present -->
      <div v-if="field.key === 'retry_reason' && form.retry_reason.length" class="mt-1 text-red-600 text-sm">
        ⚠️ Retry Reason(s): {{ form.retry_reason.join(', ') }}
      </div>
    </div>

    <div class="col-span-2 text-right mt-4">
      <button type="button" @click="submit" class="px-6 py-2 bg-black text-white rounded">Confirm & Continue</button>
    </div>
  </form>
</template>

<script>
export default {
  name: 'PreRunContextForm',
  props: {
    aiFields: Object
  },
  data() {
    return {
      form: JSON.parse(JSON.stringify(this.aiFields)),
      mappedFields: [
        { key: 'focus_keyword', label: 'Focus Keyword', type: 'text' },
        { key: 'product_type', label: 'Product Type', type: 'text' },
        { key: 'audience', label: 'Audience', type: 'text' },
        { key: 'buyer_vs_receiver', label: 'Buyer vs Receiver', type: 'dropdown', options: ['self', 'friend', 'spouse', 'parent', 'colleague'] },
        { key: 'personalization', label: 'Personalization', type: 'checkbox-group' },
        { key: 'style_trend', label: 'Style Trend', type: 'text' },
        { key: 'seasonal_context', label: 'Seasonal Context', type: 'text' },
        { key: 'tags', label: 'Tags (readonly)', type: 'badge-array' },
        { key: 'retry_reason', label: 'Retry Reason', type: 'badge-array' }
      ]
    }
  },
  methods: {
    submit() {
      this.$emit('confirm', {
        confirmed_fields: this.form,
        confirmed_by_user: true
      })
    }
  }
}
</script>

<style scoped>
form {
  background: #f8f8f8;
  border-radius: 1rem;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
}
</style>
