# Groups-claim support for the OIDC ID Provider

Status: Design
Issue: [enonic/app-oidc-idprovider#254](https://github.com/enonic/app-oidc-idprovider/issues/254)
Related: [enonic/app-entra-idprovider#26](https://github.com/enonic/app-entra-idprovider/issues/26) (Entra overage handling, downstream)

## 1. Background

Identity providers like Okta, Microsoft Entra ID, Auth0, and Keycloak can include a list of the user's groups/roles in the OIDC ID token (and/or userinfo response). Today this app cannot consume that list: group membership in Enonic XP is managed either manually or via the static `defaultGroups` setting, which only applies at user-creation time.

Customers want OIDC-managed group membership: on every login, the user's Enonic group memberships should reflect what the IdP says.

## 2. Provider landscape

| Provider | Claim name | Default shape | Configuration required |
|---|---|---|---|
| Microsoft Entra ID | `groups` (+ `roles` for app roles) | array of GUIDs by default | `groupMembershipClaims` in the app manifest |
| Okta | `groups` (customizable; custom AS) | array of names | `groups` scope + claim with filter |
| Auth0 | `https://<namespace>/groups` (namespaced URI) | array of strings, set by an Action | Action / post-login flow |
| Keycloak | `groups` (mapper) **or** `realm_access.roles` / `resource_access.<client>.roles` (default) | array of strings, sometimes nested | Built-in `roles` scope; Group Membership mapper for `groups` |
| Google | (none in OIDC) | — | Use Cloud Identity Groups API out-of-band |
| ID-porten | (none) | — | Group/role data is not part of ID-porten ID tokens |

Implications for the design:

- The claim path must support both **top-level keys** (`groups`) and **nested dotted paths** (`realm_access.roles`).
- Auth0 namespaces the claim with a URI (`https://app.example.com/groups`). URI/URN-shaped names must be treated as literal keys, not dotted paths.
- Entra emits GUIDs by default. A per-value mapping table (claim value → Enonic group key) is the natural way to handle both naming differences and GUIDs without a separate translation feature.
- Entra's "groups overage" indirection (`_claim_names` / `hasgroups`, present for users in >200 groups) requires a Graph API call to resolve. This is out of scope for the generic upstream feature and tracked downstream in app-entra-idprovider#26.

## 3. Goals & non-goals

### Goals

1. Allow admins to configure a claim path to read group membership from.
2. Allow admins to map each OIDC claim value to a specific Enonic group key.
3. Add the user to all mapped Enonic groups on every login. Auto-create groups that don't exist yet.
4. Default: feature disabled. Existing `.cfg` files behave identically to today.
5. Provide an opt-in "sync" mode that also revokes memberships in mapped groups not present in the claim, so customers have a path for handling group rot without external tooling.
6. Provide an opt-in path for groups sync during JWT Bearer autoLogin (API flows).

### Non-goals

- Microsoft Entra "groups overage" handling — downstream, in app-entra-idprovider#26.
- Regex include/exclude filters or prefix-strip — the per-value mapping covers the use cases identified during design. May be revisited if a real customer asks.
- Cross-IDP group keys in a mapping (e.g. `mapping.0.group=group:other-idp:foo`) — rejected at config load.
- Changes to `defaultGroups` semantics — stays creation-only, unchanged.
- A separate config switch to enable/disable the feature. Presence of `groups.claim` IS the switch.

## 4. Configuration schema

All new properties are per-IDP, prefixed with `idprovider.<name>.`:

```properties
# --- groups feature ---
groups.claim=(string, optional)
    # JSON path to the groups claim in the merged claims object.
    # - If the value contains ':' (URI scheme or URN), treated as a literal key.
    #   Example: "https://app.example.com/groups", "urn:example:groups".
    # - Otherwise split on '.' as a dotted path. Example: "groups", "realm_access.roles".
    # Feature is disabled when this property is absent or empty.

groups.mapping.<i>.value=(string, required if mapping.<i>.group is set)
    # The literal value as it appears in the OIDC claim array.
    # Compared with strict equality (case-sensitive).

groups.mapping.<i>.group=(string, required if mapping.<i>.value is set)
    # The Enonic group key the value maps to.
    # MUST start with "group:<this-idp-name>:". Cross-IDP keys are rejected.

groups.syncMode=(add|sync, optional, default "add")
    # add: only add the user to mapped groups present in the claim.
    # sync: also remove the user from mapped groups NOT present in the claim
    #       (only groups that appear in this mapping are touched; other memberships are preserved).

groups.createGroups=(true|false, optional, default true)
    # When true, auto-create any group referenced in a mapping that does not yet exist.
    # When false, missing groups are skipped with a warning.

# --- autoLogin section, with one new key ---
autoLogin.applyGroups=(true|false, optional, default false)
    # When true, also apply groups sync during JWT Bearer autoLogin.
    # The claim is resolved against the raw JWT payload (no userinfo fetch).
```

### Configuration examples

#### Okta (group names, custom AS)

```properties
idprovider.okta.oidcWellKnownEndpoint=https://example.okta.com/.well-known/openid-configuration
idprovider.okta.clientId=0oa...
idprovider.okta.clientSecret=...
idprovider.okta.scopes=profile email groups
idprovider.okta.groups.claim=groups
idprovider.okta.groups.mapping.0.value=Admins
idprovider.okta.groups.mapping.0.group=group:okta:admins
idprovider.okta.groups.mapping.1.value=QA-Team
idprovider.okta.groups.mapping.1.group=group:okta:qa
idprovider.okta.groups.mapping.2.value=Developers
idprovider.okta.groups.mapping.2.group=group:okta:devs
```

#### Microsoft Entra ID (default GUIDs, full sync)

```properties
idprovider.entra.oidcWellKnownEndpoint=https://login.microsoftonline.com/<tenant>/v2.0/.well-known/openid-configuration
idprovider.entra.clientId=...
idprovider.entra.clientSecret=...
idprovider.entra.groups.claim=groups
idprovider.entra.groups.mapping.0.value=e89a3118-2e11-4f8c-9b3a-...
idprovider.entra.groups.mapping.0.group=group:entra:admins
idprovider.entra.groups.mapping.1.value=b4c2a912-1234-5678-90ab-...
idprovider.entra.groups.mapping.1.group=group:entra:developers
idprovider.entra.groups.syncMode=sync
```

#### Auth0 (namespaced URI claim set by a post-login Action)

```properties
idprovider.auth0.oidcWellKnownEndpoint=https://example.auth0.com/.well-known/openid-configuration
idprovider.auth0.clientId=...
idprovider.auth0.clientSecret=...
idprovider.auth0.groups.claim=https://app.example.com/groups
idprovider.auth0.groups.mapping.0.value=admins
idprovider.auth0.groups.mapping.0.group=group:auth0:admins
idprovider.auth0.groups.mapping.1.value=qa
idprovider.auth0.groups.mapping.1.group=group:auth0:qa
```

#### Keycloak (nested roles claim)

```properties
idprovider.keycloak.oidcWellKnownEndpoint=https://kc.example.com/realms/main/.well-known/openid-configuration
idprovider.keycloak.clientId=...
idprovider.keycloak.clientSecret=...
idprovider.keycloak.groups.claim=realm_access.roles
idprovider.keycloak.groups.mapping.0.value=admin
idprovider.keycloak.groups.mapping.0.group=group:keycloak:admins
idprovider.keycloak.groups.mapping.1.value=developer
idprovider.keycloak.groups.mapping.1.group=group:keycloak:devs
```

#### API with autoLogin (Bearer tokens carrying groups)

```properties
idprovider.api.jwksUri=https://issuer.example.com/.well-known/jwks.json
idprovider.api.autoLogin.createUser=true
idprovider.api.autoLogin.allowedAudience=https://service.example.com/api
idprovider.api.autoLogin.applyGroups=true
idprovider.api.groups.claim=groups
idprovider.api.groups.mapping.0.value=service-admin
idprovider.api.groups.mapping.0.group=group:api:admins
idprovider.api.groups.mapping.1.value=service-user
idprovider.api.groups.mapping.1.group=group:api:users
```

## 5. Module structure

A new module `src/main/resources/lib/groupSync.js` owns the groups logic. Name is `groupSync` (not `groups`) to avoid confusion with `app-entra-idprovider`'s existing `lib/group.js`, which performs a Graph-API-based equivalent.

```javascript
// lib/groupSync.js

// Resolve the configured claim path against the merged claims object
// and return the deduplicated list of Enonic group keys the user
// should be a member of, according to the mapping.
// Returns [] when the feature is disabled, the claim is missing or
// non-array, or no values match the mapping.
exports.resolveGroupKeysFromClaims = function (idProviderConfig, claims) { ... };

// Reconcile the user's memberships in MAPPED groups according to syncMode.
// - 'add' mode: add user to each desired group not yet a member of.
// - 'sync' mode: same, plus remove user from mapped groups not in desired.
// Auto-creates missing groups when groups.createGroups is true.
// On per-group failures, logs a warning and continues. Never throws.
exports.applyGroups = function (idProviderConfig, userKey, desiredGroupKeys) { ... };
```

### Why a separate module

- `login.js` is already 250 lines and mixes user provisioning, claim merging, profile saving, event emission, and login. Adding sync logic inline would push it past easy comprehension.
- Test isolation: `groupSync` can be unit-tested with mocked `authLib` independently of the login flow.
- Future Entra-fork integration: app-entra-idprovider can either keep its own Graph-based path (no change) or, once #26 lands, call `groupSync.applyGroups` with the list of group object IDs it resolved via Graph.

## 6. Algorithm

### 6.1 On interactive login (`login.js:login()` with `isAutoLogin=false`)

Hook is placed AFTER profile save / user update, BEFORE the existing `doLogin` call:

```
1. If idProviderConfig.groups is null  → skip (feature disabled).
2. desired = groupSync.resolveGroupKeysFromClaims(idProviderConfig, claims)
3. runAsSu: groupSync.applyGroups(idProviderConfig, principalKey, desired)
4. Proceed with doLogin.
```

`claims` here is the same merged claims object already passed to `saveClaims`/`updateUserData` (ID token + userinfo merged into `claims.userinfo`).

### 6.2 On JWT Bearer autoLogin (`isAutoLogin=true`)

```
1. If idProviderConfig.groups is null  → skip.
2. If idProviderConfig.autoLogin.applyGroups is false → skip.
3. Wrap the raw JWT payload so resolution uses the same shape: { userinfo: tokenClaims }.
4. desired = groupSync.resolveGroupKeysFromClaims(idProviderConfig, wrappedClaims)
5. runAsSu: groupSync.applyGroups(idProviderConfig, principalKey, desired)
6. Proceed with doLogin.
```

No userinfo endpoint is called during autoLogin; the JWT payload is the only source.

### 6.3 `resolveGroupKeysFromClaims`

```
1. path = idProviderConfig.groups.claim
2. If path contains ':' → use as a single literal key against claims.userinfo.
   Else → split on '.' and walk claims.userinfo.
3. Let raw = the value at that path.
4. Normalize raw to a string[]:
     - Array of strings → use as-is.
     - Single string → wrap as [raw] (some IdPs emit a single-value claim as a string).
     - null / undefined / missing → return [].
     - Anything else (object, number, etc.) → log debug only; return [].
       (Notably: Entra's overage indirection — an object containing `_claim_names`
       or `hasgroups` — lands here and is silently skipped. The Entra fork is
       responsible for detecting and resolving overage before reaching this point,
       per app-entra-idprovider#26. We do NOT log a warning for the bare object,
       to avoid noise in fork-managed deployments.)
5. For each entry v in raw:
     match = idProviderConfig.groups.mapping.find(m => m.value === v)
     if match → push match.group
6. Deduplicate and return.
```

Strict-equality match is intentional: it's predictable, easy to validate, and avoids the operational surprises of regex/wildcard matching. Filtering and pattern matching can be added later if a real customer needs them.

### 6.4 `applyGroups`

```
1. desired = Set of group keys passed in
2. mapped  = Set of ALL group keys defined in the mapping
   (i.e. the universe of groups this feature manages; used to scope revocation in sync mode)
3. For each key in desired:
      if group does not exist:
          if createGroups: authLib.createGroup({ idProvider, name: localPart(key),
                                                 displayName: localPart(key) })
          else: log.warning(`Group [${key}] does not exist; set groups.createGroups=true to auto-create`)
                continue
      authLib.addMembers(key, [userKey])    // idempotent in XP; safe to call unconditionally
4. If syncMode === 'sync':
      currentKeys = keys of authLib.getMemberships(userKey)
      toRevoke   = currentKeys ∩ mapped, minus desired
      For each key in toRevoke: authLib.removeMembers(key, [userKey])
5. Any per-group failure (createGroup / addMembers / removeMembers throws)
   → log.warning and continue with the next group.
   Never re-throw — group sync errors must not block login.
```

Notes:
- "Mapped groups" is the revocation scope in sync mode. A user's manually-assigned groups, `defaultGroups`, and groups managed outside this mapping are never touched. This is the contract that makes sync mode safe to enable.
- `localPart(key)` parses `group:<idp>:<name>` and returns `<name>`. Used as both the group's name (passed to `authLib.createGroup` as `name`) and as the initial displayName. Admins can rename the displayName afterwards through the XP admin UI.
- `authLib.getMemberships` returns Principal objects; the algorithm only needs their `.key` strings.

### 6.5 Configuration parsing (`configFile/configProvider.js`)

A new helper `extractIndexedSubkeyValue(rawConfig, basePropertyPath, subkeyPattern)` already exists conceptually as `extractPropertiesToArray` — reuse it with regex `^idprovider\.[a-zA-Z0-9_-]+\.groups\.mapping\.(\d+)\.(value|group)$`. Output is `[{ value: '...', group: '...' }]` for each index.

After parsing:

```javascript
const claimPath = rawIdProviderConfig[`${base}.groups.claim`] || null;
if (claimPath) {
    config.groups = {
        claim: claimPath,
        syncMode: rawIdProviderConfig[`${base}.groups.syncMode`] === 'sync' ? 'sync' : 'add',
        createGroups: defaultBooleanTrue(rawIdProviderConfig[`${base}.groups.createGroups`]),
        mapping: extractPropertiesToArray(rawIdProviderConfig, `${base}.groups.mapping.`, MAPPING_PATTERN)
            .filter(m => m && m.value != null && m.group != null),
    };
} else {
    config.groups = null;
}

config.autoLogin.applyGroups = rawIdProviderConfig[`${base}.autoLogin.applyGroups`] === 'true';
```

Validation:
- If `groups.claim` is set but `mapping` is empty after filtering → log warning ("groups.claim is configured but no valid mapping entries; feature has no effect"). Do not throw; allow boot.
- For each mapping entry: `value` and `group` must both be present and non-empty; `group` must start with `group:<idProviderName>:`. Invalid entries are dropped with a warning. Do not throw.
- Unrecognized `syncMode` values fall back to `add` with a warning.

The fail-soft philosophy matches the rest of this app: misconfigurations are surfaced in logs, not by refusing to start. This is consistent with `extractPropertiesToArray` already returning sparse arrays when indices are skipped.

## 7. Failure handling

| Situation | Behavior |
|---|---|
| `groups.claim` not configured | Feature off; no-op. |
| Claim path resolves to nothing | Log debug; treat as empty array. No memberships changed. |
| Claim path resolves to a non-array, non-string value | Log debug only; treat as empty. No memberships changed. |
| Entra "overage" structure (`_claim_names` or `hasgroups`) appears | Falls through the non-array branch → silent no-op (debug log only). Handled in app-entra-idprovider#26. |
| Mapping references a group that does not exist | `createGroups=true` → auto-create. `createGroups=false` → log warning and skip. |
| `authLib.addMembers` / `removeMembers` / `createGroup` throws | Log warning; continue with next group. Login is NOT blocked. |
| Mapping `group` key targets a different IDP | Rejected at config load (warning, entry dropped). |
| `applyGroups` is called from autoLogin but `autoLogin.applyGroups=false` | Never reached (gated earlier in `login.js`). |

## 8. Testing

Follow the existing test layout under `src/test/resources/`. Two new files:

### `src/test/resources/lib/groupSync-test.js`

Unit tests against a mocked `authLib`:

**`resolveGroupKeysFromClaims`:**
- Returns `[]` when `idProviderConfig.groups` is null.
- Returns `[]` when the configured path is missing in claims.
- Top-level claim, array of strings, with mapping → returns mapped keys.
- Top-level claim, single string (non-array) → treated as singleton.
- Nested dotted path `realm_access.roles` → resolves correctly.
- URI-shaped claim `https://app.example.com/groups` → used as a literal key.
- URN-shaped claim `urn:example:groups` → used as a literal key.
- Claim values not in mapping → silently dropped.
- Deduplicates duplicates in the claim array.
- Non-array, non-string value (e.g., an object resembling Entra overage) → returns `[]`; only a debug log, no warning.

**`applyGroups`:**
- `add` mode: adds user to desired groups not already a member.
- `add` mode: never revokes.
- `sync` mode: revokes memberships in MAPPED groups not in desired.
- `sync` mode: leaves memberships in non-mapped groups untouched.
- `createGroups=true`: missing group is created with the expected name and displayName.
- `createGroups=false`: missing group is skipped with warning; no other side effects.
- A throw inside `addMembers` for one group does not prevent processing other groups.
- A throw inside `createGroup` does not prevent processing other groups.

### Extension to `src/test/resources/lib/configFile/configIdProvider-test.js`

- Parses `groups.claim`, `groups.mapping.0.value`/`group`, `groups.syncMode`, `groups.createGroups` correctly.
- Parses `autoLogin.applyGroups`.
- `groups.claim` absent → `config.groups === null`.
- `groups.claim` present but no mappings → `config.groups.mapping === []` + warning logged.
- Mapping entry missing `value` or `group` → dropped + warning.
- Mapping entry with cross-IDP `group` → dropped + warning.
- Unknown `syncMode` value → falls back to `add` + warning.

No new integration tests required; the existing login-flow tests will be extended (where they cover `login.js`) to assert that `groupSync` is called with the expected arguments — using the existing mocking approach in `testUtils.js`.

## 9. Documentation

### `docs/config.adoc`

Add a new section `== Groups from claim`, placed between `== User mappings` and `== Additional endpoints`. The section covers:

- What the feature does and when it runs (every interactive login).
- The four new properties (`groups.claim`, `groups.mapping.<i>.value` / `.group`, `groups.syncMode`, `groups.createGroups`) with the same callout-numbered style used elsewhere in the file.
- A short subsection on choosing `claim` for the major providers (Okta, Entra, Auth0, Keycloak) — abbreviated versions of the examples in this spec.
- A subsection "Handling group rot" explaining the two options: `syncMode=add` plus periodic out-of-band cleanup, or `syncMode=sync` for OIDC-authoritative memberships. Calls out that sync mode only touches groups that appear in the mapping.

Add one new line under `== Autologin`:

```
autoLogin.applyGroups=(true|false, defaults to false)  // <N>
```

with a callout pointing to the `Groups from claim` section.

Append the new keys to `== All options`.

### `docs/examples.adoc`

Append two short examples: one Okta with the groups claim, one Entra with `syncMode=sync`.

## 10. Backwards compatibility & migration

- No existing `.cfg` files are affected. All new keys are optional and absent by default.
- `defaultGroups` behavior is unchanged.
- The new behavior is purely additive — no breaking changes.

For app-entra-idprovider:
- Their existing `.cfg` files do not have `groups.claim` → no behavior change.
- Their `lib/group.js` and call site in their `login.js` remain functional.
- When app-entra-idprovider#26 is implemented, they can migrate to upstream `groupSync` by:
  - Resolving the overage indirection via Graph to produce the full GUID list.
  - Substituting that list into the claims object at the configured path.
  - Letting `groupSync.applyGroups` handle the rest.

## 11. Open questions

None at this time. All decisions above were settled during brainstorming.

## 12. Summary of decisions

| Decision | Choice |
|---|---|
| Mapping shape | Two sub-keys per index: `mapping.<i>.value` and `mapping.<i>.group`. Matches existing `endSession.additionalParameters.<i>.key`/`.value` and `additionalEndpoints.<i>.name`/`.url` patterns. |
| Mapping role | Translate + allow-list. Values not in mapping are ignored. |
| Sync semantics | Configurable: `add` (default) or `sync`. `sync` only revokes memberships in mapped groups. |
| AutoLogin support | Configurable via new `autoLogin.applyGroups` key. Default off. |
| `defaultGroups` interaction | Unchanged. Stays creation-only. |
| Claim path syntax | Dotted path normally; URI/URN (claim contains `:`) treated as literal key. |
| Auto-create groups | Default on (`groups.createGroups=true`). |
| Failure mode | Fail-soft. Group sync errors log a warning; login never blocked. |
| Module name | `lib/groupSync.js` (avoids confusion with app-entra-idprovider's `lib/group.js`). |
| Entra overage | Out of scope. Tracked in app-entra-idprovider#26. |
