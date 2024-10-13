// stores/store.js
import { defineStore } from "pinia";
import { api as $api } from "boot/axios";
import dayjs from "dayjs";
import objectSupport from 'dayjs/plugin/objectSupport';

dayjs.extend(objectSupport);
// import { notify as $notify } from "boot/notify";
// import _ from "lodash";

export const useStore = defineStore("store", {
  state: () => ({
    days: [],
    default: {
      items: [{ owner: null }, { owner: null }],
      comment: ""
    },
    descriptions: ["Hinbringen", "Abholen"],
    options: [{ label: 'Leines', value: 'Leines' }, { label: 'Roßes', value: "Roßes" }, , { icon: "remove", value: null }]
  }),
  getters: {},
  actions: {
    async loadItems() {
      const response = await $api.get("/");
      this.days = response.data.days;
    },
    async save() {
      try {
        const response = await $api.post("/", { days: this.days });
        this.days = response.data.days;

        const { created, edited, removed } = response.data;
        return { created, edited, removed };
      } catch (err) {
        return false;
      }
    }
  },
  persist: {},
});
