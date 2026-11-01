<template>
    <div :class="[
      'rounded-lg shadow-md overflow-hidden',
      colorClasses,
      {
        'border': variant === 'outlined',
        'bg-opacity-10 dark:bg-opacity-20': variant === 'tonal'
      }
    ]">
      <!-- Card image -->
      <img v-if="src" :src="src" :alt="alt" class="w-full h-48 object-cover">
      
      <div class="p-4">
        <!-- Prepend icon -->
        <div v-if="prependIcon" class="flex items-center mb-2">
          <component :is="prependIcon" :class="[`w-6 h-6 mr-2`, iconColorClass]" />
          <div>
            <!-- Title slot -->
            <h3 v-if="$slots.title" :class="[`text-lg font-semibold`, textColorClass]">
              <slot name="title"></slot>
            </h3>
            <!-- Subtitle slot -->
            <p v-if="$slots.subtitle" :class="[`text-sm`, subtitleColorClass]">
              <slot name="subtitle"></slot>
            </p>
          </div>
        </div>
        
        <!-- Title and subtitle without prepend icon -->
        <div v-else>
          <h3 v-if="$slots.title" :class="[`text-lg font-semibold mb-1`, textColorClass]">
            <slot name="title"></slot>
          </h3>
          <p v-if="$slots.subtitle" :class="[`text-sm mb-2`, subtitleColorClass]">
            <slot name="subtitle"></slot>
          </p>
        </div>
        
        <!-- Text slot -->
        <div v-if="$slots.text" :class="[`text-base mb-4`, textColorClass]">
          <slot name="text"></slot>
        </div>
        
        <!-- Append icon -->
        <div v-if="appendIcon" class="flex items-center justify-end mb-2">
          <component :is="appendIcon" :class="[`w-6 h-6 ml-2`, iconColorClass]" />
        </div>
      </div>
      
      <!-- Actions slot -->
      <div v-if="$slots.actions" :class="[`px-4 py-3`, actionsColorClass]">
        <slot name="actions"></slot>
      </div>
    </div>
  </template>
  
  <script setup>
  import { computed } from 'vue';
  
  const props = defineProps({
    src: {
      type: String,
      default: ''
    },
    alt: {
      type: String,
      default: 'Card image'
    },
    prependIcon: {
      type: Function,
      default: null
    },
    appendIcon: {
      type: Function,
      default: null
    },
    variant: {
      type: String,
      default: 'elevated',
      validator: (value) => ['elevated', 'tonal', 'outlined'].includes(value)
    },
    color: {
      type: String,
      default: 'gray'
    }
  });
  
  const colorMap = {
    gray: 'gray',
    red: 'red',
    green: 'green',
    blue: 'blue',
    yellow: 'yellow',
    indigo: 'indigo',
    purple: 'purple',
    pink: 'pink'
  };
  
  const colorClasses = computed(() => {
    const baseColor = colorMap[props.color] || 'gray';
    if (props.variant === 'outlined') {
      return `bg-white dark:bg-gray-800 border-${baseColor}-500 dark:border-${baseColor}-400`;
    } else if (props.variant === 'tonal') {
      return `bg-${baseColor}-500 dark:bg-${baseColor}-400`;
    } else {
      return `bg-white dark:bg-gray-800`;
    }
  });
  
  const textColorClass = computed(() => {
    const baseColor = colorMap[props.color] || 'gray';
    if (props.variant === 'tonal') {
      return `text-${baseColor}-900 dark:text-${baseColor}-100`;
    } else {
      return `text-${baseColor}-800 dark:text-${baseColor}-100`;
    }
  });
  
  const subtitleColorClass = computed(() => {
    const baseColor = colorMap[props.color] || 'gray';
    if (props.variant === 'tonal') {
      return `text-${baseColor}-800 dark:text-${baseColor}-200`;
    } else {
      return `text-${baseColor}-600 dark:text-${baseColor}-300`;
    }
  });
  
  const iconColorClass = computed(() => {
    const baseColor = colorMap[props.color] || 'gray';
    return `text-${baseColor}-500 dark:text-${baseColor}-400`;
  });
  
  const actionsColorClass = computed(() => {
    const baseColor = colorMap[props.color] || 'gray';
    if (props.variant === 'tonal') {
      return `bg-${baseColor}-600 dark:bg-${baseColor}-500`;
    } else {
      return `bg-${baseColor}-100 dark:bg-${baseColor}-700`;
    }
  });
  </script>