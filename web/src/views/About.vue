<template>
  <div class="space-y-5" data-testid="about-page">
    <h1 class="text-2xl font-bold text-primary">උපදෙස් සහ අප ගැන / Help and About Us</h1>

    <section id="help" class="card prose">
      <h2>සොයන ආකාරය / How to search</h2>
      <ul>
        <li>සිංහල අකුරෙන්, හෝ ඉංග්‍රීසි අකුරෙන් සිංහල (Singlish) ලියන්න: <RouterLink to="/search/akuru" class="link">akuru</RouterLink> → අකුරු. අකුරු ලියන විටම වචන යෝජනා වේ.</li>
        <li>ඉංග්‍රීසි වචනයක සිංහල තේරුම: <RouterLink :to="wordPath('love')" class="link">love</RouterLink>. සිංහල වචනයක ඉංග්‍රීසි තේරුම: <RouterLink :to="wordPath('ආදරය')" class="link">ආදරය</RouterLink>.</li>
        <li>පාලි වචන සිංහල හෝ රෝම අකුරෙන්, ඕනෑම විභක්ති රූපයකින්: <RouterLink to="/search/buddhassa" class="link">buddhassa</RouterLink>, <RouterLink :to="'/search/' + encodeURIComponent('ධම්මස්ස')" class="link">ධම්මස්ස</RouterLink> (Digital Pāḷi Dictionary).</li>
        <li>වචනයක් හමු නොවූ විට අනෙක් වචනවල තේරුම් තුළද සොයයි (උදා: “අම්මා” → මව, ජනිත්‍රී …).</li>
        <li>අවසානයට තිතක් (.) යෙදූ විට ඒ වචනය පමණි: <RouterLink to="/search/ගස." class="link">ගස.</RouterLink></li>
      </ul>
      <p>ඕනෑම අකුරු කිහිපයක් වෙනුවට තරු ලකුණ (<b>*</b>) යොදාගත හැකිය:</p>
      <table class="w-full">
        <tr v-for="[q, d] in wildcards" :key="q" class="border-t border-line">
          <td class="py-1 pr-3"><RouterLink :to="'/search/' + encodeURIComponent(q)" class="link">{{ q }}</RouterLink></td><td>{{ d }}</td>
        </tr>
      </table>
    </section>

    <section id="singlish" class="card prose">
      <h2>Singlish – ඉංග්‍රීසි අකුරෙන් ලිවිය යුතු ආකාරය</h2>
      <ul>
        <li>වචනය ඇසෙන ආකාරයට කුඩා ඉංග්‍රීසි අකුරෙන් ලියන්න: <RouterLink to="/search/budu" class="link">budu</RouterLink>,
          <RouterLink to="/search/sinhala" class="link">sinhala</RouterLink>, <RouterLink to="/search/dharmaya" class="link">dharmaya</RouterLink>.</li>
        <li>න/ණ, ල/ළ, ත/ථ, දීර්ඝ/හ්‍රස්ව ස්වර වෙන් කිරීමට අවශ්‍ය නැත (na, la, tha, i): වැඩිපුරම භාවිත වන අක්ෂර වින්‍යාසය මුලින් ලැබේ.
          “සෙව්වේ” යටතේ පෙන්වන්නේ ඔබ ලියූ දෙයට ගැළපෙන සිංහල අක්ෂර වින්‍යාසයි.</li>
        <li>පළමු අකුරේ සිටම වචන යෝජනා වේ. සිංහල සහ සිංග්ලිෂ් එකට ලිවිය හැක: <RouterLink :to="'/search/' + encodeURIComponent('ka*වැ*ma')" class="link">ka*වැ*ma</RouterLink>.</li>
        <li>එකම සිංහල අකුරට ඉංග්‍රීසි අකුරු කිහිපයක් ඇති විට ඕනෑම එකක් භාවිතා කළ හැක: ඛ – <i>ka</i> හෝ <i>kha</i>.</li>
      </ul>
      <div class="grid gap-4 text-sm sm:grid-cols-2">
        <table><tr v-for="[a, b] in singlish_consonants" :key="a" class="border-t border-line"><td class="text py-0.5 pr-3">{{ a }}</td><td>{{ b }}</td></tr></table>
        <table><tr v-for="[a, b] in [...singlish_vowels, ...singlish_specials]" :key="a" class="border-t border-line"><td class="text py-0.5 pr-3">{{ a }}</td><td>{{ b }}</td></tr></table>
      </div>
      <details>
        <summary class="cursor-pointer font-medium text-primary">ක අකුර සමඟ ස්වර සහ යංශය / රකාරාංශය (උදාහරණ)</summary>
        <table class="mt-2"><tr v-for="[a, b] in singlish_combinations.filter(([a]) => a !== '්')" :key="a" class="border-t border-line"><td class="text py-0.5 pr-3">ක{{ a }}</td><td>{{ b.split(',').map((n: string) => 'k' + n.trim()).join(', ') }}</td></tr></table>
      </details>
    </section>

    <section class="card prose">
      <h2>ශබ්දකෝෂ / Dictionaries</h2>
      <p>සිංහල ශබ්දකෝෂ කාර්යාංශය විසින් සකස් කළ සංක්ෂිප්ත සිංහල ශබ්දකෝෂය සහ අක්ෂර වින්‍යාස ශබ්දකෝෂය මෙහි යොදාගෙන ඇත. ඒ ආයතනයේ සියලුම කාර්ය මණ්ඩලයට අපගේ කෘතඥතාවය.</p>
      <p>පොල්වත්තේ බුද්ධදත්ත හිමියන්ගේ <RouterLink to="/dict/si-buddhadatta" class="link">පාලි-සිංහල අකාරාදිය</RouterLink> සහ මඩිතියවෙල සිරි සුමඞ්ගල හිමියන්ගේ
        <RouterLink to="/dict/si-sumangala" class="link">පාලි-සිංහල ශබ්දකෝෂය</RouterLink>: ඒවා සකස් කළ ආකාරය, ස්වේච්ඡා සේවකයන්, මුඛබන්ධය සහ PDF ඒ පිටුවල ඇත.</p>
      <p>{{ meta?.dpdCitation || 'Bodhirasa Bhikkhu. Digital Pāḷi Dictionary. https://www.dpdict.net/' }} – CC BY-NC-SA 4.0.</p>
      <div class="flex flex-wrap gap-2 pt-1">
        <RouterLink v-for="d in dicts" :key="d.code" :to="`/dict/${d.code}`" class="chip"><DictBadge :code="d.code" />{{ d.name }}</RouterLink>
      </div>
    </section>

    <section id="apps" class="card prose web-only">
      <h2>Apps</h2>
      <p>අන්තර්ජාලය නැතිව භාවිතා කළ හැකි app: <a :href="ANDROID_URL" rel="noopener">Android – Google Play</a>,
        <a v-if="IOS_URL" :href="IOS_URL" rel="noopener">iPhone / iPad – App Store</a><template v-else>{{ IOS_SOON }}</template>.
        මෙම වෙබ් අඩවියද ඔබගේ දුරකථනයට “Install” / “Add to Home screen” කළ හැකිය.</p>
    </section>

    <section class="card prose">
      <h2>අප ගැන / Contact</h2>
      <p>තිබෙන වැරදි ගැන දැනුවත් කිරීමෙන්, අලුත් වචන සහ තේරුම් එකතු කිරීමෙන් සහ යෝජනා ඉදිරිපත් කිරීමෙන් මේ වෙබ් අඩවිය ඉදිරියට පවත්වාගෙන යාමට ඔබටත් උපකාර කළ හැකිය:
        <a href="mailto:path.nirvana@gmail.com" class="link">path.nirvana@gmail.com</a></p>
      <p>No ads. No accounts. <a :href="privacyUrl" class="link">Privacy policy</a></p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useHead } from '@unhead/vue'
import { singlish_combinations, singlish_consonants, singlish_specials, singlish_vowels } from '@pnfo/singlish-search'
import { isNativeApp, useApi } from '@/data/api'
import type { Meta } from '@/data/types'
import { useDicts, wordPath } from '@/composables/dict'
import { ANDROID_URL, IOS_SOON, IOS_URL } from '@/apps'
import DictBadge from '@/components/DictBadge.vue'

const base = import.meta.env.BASE_URL
const privacyUrl = isNativeApp() ? 'https://arutha.lk/privacy-policy.html' : base + 'privacy-policy.html'
const { dicts } = useDicts()
const meta = ref<Meta | null>(null)
onMounted(async () => { try { meta.value = await useApi().meta() } catch { /* offline */ } })
const wildcards: [string, string][] = [
  ['*පුද්ගල*', '“පුද්ගල” යන අකුරු අන්තර්ගත වන සියලුම වචන'],
  ['*වාදය', '“වාදය” යන අකුරු වලින් අවසන් වන සියලුම වචන'],
  ['aa*වාදය', '“ආ” අකුරෙන් ආරම්භ වී “වාදය” යන පදයෙන් අවසන් වන සියලුම වචන'],
  ['ka*වැ*ma', '“ක” අකුරෙන් ආරම්භ වී මැදට “වැ” අකුර යෙදී “ම” යන්නෙන් අවසන් වන වචන'],
  ['*ssa', '“ssa” වලින් අවසන් වන පාලි වචන (රෝම අකුරෙන්)'],
]
useHead({ title: 'උපදෙස් සහ අප ගැන / Help and About Us | අරුත.lk' })
</script>
