<script setup>
// Čistě vykreslovací komponenta — matematika (viditelný rozsah, "hezký" krok,
// px souřadnice) žije v GardenCanvas.vue (rulerTicksX/rulerTicksY), stejně
// jako u ostatních "hloupých" komponent v tomto adresáři (VertexHandles apod.).
defineProps({
  orientation: { type: String, required: true }, // 'horizontal' | 'vertical'
  ticks:       { type: Array,  required: true },  // [{ pos, label }] — pos v px vůči kontejneru plátna
})
</script>

<template>
  <div class="absolute inset-0 bg-white/90 backdrop-blur-sm overflow-hidden pointer-events-none select-none">
    <template v-for="(t, i) in ticks" :key="i">
      <div
        v-if="orientation === 'horizontal'"
        class="absolute top-0 h-full border-l border-garden-200"
        :style="{ left: t.pos + 'px' }"
      >
        <span class="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-garden-600 whitespace-nowrap">{{ t.label }}</span>
      </div>
      <div
        v-else
        class="absolute left-0 w-full border-t border-garden-200"
        :style="{ top: t.pos + 'px' }"
      >
        <span class="absolute left-1/2 -translate-x-1/2 top-0.5 text-[9px] leading-none text-garden-600 whitespace-nowrap">{{ t.label }}</span>
      </div>
    </template>
  </div>
</template>
