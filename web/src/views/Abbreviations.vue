<template>
  <div class="space-y-4" data-testid="abbreviations-page">
    <template v-if="d">
      <h1 class="text-xl font-bold"><DictBadge :code="d.code" /> {{ d.name }} – {{ S.abbreviations }}</h1>
      <table class="card w-full border-separate text-left">
        <tr v-for="k in keys" :key="k"><td class="text pr-4 font-semibold text-accent">{{ k }}</td><td class="text">{{ d.abbrevs![k] }}</td></tr>
      </table>
    </template>
    <Skeleton v-else-if="!dicts.length" />
    <p v-else class="card">{{ S.notFound }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { useDicts } from '@/composables/dict'
import { S } from '@/strings'
import DictBadge from '@/components/DictBadge.vue'
import Skeleton from '@/components/Skeleton.vue'

const route = useRoute()
const { dicts } = useDicts()
const d = computed(() => dicts.value.find(x => x.code === route.params.dict || x.v1 === route.params.dict))
const keys = computed(() => Object.keys(d.value?.abbrevs || {}).sort((a, b) => a.localeCompare(b, 'si')))
useHead(() => ({ title: `සංකේත නිරූපණය කෙටි යෙදුම් / Abbreviations of ${d.value?.name || ''} | අරුත.lk` }))
</script>
