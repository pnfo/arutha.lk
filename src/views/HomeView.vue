<script setup>
import { useSettingsStore } from '@/stores/savedStore'
import VAlert from '../components/VAlert.vue';
import {AtSignIcon, SendIcon} from 'lucide-vue-next'

const examples = [
  ['alu.', 'අලු, අළු'],
  ['nuvana.', 'නුවණ, නුවන'],
  ['kala.', 'කල, කලා, කාල, කළ, කාළ, කළා'],
  ['naengu', 'නැඟු..., නැංගු...'],
  ['samkra', 'සංක්‍ර..., සංක්‍රා...'],
  ['krumiya', 'කෘමියා']
]

</script>

<template>
  <div class="m-1">
      <VAlert :border="true" color="warning">
        <div>
          මෙම ශබ්දකෝෂයේ පාරිභාෂික වචන 5600 පමණ තිබෙන නමුත් ඉන් බොහොමයක් වචන වලට අදාළ ඉංග්‍රීසි වචන ඇතුළත් වී නොමැත. මේ වචන ඇතුළු කිරීමට ඔබට උපකාර කළ හැකි නම්
          <SendIcon class="inline" size="18"/> path.nirvana <AtSignIcon class="inline" size="18" /> gmail.com වෙත පණිවුඩයක් එවන්න.
        </div>
      </VAlert>

      <div class="text-primary text-4xl text-center mt-4">අරුත.lk</div>

      <ul class="mx-8 mt-4 list-disc list-inside">
        <li>සෙවීම සඳහා උඩ කොටුවේ සෙවුම් පද යොදන්න.</li>
        <li>ඉංග්‍රීසි අකුරු හෝ සිංහල අකුරු යොදා ගෙන සෙවීම සිදු කළ හැකිය. උදා. <RouterLink to="/search/janaka">janaka</RouterLink>, <RouterLink to="/search/ජනක">ජනක</RouterLink></li>
        <li>සෙවුම් පදයෙන් ආරම්භ වන සියලුම වචන පෙන්වන අතර සෙවුම් පදයෙන් අවසන් වීම ද සිදුවිය යුතු නම් අගට තිතක් යොදන්න. උදා <RouterLink to="/search/ජනක.">ජනක.</RouterLink></li>
        <li>අක්ෂර වින්‍යාසය හෝ නණලළ භේදය නොසලකා සෙවීම කළ යුතු නම් ඉංග්‍රීසි අකුරු යොදාගන්න. උදා <RouterLink to="/search/naya.">naya.</RouterLink> යන සෙවුම මගින් “නය” සහ “ණය” යන වචන දෙකටම අදාළ ප්‍රතිඵල ලැබේ.
          එමගින් යම් වචනයක නිවැරදි අක්ෂර වින්‍යාසය ඔබට සොයාගත හැකිය.</li>
      </ul>

      <table class="max-w-[600px] w-full my-3 border-collapse">
        <thead>
          <tr>
            <th class="border border-gray-300 p-2">ඉංග්‍රීසියෙන් සොයන අයුරු</th>
            <th class="border border-gray-300 p-2">සිංහලෙන් ලැබෙන ප්‍රතිඵල</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="([first, second], i) in examples" :key="i">
            <th class="border border-gray-300 p-2 text-subtitle-1">
              <RouterLink :to="'/search/' + first" class="no-underline">{{ first }}</RouterLink>
            </th>
            <th class="border border-gray-300 p-2">{{ second }}</th>
          </tr>
        </tbody>
      </table>
  </div>
</template>
