// Zero-invasion localStorage <-> SillyTavern server sync for Jinhe Nine Phone.
// - Shared keys (jinhe-phone-*): synced across all browsers/devices.
// - Profile-split keys (jinhe-phone-api-settings-v1): separated into 'local' vs 'remote' profiles.
// - Excluded keys (jinhe-phone-launch-position-v1): kept device-local.

const SYNC_VERSION = 1;
const SETTINGS_KEY = 'jinhe_phone_sync_v1';
const SYNC_PREFIXES = ['jinhe-phone-'];
const SPLIT_KEYS = new Set(['jinhe-phone-api-settings-v1']);
const EXCLUDED_KEYS = new Set(['jinhe-phone-launch-position-v1']);
const MAX_VALUE_CHARS = 512 * 1024; // 512 KB safety cap per key

let isHydrating = false;
let saveTimer = null;

function detectEnv() {
    try {
        const host = String(globalThis.location?.hostname || '').toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
            return 'local';
        }
    } catch {}
    return 'remote';
}

function shouldSyncKey(key) {
    if (typeof key !== 'string' || !key) return false;
    if (EXCLUDED_KEYS.has(key)) return false;
    return SYNC_PREFIXES.some(prefix => key.startsWith(prefix));
}

function getContext() {
    return globalThis.SillyTavern?.getContext?.() || null;
}

function ensureStore(ctx) {
    const ext = ctx?.extensionSettings;
    if (!ext || typeof ext !== 'object') return null;
    if (!ext[SETTINGS_KEY] || typeof ext[SETTINGS_KEY] !== 'object') {
        ext[SETTINGS_KEY] = {
            version: SYNC_VERSION,
            shared: {},
            profiles: { local: {}, remote: {} },
        };
    }
    const store = ext[SETTINGS_KEY];
    if (!store.shared || typeof store.shared !== 'object') store.shared = {};
    if (!store.profiles || typeof store.profiles !== 'object') store.profiles = {};
    if (!store.profiles.local || typeof store.profiles.local !== 'object') store.profiles.local = {};
    if (!store.profiles.remote || typeof store.profiles.remote !== 'object') store.profiles.remote = {};
    return store;
}

function getBucket(store, key, env) {
    if (SPLIT_KEYS.has(key)) {
        return store.profiles[env];
    }
    return store.shared;
}

function scheduleSave(ctx) {
    if (!ctx) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        try {
            if (typeof ctx.saveSettingsDebounced === 'function') {
                ctx.saveSettingsDebounced();
            } else if (typeof ctx.saveSettings === 'function') {
                ctx.saveSettings();
            }
        } catch (err) {
            console.warn('[jinhe-phone-settings-sync] Failed to save settings:', err);
        }
    }, 600);
}

function recordLocalChange(ctx, env, key, value, isRemove = false) {
    if (isHydrating || !shouldSyncKey(key)) return;
    const store = ensureStore(ctx);
    if (!store) return;

    const bucket = getBucket(store, key, env);
    if (isRemove) {
        if (Object.prototype.hasOwnProperty.call(bucket, key)) {
            delete bucket[key];
            scheduleSave(ctx);
        }
        return;
    }

    const strVal = String(value);
    if (strVal.length > MAX_VALUE_CHARS) {
        console.warn(`[jinhe-phone-settings-sync] Skipped oversized key "${key}" (${strVal.length} chars)`);
        return;
    }

    if (bucket[key]?.value === strVal) return;
    bucket[key] = { value: strVal, updatedAt: Date.now() };
    scheduleSave(ctx);
}

function hydrateAndBootstrap(ctx, env) {
    const store = ensureStore(ctx);
    const ls = globalThis.localStorage;
    if (!store || !ls) return false;

    let dirtyServer = false;
    isHydrating = true;
    try {
        // 1) Pull server -> localStorage for shared keys & current env profile keys
        const pullBuckets = [store.shared, store.profiles[env]];
        for (const bucket of pullBuckets) {
            for (const [key, entry] of Object.entries(bucket)) {
                if (!shouldSyncKey(key)) continue;
                if (entry && typeof entry.value === 'string') {
                    if (ls.getItem(key) !== entry.value) {
                        ls.setItem(key, entry.value);
                    }
                }
            }
        }

        // 2) Seed server from localStorage for any matching keys not yet on server
        for (let i = 0; i < ls.length; i++) {
            const key = ls.key(i);
            if (!shouldSyncKey(key)) continue;
            const bucket = getBucket(store, key, env);
            if (!Object.prototype.hasOwnProperty.call(bucket, key)) {
                const val = ls.getItem(key);
                if (typeof val === 'string' && val.length <= MAX_VALUE_CHARS) {
                    bucket[key] = { value: val, updatedAt: Date.now() };
                    dirtyServer = true;
                }
            }
        }
    } finally {
        isHydrating = false;
    }

    if (dirtyServer) {
        scheduleSave(ctx);
    }
    return true;
}

function installStorageHookOnWindow(win, ctx, env) {
    try {
        const proto = win?.Storage?.prototype;
        if (!proto || proto.__jinhePhoneSyncInstalled) return;

        const origSetItem = proto.setItem;
        const origRemoveItem = proto.removeItem;

        proto.setItem = function jinheSyncSetItem(key, value) {
            const result = origSetItem.call(this, key, value);
            try {
                if (this === win.localStorage) {
                    recordLocalChange(ctx, env, String(key), value, false);
                }
            } catch {}
            return result;
        };

        proto.removeItem = function jinheSyncRemoveItem(key) {
            const result = origRemoveItem.call(this, key);
            try {
                if (this === win.localStorage) {
                    recordLocalChange(ctx, env, String(key), null, true);
                }
            } catch {}
            return result;
        };

        proto.__jinhePhoneSyncInstalled = true;
    } catch {}
}

function isJinhePhoneIframe(node) {
    if (!node || node.tagName !== 'IFRAME') return false;
    return node.title === '金河九号随身机' || Boolean(node.jinhePhoneBridge);
}

function patchJinheIframe(iframe, ctx, env) {
    if (!isJinhePhoneIframe(iframe)) return;

    const inject = () => {
        try {
            const win = iframe.contentWindow;
            if (!win) return;
            if (!win.SillyTavern && globalThis.SillyTavern) {
                win.SillyTavern = globalThis.SillyTavern;
            }
            installStorageHookOnWindow(win, ctx, env);
        } catch {}
    };

    inject();
    if (!iframe.__jinheHostBridgeBound) {
        iframe.__jinheHostBridgeBound = true;
        iframe.addEventListener('load', inject);
    }
}

function installIframeObserver(ctx, env) {
    if (typeof globalThis.MutationObserver !== 'function' || !globalThis.document?.documentElement) return;

    try {
        for (const iframe of globalThis.document.querySelectorAll('iframe')) {
            patchJinheIframe(iframe, ctx, env);
        }
    } catch {}

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (!node || node.nodeType !== 1) continue;
                if (node.tagName === 'IFRAME') {
                    patchJinheIframe(node, ctx, env);
                } else if (typeof node.querySelectorAll === 'function') {
                    for (const iframe of node.querySelectorAll('iframe')) {
                        patchJinheIframe(iframe, ctx, env);
                    }
                }
            }
        }
    });
    observer.observe(globalThis.document.documentElement, { childList: true, subtree: true });
}

function installStorageHook(ctx, env) {
    installStorageHookOnWindow(globalThis, ctx, env);

    if (typeof globalThis.addEventListener === 'function') {
        globalThis.addEventListener('storage', (ev) => {
            if (!ev || ev.storageArea !== globalThis.localStorage || !ev.key) return;
            if (ev.newValue === null) {
                recordLocalChange(ctx, env, ev.key, null, true);
            } else {
                recordLocalChange(ctx, env, ev.key, ev.newValue, false);
            }
        });
    }
}

function init() {
    const ctx = getContext();
    const env = detectEnv();
    if (!ctx) return;

    hydrateAndBootstrap(ctx, env);
    installStorageHook(ctx, env);
    installIframeObserver(ctx, env);

    globalThis.__JINHE_PHONE_SYNC__ = {
        version: SYNC_VERSION,
        env,
        prefixes: [...SYNC_PREFIXES],
        splitKeys: [...SPLIT_KEYS],
        excludedKeys: [...EXCLUDED_KEYS],
        forcePushLocal() {
            const store = ensureStore(ctx);
            const ls = globalThis.localStorage;
            if (!store || !ls) return 0;
            let count = 0;
            for (let i = 0; i < ls.length; i++) {
                const key = ls.key(i);
                if (!shouldSyncKey(key)) continue;
                const val = ls.getItem(key);
                if (typeof val === 'string' && val.length <= MAX_VALUE_CHARS) {
                    getBucket(store, key, env)[key] = { value: val, updatedAt: Date.now() };
                    count++;
                }
            }
            if (count > 0) scheduleSave(ctx);
            return count;
        },
        forcePullServer() {
            return hydrateAndBootstrap(ctx, env);
        },
    };
}

init();
