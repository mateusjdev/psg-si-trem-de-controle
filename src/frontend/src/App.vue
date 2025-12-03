<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import NavigationMenu from './components/NavigationMenu.vue'
import ToastContainer from './components/ToastContainer.vue'
import { useTemaStore } from './store/config/tema'

const tema = useTemaStore()
const route = useRoute()
const menuToggled = ref(false)
const rotaComMenu = computed(
  () => route.name !== 'login' && route.name !== 'loading' && route.name !== '404',
)
const mostrarMenu = computed(
  () => rotaComMenu.value && (!menuFullscreen.value || menuToggled.value),
)
const dataTema = computed(() =>
  rotaComMenu.value ? (tema.isDarkModePreferred ? 'dark' : 'light') : '',
)

const windowInnerWidth = ref(window.innerWidth)
const menuFullscreen = computed(() => windowInnerWidth.value < 1280)

onMounted(() =>
  window.addEventListener('resize', () => (windowInnerWidth.value = window.innerWidth)),
)
</script>

<template>
  <div
    :data-theme="dataTema"
    class="size-full"
    :class="[rotaComMenu ? 'flex flex-row' : 'flex justify-center items-center ']"
  >
    <div
      v-if="mostrarMenu"
      :class="[
        menuFullscreen
          ? 'size-full z-100 justify-center ms-auto overflow-y-auto'
          : 'fixed top-0 bottom-0 left-0 z-100 max-w-64 w-64 overflow-y-auto',
      ]"
    >
      <NavigationMenu />
    </div>
    <div
      :class="{ hidden: menuFullscreen && mostrarMenu, 'ms-64': mostrarMenu }"
      class="w-full h-full overflow-clip"
    >
      <RouterView class="relative" />
    </div>
    <ToastContainer />
  </div>
</template>
