const contextLib = require('/lib/xp/context');

/**
 * Per-vhost device-login flow gating.
 *
 * XP copies every `mapping.<vh>.context.<key>` entry into the request context as
 * an attribute (ContextFilter). We read the per-id-provider knobs from there, so a
 * vhost can keep the id provider configured while disabling specific flows, e.g.:
 *
 *   mapping.api.context.myidp.deviceLogin.issue       = false
 *   mapping.api.context.myidp.deviceLogin.accept      = true
 *
 * The same context keys are honoured natively by the future XP-core implementation,
 * so this gating contract is forward-compatible.
 */
function isFlowEnabled(idProviderConfig, flow, defaultValue) {
    const ctx = contextLib.get();
    const attributes = (ctx && ctx.attributes) || {};
    const value = attributes[`${idProviderConfig._idProviderName}.deviceLogin.${flow}`];
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    return value !== 'false';
}

exports.isFlowEnabled = isFlowEnabled;
