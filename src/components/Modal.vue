<template>
  <Teleport to="body">
    <div v-if="open" class="modal-mask" @click.self="emit('close')">
        <div class="modal" :class="{ 'is-plan': wide }" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div>
            <h2>{{ title }}</h2>
            <p v-if="subtitle">{{ subtitle }}</p>
          </div>
          <button type="button" class="ghost" @click="emit('close')">关闭</button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  open: Boolean,
  title: { type: String, default: "" },
  subtitle: { type: String, default: "" },
  wide: Boolean,
});
const emit = defineEmits(["close"]);
</script>
