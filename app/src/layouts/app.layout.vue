<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer class="bg-grey-2 text-primary">
      <q-separator />
      <q-tabs v-model="tab" align="justify">
        <q-route-tab name="calendar" icon="calendar_month" to="/" />
        <q-route-tab name="settings" icon="settings" to="/settings" />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<script setup>
defineOptions({ name: 'AppLayout' });

import { ref, onBeforeMount, watch } from 'vue';
import { useStore } from 'stores/store';
import { useRouter } from 'vue-router';

const tab = ref('calendar');
const $store = useStore();
const $router = useRouter();
</script>
