<script lang="js" setup>
import VAlert from '@/components/VAlert.vue';
import { useSettingsStore } from '@/stores/savedStore'
import { singlish_vowels, singlish_consonants, singlish_specials, singlish_combinations } from '@pnfo/singlish-search'
import { HeartHandshakeIcon, SendIcon, AtSignIcon } from 'lucide-vue-next';

const examples = [
  ['%පුද්ගල', '“පුද්ගල” යන අකුරු අන්තර්ගත වන සියලුම වචන'],
  ['%වාදය.', '“වාදය” යන අකුරු වලින් අවසන් වන සියලුම වචන'],
  ['aa%වාදය.', '“ආ” අකුරෙන් ආරම්භ වී “වාදය” යන පදයෙන් අවසන් වන සියලුම වචන'],
  ['ka%වැ%ma.', '“ක” අකුරෙන් ආරම්භ වී මැදට “වැ” අකුර යෙදී “ම” යන්නෙන් අවසන් වන වචන'],
]
</script>

<template>
  <div :style="useSettingsStore().fontSizeStyle">
    <VAlert color="success">
      තිබෙන වැරදි ගැන දැනුවත් කිරීමෙන්, අලුත් වචන සහ තේරුම් එකතු කිරීමෙන් සහ යෝජනා ඉදිරිපත් කිරීමෙන් මේ වෙබ් අඩවිය ඉදිරියට පවත්වාගෙන යාමට ඔබටත් උපකාර කළ හැකිය.
      <SendIcon class="inline" size="18"/> path.nirvana <AtSignIcon class="inline" size="18" /> gmail.com.
    </VAlert>
    <VAlert color="info">
      සිංහල ශබ්දකෝෂ කාර්යාලය විසින් සකස්කල සිංහල ශබ්දකෝෂ මෙම වෙබ් අඩවිය සඳහා යොදාගෙන ඇත. ඒ ආයතනයේ සියලුම කාර්ය මණ්ඩලයට අපගේ කෘතඥතාවය ලැබිය යුතුය.
      <HeartHandshakeIcon class="inline text-red-500" />
    </VAlert>
    <VAlert>
      <RouterLink to="/">මුල් පිටුවේ</RouterLink> දැක්වෙන උපදෙස් වලට අමතරව wildcard ලෙස ප්‍රතිශත අකුර (%) යොදාගෙන සෙවීම කල හැකිය. ඒ සඳහා උදාහරණ කිහිපයක් පහතින් දක්වා ඇත.
    </VAlert>
    
    <table class="max-w-[800px] w-full my-3 border-collapse">
      <thead class="bg-orange-200 dark:bg-orange-700">
          <tr>
              <td>සෙවුම් පදය</td>
              <td>විස්තරය</td>
          </tr>
      </thead>
      <tbody>
        <tr v-for="([word, desc], i) in examples" :key="i">
          <td><RouterLink :to="`/search/${word}`">{{ word }}</RouterLink></td>
          <td>{{ desc }}</td>
        </tr>
      </tbody>
    </table>

    <div class="container"> 
      <div class="sm:columns-2 lg:columns-3">

        <div class="break-inside-avoid-column">
          <div class="mb-2">ව්‍යාංජනාක්ෂර ඉංග්‍රීසි අකුරෙන් ලිවිය යුතු ආකාරය.</div>
          <table class="max-w-[300px] w-full my-3 border-collapse">
            <thead class="bg-orange-200 dark:bg-orange-700">
                <tr>
                    <td>ව්‍යාංජනාක්ෂර</td>
                    <td>ඉංග්‍රීසි අකුරෙන්</td>
                </tr>
            </thead>
            <tbody>
              <tr v-for="([first, second], i) in singlish_consonants" :key="i">
                <td>{{ first }}</td>
                <td>{{ second }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="break-inside-avoid-column">
          <div class="mb-2">ස්වාධීනව යෙදෙන ස්වරාක්ෂර සහ ව්‍යාංජනාක්ෂර සමග යෙදෙන ස්වරාක්ෂර ඉංග්‍රීසි අකුරෙන් ලිවිය යුතු ආකාරය.</div>
          <table class="max-w-[300px] w-full my-3 border-collapse">
            <thead>
                <tr>
                    <td>ස්වරාක්ෂරය</td>
                    <td>ඉංග්‍රීසි අකුරෙන්</td>
                </tr>
            </thead>
            <tbody>
              <tr v-for="([first, second], i) in [...singlish_vowels, ...singlish_specials]" :key="i">
                <td>{{ first }}</td>
                <td>{{ second }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="break-inside-avoid-column">
          <div class="mb-2">උදාහරණ වශයෙන් ක අකුර සමඟ ස්වරාක්ෂර යෙදෙන විට එය ඉංග්‍රීසි අකුරෙන් ලිවිය යුතු ආකාරය.</div>
          <table class="max-w-[300px] w-full my-3 border-collapse">
            <thead>
                <tr>
                    <td>ක + ස්වරාක්ෂර</td>
                    <td>ඉංග්‍රීසි අකුරෙන්</td>
                </tr>
            </thead>
            <tbody>
              <tr v-for="([first, second], i) in singlish_combinations" :key="i">
                <td>{{ 'ක' + first }}</td>
                <td>{{ second.split(',').map(n => 'k' + n.trim()).join(', ') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
      </div>
    </div>

  </div>
</template>

<style scoped>
table tbody td {
  @apply border border-gray-300 px-3 py-1;
}
table thead td {
  @apply border border-gray-300 p-2;
}
table thead {
  @apply bg-gray-300 dark:bg-gray-700;
}
table tbody tr {
  @apply even:bg-gray-200 even:dark:bg-gray-800;
}
a {
  @apply text-blue-600 dark:text-blue-400
}
</style>
