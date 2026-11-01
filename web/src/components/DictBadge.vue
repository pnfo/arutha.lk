<!-- the short name of a dictionary in the colour of its headword language (icon: Sinhala / Pali / English cards) -->
<template>
  <span class="badge" :class="`src-${d?.src || 'si'}`" :title="d?.name">{{ d?.short || code }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDicts } from '@/composables/dict'

const props = defineProps<{ code: string }>()
const { byCode } = useDicts()
const d = computed(() => byCode(props.code))
</script>
