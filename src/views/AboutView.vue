<script lang="js" setup>
import VAlert from '@/components/VAlert.vue';
import { useSettingsStore } from '@/stores/savedStore'
import { singlish_vowels, singlish_consonants, singlish_specials, singlish_combinations } from '@pnfo/singlish-search'
import { HeartHandshakeIcon, SendIcon, AtSignIcon } from 'lucide-vue-next';

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

    <div class="container"> 
      <div class="sm:columns-2">

        <div class="break-inside-avoid-column">
          <div class="mb-2">ව්‍යාංජනාක්ෂර ඉංග්‍රීසි අකුරෙන් ලිවිය යුතු ආකාරය.</div>
          <table class="max-w-[300px] w-full my-3 border-collapse">
            <thead class="bg-gray-300 dark:bg-gray-700">
                <tr>
                    <td class="border border-gray-300 p-2">ව්‍යාංජනාක්ෂර</td>
                    <td class="border border-gray-300 p-2">ඉංග්‍රීසි අකුර</td>
                </tr>
            </thead>
            <tbody>
              <tr v-for="([first, second], i) in singlish_consonants" :key="i" class="even:bg-gray-200 even:dark:bg-gray-800">
                <td class="border border-gray-300 p-2">{{ first }}</td>
                <td class="border border-gray-300 p-2">{{ second }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="break-inside-avoid-column">
          <div class="mb-2">ස්වාධීනව යෙදෙන ස්වරාක්ෂර සහ ව්‍යාංජනාක්ෂර සමග යෙදෙන ස්වරාක්ෂර ඉංග්‍රීසි අකුරෙන් ලිවිය යුතු ආකාරය.</div>
          <table class="max-w-[300px] w-full my-3 border-collapse">
            <thead class="bg-gray-300 dark:bg-gray-700">
                <tr>
                    <td class="border border-gray-300 p-2">ස්වරාක්ෂරය</td>
                    <td class="border border-gray-300 p-2">ඉංග්‍රීසි අකුර</td>
                </tr>
            </thead>
            <tbody>
              <tr v-for="([first, second], i) in [...singlish_vowels, ...singlish_specials]" :key="i" class="even:bg-gray-200 even:dark:bg-gray-800">
                <td class="border border-gray-300 p-2">{{ first }}</td>
                <td class="border border-gray-300 p-2">{{ second }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
      </div>
    </div>

  </div>
</template>

<style scoped>
</style>
