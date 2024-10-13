<template>
    <q-page>
        <div class="column q-pa-md items-center">
            <div class="text-h6 q-pa-md q-py-lg text-center">Byta-Kalender</div>

            <div>
                <span class="q-px-md">
                    <q-badge color="primary" rounded class="q-mr-sm" />Ausgefüllt
                </span>
                <span class="q-px-md">
                    <q-badge color="warning" rounded class="q-mr-sm" />Ausnahme
                </span>
            </div>

            <q-date v-model="date" minimal first-day-of-week="1" flat style="min-width: 350px;" :events="eventsFn"
                class="q-px-md" @navigation="onNavigate" :event-color="eventColor" mask="YYYY-MM-DD">
                <!-- <q-inner-loading :showing="loading" label="Loading..." label-style="font-size: 1.1em" /> -->
            </q-date>

            <div class="full-width row justify-between items-center q-mb-md">
                <q-btn flat round dense icon="chevron_left"
                    @click="date = dayjs(date).subtract(1, 'd').format('YYYY-MM-DD')" />
                <span class="text-bold">{{ dayjs(date).format("dddd, MMMM D, YYYY") }}</span>
                <q-btn flat round dense icon="chevron_right"
                    @click="date = dayjs(date).add(1, 'd').format('YYYY-MM-DD')" />
            </div>
        </div>
        <q-list v-if="day" class="q-pa-md">
            <q-item v-for="item, index in day.items" :key="item">
                <q-item-section>
                    <q-item-label>{{ $store.descriptions[index] }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-btn-toggle flat v-model="item.owner" toggle-color="primary" :options="$store.options" />
                </q-item-section>
            </q-item>
            <!-- <q-item>
                <q-item-section>
                    <q-input v-model="day.comment">
                        <template v-slot:prepend>
                            <q-icon name="notes" />
                        </template>
                    </q-input>
                </q-item-section>
            </q-item> -->
        </q-list>
        <q-page-sticky position="bottom" :offset="[28, -28]" style="z-index: 6000;">
            <q-btn fab icon="save" color="accent" @click="onClickSave" />
        </q-page-sticky>
        <!-- <div>Day: {{ day }}</div><br>
        <div>Days: {{ days }}</div> -->
    </q-page>
</template>

<script setup>
defineOptions({ name: "CalendarPage" });

import { ref, watch, computed, inject, onMounted, onBeforeMount } from 'vue';
import { useStore } from 'stores/store';
import dayjs from 'dayjs';
import _ from 'lodash';
import { v4 as uuid } from "uuid";

const $store = useStore();
const $notify = inject('notify');
const date = ref(dayjs().format('YYYY-MM-DD'));
const day = ref(null);
// const loading = ref(false);

const days = computed(() => {
    return $store.days;
});

const updateDay = () => {
    day.value = days.value.find(day => day.date == date.value);
};

watch(date, (newDate, oldDate) => {
    updateDay();

    // Remove day of oldDate if empty
    const oldDay = days.value.find(day => day.date == oldDate);
    if (oldDay && oldDay.items.every(item => item.owner == null) && oldDay.comment == "") {
        days.value.splice(days.value.findIndex(day => day.date == oldDate), 1);
    }

    // Add day of newDate
    if (!day.value) {
        $store.days.push({
            date: newDate,
            ..._.cloneDeep($store.default)
        });

        updateDay();
    }
});

onBeforeMount(async () => {
    await $store.loadItems();

    updateDay();

    if (!day.value) {
        $store.days.push({
            date: date.value,
            ..._.cloneDeep($store.default)
        });
        updateDay();
    }
});

const onNavigate = async (view) => {
    const oldDate = date.value;

    // Update date
    view.month -= 1;

    if (dayjs(view).startOf('month').isAfter(date.value)) {
        date.value = dayjs(view).startOf('month').format('YYYY-MM-DD');
    }
    else if (dayjs(view).endOf('month').isBefore(date.value)) {
        date.value = dayjs(view).endOf('month').format('YYYY-MM-DD');
    }
};

const onClickToday = () => {
    date.value = dayjs().format('YYYY-MM-DD');
};

const eventsFn = (date) => {
    return !!days.value.find(day => dayjs(day.date).isSame(date));
};

const eventColor = (date) => {
    const day = days.value.find(day => dayjs(day.date).isSame(date));
    return day.items.some(item => item.owner != null) || day.comment == "" ? 'primary' : 'warning';
};

const onClickSave = async () => {
    // Update current day
    if (day.value.items.every(item => item.owner == null) && day.value.comment == "") {
        days.value.splice(days.value.findIndex(d => d.date == day.value.date), 1);
    }

    const result = await $store.save();
    if (result) {
        $notify('Calendar updated!', { caption: `${result.created} events created, ${result.edited} edited, ${result.removed} removed.` });

        updateDay();

        if (!day.value) {
            $store.days.push({
                date: date.value,
                ..._.cloneDeep($store.default)
            });
            updateDay();
        }
    }
};
</script>