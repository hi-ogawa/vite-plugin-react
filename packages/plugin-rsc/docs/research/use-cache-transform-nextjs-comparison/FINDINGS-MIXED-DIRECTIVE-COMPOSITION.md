# Mixed-directive Composition

- Repo: git@github.com:vitejs/vite-plugin-react.git
- Commit: 31cdbb82219b6b637eee338a3492f735c78116bf
- Branch: main
- Next.js repo: git@github.com:vercel/next.js.git
- Next.js commit: 153bf8ac5fa00888ef5fbb2b65cac12f0942a44f
- Next.js branch: canary
- Reviewed: 2026-07-24

## Question

Does the current plugin-rsc `"use cache"` example need a Next.js-style shared traversal to support an exported inline `"use cache"` function inside a module-level `"use server"` file, or can the existing independent transforms compose safely?

The representative source shape is used in [the-platform-press `app/[locale]/category/actions.ts`](https://github.com/vercel-partner-solutions/the-platform-press/blob/0fdee98ad98766f36baf948a48d0df5705b27811/app/%5Blocale%5D/category/actions.ts#L1-L35):

```js
'use server'

export async function cached(value) {
  'use cache'
  return value
}

export async function action(value) {
  return value
}
```

This investigation concerns the current server-local cache example. It does not evaluate richer transform APIs proposed elsewhere or require cached functions to become independently addressable Server References.

## Conclusion

The supported representative case does not require a shared traversal.

The current transforms compose correctly when the cache hoister runs before the built-in server transform, which is already the example's configured order. The cache transform first replaces the exported cached function with an exported cache-wrapped binding and keeps its hoisted implementation private through `noExport`. The built-in module-level `"use server"` transform then registers that cache-wrapped binding as the exported Server Reference.

The reverse RSC order is unsound. The server transform first schedules reassignment of the exported function, while the later cache transform replaces the function declaration with a `const`. The resulting code parses but attempts to reassign that `const` at module evaluation.

The minimum contract is therefore:

> A server-local inline cache transform that rewrites an exported function binding must run before plugin-rsc's module-level `"use server"` server transform.

A shared traversal would become relevant if plugin-rsc wanted symmetric module-level `"use cache"` semantics, per-function role overrides owned by one transform, or unified legality validation. Those are not requirements of the current example.

## Next.js One-pass Baseline

Next.js handles actions and cache functions in one `server_actions` visitor. It first records and removes the module directive in [`get_directive_for_module`](https://github.com/vercel/next.js/blob/153bf8ac5fa00888ef5fbb2b65cac12f0942a44f/crates/next-custom-transforms/src/transforms/server_actions.rs#L453-L475), then pre-collects exports and performs one main statement pass in [`visit_mut_module_items`](https://github.com/vercel/next.js/blob/153bf8ac5fa00888ef5fbb2b65cac12f0942a44f/crates/next-custom-transforms/src/transforms/server_actions.rs#L1741-L1755).

For each function, an inline directive takes precedence. Only an exported function without its own directive inherits the file directive in [`get_directive_for_function`](https://github.com/vercel/next.js/blob/153bf8ac5fa00888ef5fbb2b65cac12f0942a44f/crates/next-custom-transforms/src/transforms/server_actions.rs#L413-L450).

Consequently:

- A `"use server"` file may contain an inline `"use cache"` function. [Fixture 37](https://github.com/vercel/next.js/blob/153bf8ac5fa00888ef5fbb2b65cac12f0942a44f/crates/next-custom-transforms/tests/fixture/server-actions/server-graph/37/input.js) covers a local cached function, while [fixture 48](https://github.com/vercel/next.js/blob/153bf8ac5fa00888ef5fbb2b65cac12f0942a44f/crates/next-custom-transforms/tests/fixture/server-actions/server-graph/48/input.js#L1-L45) covers an exported cached override among ordinary action exports.
- A default export may similarly override a `"use server"` file with inline `"use cache"`, as shown by [fixture 49](https://github.com/vercel/next.js/blob/153bf8ac5fa00888ef5fbb2b65cac12f0942a44f/crates/next-custom-transforms/tests/fixture/server-actions/server-graph/49/input.js).
- The reverse is legal. Inline `"use server"` functions override a module-level `"use cache"` role in [fixture 51](https://github.com/vercel/next.js/blob/153bf8ac5fa00888ef5fbb2b65cac12f0942a44f/crates/next-custom-transforms/tests/fixture/server-actions/server-graph/51/input.js).
- Both directives in one directive prologue are rejected by the shared [`DirectiveVisitor`](https://github.com/vercel/next.js/blob/153bf8ac5fa00888ef5fbb2b65cac12f0942a44f/crates/next-custom-transforms/src/transforms/server_actions.rs#L3418-L3490).

For the representative exported override, the normalized output is:

```js
const H = async function cached(value) {
  return value
}

export var CACHE_REF = React.cache(function cached() {
  return cache(
    'default',
    CACHE_ID,
    0,
    H,
    Array.prototype.slice.call(arguments, 0, 1),
  )
})
registerServerReference(CACHE_REF, CACHE_ID, null)

export var cached = CACHE_REF

export async function action(value) {
  return value
}
registerServerReference(action, ACTION_ID, null)
```

The cache override is classified before the action-file post-pass. It is removed from ordinary action-export registration and replaced by the cache wrapper and cache reference, as the exact [fixture 48 output](https://github.com/vercel/next.js/blob/153bf8ac5fa00888ef5fbb2b65cac12f0942a44f/crates/next-custom-transforms/tests/fixture/server-actions/server-graph/48/output.js#L27-L50) demonstrates.

## Current Vite Pipeline

The example installs `vitePluginUseCache()` before `rsc()` in [examples/use-cache/vite.config.ts](https://github.com/vitejs/vite-plugin-react/blob/31cdbb82219b6b637eee338a3492f735c78116bf/packages/plugin-rsc/examples/use-cache/vite.config.ts#L6-L18).

The cache plugin applies `transformHoistInlineDirective` with `noExport: true` in [vite.config.ts](https://github.com/vitejs/vite-plugin-react/blob/31cdbb82219b6b637eee338a3492f735c78116bf/packages/plugin-rsc/examples/use-cache/vite.config.ts#L20-L44). The hoister moves the implementation, creates the cache-wrapped replacement at the original declaration site, and leaves the generated implementation unexported in [`hoist.ts`](https://github.com/vitejs/vite-plugin-react/blob/31cdbb82219b6b637eee338a3492f735c78116bf/packages/plugin-rsc/src/transforms/hoist.ts#L94-L130).

The built-in server transform chooses `transformWrapExport` for any module containing a top-level `"use server"` directive in [`server-action.ts`](https://github.com/vitejs/vite-plugin-react/blob/31cdbb82219b6b637eee338a3492f735c78116bf/packages/plugin-rsc/src/transforms/server-action.ts#L30-L39).

These transforms do not share directive state. Their composition is determined by generated JavaScript bindings and plugin order.

## Focused Order Comparison

### Cache then server

Normalized RSC output:

```js
'use server'

let cached = CACHE(H)

async function action(value) {
  return value
}

async function H(value) {
  'use cache'
  return value
}

cached = SERVER(cached, 'cached')
export { cached }

action = SERVER(action, 'action')
export { action }
```

This order is valid. The cache transform emits the exported `cached` replacement first. The subsequent export wrapper changes an exported `const` declaration to `let` before appending its registration assignment in [`wrap-export.ts`](https://github.com/vitejs/vite-plugin-react/blob/31cdbb82219b6b637eee338a3492f735c78116bf/packages/plugin-rsc/src/transforms/wrap-export.ts#L137-L168).

The final exported and registered value is `CACHE(H)`, so a Server Function invocation reaches the cache wrapper. `H` remains module-private because the example selected `noExport: true`.

### Server then cache

Normalized RSC output:

```js
'use server'

const cached = CACHE(H)

async function action(value) {
  return value
}

cached = SERVER(cached, 'cached')
export { cached }

action = SERVER(action, 'action')
export { action }

async function H(value) {
  'use cache'
  return value
}
```

This output is syntactically valid but fails during module evaluation because `cached = SERVER(...)` reassigns the `const cached` introduced by the later cache transform.

The earliest failure is not hidden directive information. `transformWrapExport` preserves the function body, so the second transform still finds `"use cache"`. The failure is an unstated generated-binding contract: the first transform assumes its target remains reassignable, while the second transform changes the declaration form after that assumption was encoded.

### Client and SSR proxy layers

For a module-level `"use server"` file, both orders reduce the representative exports to the same proxies:

```js
export const cached = PROXY('cached')
export const action = PROXY('action')
```

When cache hoisting runs first, the built-in proxy transform removes the generated implementation and other non-export nodes. When proxying runs first, it removes the original function bodies, so the later cache transform has no inline directive left to process. The removal behavior is explicit in [`proxy-export.ts`](https://github.com/vitejs/vite-plugin-react/blob/31cdbb82219b6b637eee338a3492f735c78116bf/packages/plugin-rsc/src/transforms/proxy-export.ts#L147-L153).

Thus the material order constraint is in the RSC implementation transform, not the proxy output.

## Fixture Matrix

| Source shape                                                | Next.js                                    | Current Vite cache-before-server                                 | Current Vite server-before-cache                                    |
| ----------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `"use server"` file, exported inline `"use cache"` function | Cache role overrides inherited action role | Works; exported Server Reference targets `CACHE(H)`              | Parses but reassigns a generated `const`                            |
| `"use server"` file, ordinary exported function             | Registered as action                       | Registered as action                                             | Registered as action                                                |
| `"use server"` file, local inline `"use cache"` helper      | One traversal hoists cache helper          | Cache hoister runs before export wrapping; no ownership conflict | Directive remains discoverable, but reverse order offers no benefit |
| `"use cache"` file, inline `"use server"` function          | Action role overrides inherited cache role | Not modeled by the current example plugin                        | Not modeled by the current example plugin                           |
| Both directives in one function prologue                    | Rejected                                   | No shared multiple-role validation                               | No shared multiple-role validation                                  |

## Capability And Failure Classification

| Concern                                                     | Result                                                | Classification                             |
| ----------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------ |
| Preserve inline cache directive for the representative case | Both RSC orders preserve enough source to discover it | No shared traversal required               |
| Register the cache-wrapped source export                    | Correct with cache-before-server                      | Existing transforms plus ordering contract |
| Keep raw cache implementation private                       | Correct through `noExport: true`                      | Existing cache integration choice          |
| Reverse transform order                                     | Generated `const` is reassigned                       | Composition-contract failure               |
| Symmetric file-level cache/action overrides                 | Supported by Next.js, absent from current demo model  | Outside current example scope              |
| Reject conflicting directives in one prologue               | Centralized in Next.js, not coordinated in Vite       | Validation follow-up                       |

## Recommendation

Preserve the independent transforms and document/enforce their ordering for this server-local example. Do not introduce a shared action/cache traversal based on the representative mixed-directive case alone.

The smallest useful hardening is for the example cache plugin to make its dependency on `rsc:use-server` ordering explicit rather than relying only on array placement. If this composition becomes supported API rather than example code, the contract should state that a transform replacing exported function bindings must run before the built-in server implementation transform.

Do not generalize this conclusion to a future module-level `"use cache"` implementation. A transform that wants Next.js's symmetric file-role inheritance, inline role overrides, and shared conflict validation may benefit from one role-aware traversal or a directive-neutral intermediate representation. That is a larger semantic target than the current generic hoist-and-wrap demo.

## Verification

The Next.js conclusions use the pinned transform source and committed server-action fixtures listed above.

The Vite order comparison used a temporary focused transform test against commit `31cdbb82219b6b637eee338a3492f735c78116bf`. It applied the current example's `transformHoistInlineDirective({ noExport: true })`, the built-in `transformServerActionServer`, and the built-in proxy transform in both orders. All four outputs parsed; the reverse RSC output contained the demonstrated `const` reassignment. The temporary test was removed after inspection, and no implementation or test files remain modified.

Cache storage, result serialization, replay, invalidation, custom handlers, PR #1246, and cross-environment cache Server Reference design were not evaluated.
