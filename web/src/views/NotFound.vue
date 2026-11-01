<template>
  <div class="card space-y-3">
    <p>{{ S.notFound }}</p>
    <RouterLink to="/" class="btn-primary">{{ S.home }}</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { S } from '@/strings'

useHead({ title: 'Not found | අරුත.lk', meta: [{ name: 'robots', content: 'noindex' }] })
</script>
