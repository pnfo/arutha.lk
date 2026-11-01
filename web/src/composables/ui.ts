/** small global ui state: the toast and the abbreviation popover */
import { reactive, ref } from 'vue'

const toastMsg = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
export function toast(msg: string, ms = 2200) {
  toastMsg.value = msg
  clearTimeout(timer)
  timer = setTimeout(() => (toastMsg.value = ''), ms)
}
export const useToast = () => toastMsg

/** the abbreviation popover: its text and the rectangle of the abbreviation */
export const popover = reactive({ text: '', abbr: '', x: 0, y: 0, below: true })
export function showPopover(el: Element, abbr: string, text: string) {
  const r = el.getBoundingClientRect()
  Object.assign(popover, { text, abbr, x: Math.min(Math.max(r.left + r.width / 2, 120), window.innerWidth - 120), below: r.top < 160, y: r.top < 160 ? r.bottom + 6 : r.top - 6 })
}
export const hidePopover = () => { popover.text = '' }
