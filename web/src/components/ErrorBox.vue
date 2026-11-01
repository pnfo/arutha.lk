<template>
  <div class="card flex items-center justify-between gap-3" role="alert">
    <span>{{ online ? S.error : S.offline }}</span>
    <button class="btn" @click="$emit('retry')">{{ S.retry }}</button>
  </div>
</template>

<script setup lang="ts">
import { S } from '@/strings'

defineEmits<{ retry: [] }>()
const online = typeof navigator === 'undefined' || navigator.onLine !== false
</script>
