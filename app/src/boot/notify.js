import { Notify } from 'quasar';

const templates = {
    positive: {
        color: 'positive',
        icon: 'check',
        position: 'top',
        timeout: 2000
    },
    negative: {
        color: 'negative',
        icon: 'error_outline',
        position: 'top',
        timeout: 2000
    }
};

// Pre-configured options for Notify
const notify = (message, options={}) => {
    const { type = 'positive', ...otherOptions } = options;
    Notify.create({
        message,
        ...templates[type],
        ...otherOptions
    });
};

export default ({ app }) => {
    app.provide('notify', notify);
};

export { notify };
