<template>
    <div class="relative w-64" ref="dropdownRef">
      <button
        @click="toggleDropdown"
        class="w-full px-4 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {{ selectedBooks.length ? `${selectedBooks.length} book(s) selected` : 'Select books' }}
      </button>
      <div
        v-if="isOpen"
        class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg"
      >
        <ul class="py-1 max-h-60 overflow-auto">
          <li
            v-for="book in books"
            :key="book.id"
            @click="toggleBook(book)"
            class="px-4 py-2 cursor-pointer hover:bg-blue-100"
          >
            <label class="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                :checked="isSelected(book)"
                class="form-checkbox h-5 w-5 text-blue-600"
                @click.stop
              />
              <span>{{ book.title }}</span>
            </label>
          </li>
        </ul>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  
  const props = defineProps({
    modelValue: {
      type: Array,
      default: () => []
    }
  })
  
  const emit = defineEmits(['update:modelValue'])
  
  const isOpen = ref(false)
  const dropdownRef = ref(null)
  
  const books = [
    { id: 1, title: 'To Kill a Mockingbird' },
    { id: 2, title: '1984' },
    { id: 3, title: 'Pride and Prejudice' },
    { id: 4, title: 'The Great Gatsby' },
    { id: 5, title: 'One Hundred Years of Solitude' },
    { id: 6, title: 'Brave New World' }
  ]
  
  const selectedBooks = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })
  
  const toggleDropdown = () => {
    isOpen.value = !isOpen.value
  }
  
  const toggleBook = (book) => {
    const newSelectedBooks = isSelected(book)
      ? selectedBooks.value.filter(b => b.id !== book.id)
      : [...selectedBooks.value, book]
    selectedBooks.value = newSelectedBooks
  }
  
  const isSelected = (book) => selectedBooks.value.some(b => b.id === book.id)
  
  const handleClickOutside = (event) => {
    if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
      isOpen.value = false
    }
  }
  
  onMounted(() => {
    document.addEventListener('click', handleClickOutside)
  })
  
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })
  </script>