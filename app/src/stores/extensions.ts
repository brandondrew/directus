import api from '@/api';
import type { ApiOutput } from '@directus/extensions';
import { APP_OR_HYBRID_EXTENSION_TYPES } from '@directus/extensions';
import { isIn } from '@directus/utils';
import { isEqual } from 'lodash';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNotificationsStore } from './notifications';

const getEnabledBrowserExtensions = (extensions: ApiOutput[]) => {
	const enabledIds: string[] = [];

	for (const extension of extensions) {
		if (!extension.schema || !extension.schema.type) continue;

		if (isIn(extension.schema.type, APP_OR_HYBRID_EXTENSION_TYPES) && extension.meta.enabled) {
			enabledIds.push(extension.id);
		}

		if (extension.schema.type === 'bundle') {
			const nested = extensions.filter((child) => child.bundle === extension.id);
			const enabled = getEnabledBrowserExtensions(nested);

			enabledIds.push(...enabled);

			if (extension.schema.partial === false && enabled.length > 0) {
				enabledIds.push(extension.id);
			}
		}
	}

	return enabledIds;
};

export const useExtensionsStore = defineStore('extensions', () => {
	const notificationsStore = useNotificationsStore();
	const { t } = useI18n();

	const loading = ref(false);
	const error = ref<unknown>(null);
	const extensions = ref<ApiOutput[]>([]);

	const refresh = async (forceRefresh = true) => {
		loading.value = true;

		const currentlyEnabledBrowserExtensions = getEnabledBrowserExtensions(extensions.value);

		try {
			const response = await api.get('/extensions');
			extensions.value = response.data.data;

			const newEnabledBrowserExtensions = getEnabledBrowserExtensions(extensions.value);

			if (forceRefresh && isEqual(currentlyEnabledBrowserExtensions, newEnabledBrowserExtensions) === false) {
				notificationsStore.add({
					title: t('reload_required'),
					text: t('extension_reload_required_copy'),
					type: 'warning',
					dialog: true,
					persist: true,
					dismissText: t('extension_reload_now'),
					dismissAction: () => {
						window.location.reload();
					},
				});
			}
		} catch (err) {
			error.value = err;
		} finally {
			loading.value = false;
		}
	};

	const toggleState = async (id: string) => {
		const extension = extensions.value.find((ext) => ext.id === id);

		if (!extension) throw new Error(`Extension with ID ${id} does not exist`);

		const current = extension.meta.enabled;
		const endpoint = `/extensions/${id}`;

		await api.patch(endpoint, { meta: { enabled: !current } });
		await refresh();
	};

	refresh(false);

	return { extensions, loading, error, refresh, toggleState };
});
