(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[turbopack]/browser/dev/hmr-client/hmr-client.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/// <reference path="../../../shared/runtime-types.d.ts" />
/// <reference path="../../runtime/base/dev-globals.d.ts" />
/// <reference path="../../runtime/base/dev-protocol.d.ts" />
/// <reference path="../../runtime/base/dev-extensions.ts" />
__turbopack_context__.s([
    "connect",
    ()=>connect,
    "setHooks",
    ()=>setHooks,
    "subscribeToUpdate",
    ()=>subscribeToUpdate
]);
function connect({ addMessageListener, sendMessage, onUpdateError = console.error }) {
    addMessageListener((msg)=>{
        switch(msg.type){
            case 'turbopack-connected':
                handleSocketConnected(sendMessage);
                break;
            default:
                try {
                    if (Array.isArray(msg.data)) {
                        for(let i = 0; i < msg.data.length; i++){
                            handleSocketMessage(msg.data[i]);
                        }
                    } else {
                        handleSocketMessage(msg.data);
                    }
                    applyAggregatedUpdates();
                } catch (e) {
                    console.warn('[Fast Refresh] performing full reload\n\n' + "Fast Refresh will perform a full reload when you edit a file that's imported by modules outside of the React rendering tree.\n" + 'You might have a file which exports a React component but also exports a value that is imported by a non-React component file.\n' + 'Consider migrating the non-React component export to a separate file and importing it into both files.\n\n' + 'It is also possible the parent component of the component you edited is a class component, which disables Fast Refresh.\n' + 'Fast Refresh requires at least one parent function component in your React tree.');
                    onUpdateError(e);
                    location.reload();
                }
                break;
        }
    });
    const queued = globalThis.TURBOPACK_CHUNK_UPDATE_LISTENERS;
    if (queued != null && !Array.isArray(queued)) {
        throw new Error('A separate HMR handler was already registered');
    }
    globalThis.TURBOPACK_CHUNK_UPDATE_LISTENERS = {
        push: ([chunkPath, callback])=>{
            subscribeToChunkUpdate(chunkPath, sendMessage, callback);
        }
    };
    if (Array.isArray(queued)) {
        for (const [chunkPath, callback] of queued){
            subscribeToChunkUpdate(chunkPath, sendMessage, callback);
        }
    }
}
const updateCallbackSets = new Map();
function sendJSON(sendMessage, message) {
    sendMessage(JSON.stringify(message));
}
function resourceKey(resource) {
    return JSON.stringify({
        path: resource.path,
        headers: resource.headers || null
    });
}
function subscribeToUpdates(sendMessage, resource) {
    sendJSON(sendMessage, {
        type: 'turbopack-subscribe',
        ...resource
    });
    return ()=>{
        sendJSON(sendMessage, {
            type: 'turbopack-unsubscribe',
            ...resource
        });
    };
}
function handleSocketConnected(sendMessage) {
    for (const key of updateCallbackSets.keys()){
        subscribeToUpdates(sendMessage, JSON.parse(key));
    }
}
// we aggregate all pending updates until the issues are resolved
const chunkListsWithPendingUpdates = new Map();
function aggregateUpdates(msg) {
    const key = resourceKey(msg.resource);
    let aggregated = chunkListsWithPendingUpdates.get(key);
    if (aggregated) {
        aggregated.instruction = mergeChunkListUpdates(aggregated.instruction, msg.instruction);
    } else {
        chunkListsWithPendingUpdates.set(key, msg);
    }
}
function applyAggregatedUpdates() {
    if (chunkListsWithPendingUpdates.size === 0) return;
    hooks.beforeRefresh();
    for (const msg of chunkListsWithPendingUpdates.values()){
        triggerUpdate(msg);
    }
    chunkListsWithPendingUpdates.clear();
    finalizeUpdate();
}
function mergeChunkListUpdates(updateA, updateB) {
    let chunks;
    if (updateA.chunks != null) {
        if (updateB.chunks == null) {
            chunks = updateA.chunks;
        } else {
            chunks = mergeChunkListChunks(updateA.chunks, updateB.chunks);
        }
    } else if (updateB.chunks != null) {
        chunks = updateB.chunks;
    }
    let merged;
    if (updateA.merged != null) {
        if (updateB.merged == null) {
            merged = updateA.merged;
        } else {
            // Since `merged` is an array of updates, we need to merge them all into
            // one, consistent update.
            // Since there can only be `EcmascriptMergeUpdates` in the array, there is
            // no need to key on the `type` field.
            let update = updateA.merged[0];
            for(let i = 1; i < updateA.merged.length; i++){
                update = mergeChunkListEcmascriptMergedUpdates(update, updateA.merged[i]);
            }
            for(let i = 0; i < updateB.merged.length; i++){
                update = mergeChunkListEcmascriptMergedUpdates(update, updateB.merged[i]);
            }
            merged = [
                update
            ];
        }
    } else if (updateB.merged != null) {
        merged = updateB.merged;
    }
    return {
        type: 'ChunkListUpdate',
        chunks,
        merged
    };
}
function mergeChunkListChunks(chunksA, chunksB) {
    const chunks = {};
    for (const [chunkPath, chunkUpdateA] of Object.entries(chunksA)){
        const chunkUpdateB = chunksB[chunkPath];
        if (chunkUpdateB != null) {
            const mergedUpdate = mergeChunkUpdates(chunkUpdateA, chunkUpdateB);
            if (mergedUpdate != null) {
                chunks[chunkPath] = mergedUpdate;
            }
        } else {
            chunks[chunkPath] = chunkUpdateA;
        }
    }
    for (const [chunkPath, chunkUpdateB] of Object.entries(chunksB)){
        if (chunks[chunkPath] == null) {
            chunks[chunkPath] = chunkUpdateB;
        }
    }
    return chunks;
}
function mergeChunkUpdates(updateA, updateB) {
    if (updateA.type === 'added' && updateB.type === 'deleted' || updateA.type === 'deleted' && updateB.type === 'added') {
        return undefined;
    }
    if (updateA.type === 'partial') {
        invariant(updateA.instruction, 'Partial updates are unsupported');
    }
    if (updateB.type === 'partial') {
        invariant(updateB.instruction, 'Partial updates are unsupported');
    }
    return undefined;
}
function mergeChunkListEcmascriptMergedUpdates(mergedA, mergedB) {
    const entries = mergeEcmascriptChunkEntries(mergedA.entries, mergedB.entries);
    const chunks = mergeEcmascriptChunksUpdates(mergedA.chunks, mergedB.chunks);
    return {
        type: 'EcmascriptMergedUpdate',
        entries,
        chunks
    };
}
function mergeEcmascriptChunkEntries(entriesA, entriesB) {
    return {
        ...entriesA,
        ...entriesB
    };
}
function mergeEcmascriptChunksUpdates(chunksA, chunksB) {
    if (chunksA == null) {
        return chunksB;
    }
    if (chunksB == null) {
        return chunksA;
    }
    const chunks = {};
    for (const [chunkPath, chunkUpdateA] of Object.entries(chunksA)){
        const chunkUpdateB = chunksB[chunkPath];
        if (chunkUpdateB != null) {
            const mergedUpdate = mergeEcmascriptChunkUpdates(chunkUpdateA, chunkUpdateB);
            if (mergedUpdate != null) {
                chunks[chunkPath] = mergedUpdate;
            }
        } else {
            chunks[chunkPath] = chunkUpdateA;
        }
    }
    for (const [chunkPath, chunkUpdateB] of Object.entries(chunksB)){
        if (chunks[chunkPath] == null) {
            chunks[chunkPath] = chunkUpdateB;
        }
    }
    if (Object.keys(chunks).length === 0) {
        return undefined;
    }
    return chunks;
}
function mergeEcmascriptChunkUpdates(updateA, updateB) {
    if (updateA.type === 'added' && updateB.type === 'deleted') {
        // These two completely cancel each other out.
        return undefined;
    }
    if (updateA.type === 'deleted' && updateB.type === 'added') {
        const added = [];
        const deleted = [];
        const deletedModules = new Set(updateA.modules ?? []);
        const addedModules = new Set(updateB.modules ?? []);
        for (const moduleId of addedModules){
            if (!deletedModules.has(moduleId)) {
                added.push(moduleId);
            }
        }
        for (const moduleId of deletedModules){
            if (!addedModules.has(moduleId)) {
                deleted.push(moduleId);
            }
        }
        if (added.length === 0 && deleted.length === 0) {
            return undefined;
        }
        return {
            type: 'partial',
            added,
            deleted
        };
    }
    if (updateA.type === 'partial' && updateB.type === 'partial') {
        const added = new Set([
            ...updateA.added ?? [],
            ...updateB.added ?? []
        ]);
        const deleted = new Set([
            ...updateA.deleted ?? [],
            ...updateB.deleted ?? []
        ]);
        if (updateB.added != null) {
            for (const moduleId of updateB.added){
                deleted.delete(moduleId);
            }
        }
        if (updateB.deleted != null) {
            for (const moduleId of updateB.deleted){
                added.delete(moduleId);
            }
        }
        return {
            type: 'partial',
            added: [
                ...added
            ],
            deleted: [
                ...deleted
            ]
        };
    }
    if (updateA.type === 'added' && updateB.type === 'partial') {
        const modules = new Set([
            ...updateA.modules ?? [],
            ...updateB.added ?? []
        ]);
        for (const moduleId of updateB.deleted ?? []){
            modules.delete(moduleId);
        }
        return {
            type: 'added',
            modules: [
                ...modules
            ]
        };
    }
    if (updateA.type === 'partial' && updateB.type === 'deleted') {
        // We could eagerly return `updateB` here, but this would potentially be
        // incorrect if `updateA` has added modules.
        const modules = new Set(updateB.modules ?? []);
        if (updateA.added != null) {
            for (const moduleId of updateA.added){
                modules.delete(moduleId);
            }
        }
        return {
            type: 'deleted',
            modules: [
                ...modules
            ]
        };
    }
    // Any other update combination is invalid.
    return undefined;
}
function invariant(_, message) {
    throw new Error(`Invariant: ${message}`);
}
const CRITICAL = [
    'bug',
    'error',
    'fatal'
];
function compareByList(list, a, b) {
    const aI = list.indexOf(a) + 1 || list.length;
    const bI = list.indexOf(b) + 1 || list.length;
    return aI - bI;
}
const chunksWithIssues = new Map();
function emitIssues() {
    const issues = [];
    const deduplicationSet = new Set();
    for (const [_, chunkIssues] of chunksWithIssues){
        for (const chunkIssue of chunkIssues){
            if (deduplicationSet.has(chunkIssue.formatted)) continue;
            issues.push(chunkIssue);
            deduplicationSet.add(chunkIssue.formatted);
        }
    }
    sortIssues(issues);
    hooks.issues(issues);
}
function handleIssues(msg) {
    const key = resourceKey(msg.resource);
    let hasCriticalIssues = false;
    for (const issue of msg.issues){
        if (CRITICAL.includes(issue.severity)) {
            hasCriticalIssues = true;
        }
    }
    if (msg.issues.length > 0) {
        chunksWithIssues.set(key, msg.issues);
    } else if (chunksWithIssues.has(key)) {
        chunksWithIssues.delete(key);
    }
    emitIssues();
    return hasCriticalIssues;
}
const SEVERITY_ORDER = [
    'bug',
    'fatal',
    'error',
    'warning',
    'info',
    'log'
];
const CATEGORY_ORDER = [
    'parse',
    'resolve',
    'code generation',
    'rendering',
    'typescript',
    'other'
];
function sortIssues(issues) {
    issues.sort((a, b)=>{
        const first = compareByList(SEVERITY_ORDER, a.severity, b.severity);
        if (first !== 0) return first;
        return compareByList(CATEGORY_ORDER, a.category, b.category);
    });
}
const hooks = {
    beforeRefresh: ()=>{},
    refresh: ()=>{},
    buildOk: ()=>{},
    issues: (_issues)=>{}
};
function setHooks(newHooks) {
    Object.assign(hooks, newHooks);
}
function handleSocketMessage(msg) {
    sortIssues(msg.issues);
    handleIssues(msg);
    switch(msg.type){
        case 'issues':
            break;
        case 'partial':
            // aggregate updates
            aggregateUpdates(msg);
            break;
        default:
            // run single update
            const runHooks = chunkListsWithPendingUpdates.size === 0;
            if (runHooks) hooks.beforeRefresh();
            triggerUpdate(msg);
            if (runHooks) finalizeUpdate();
            break;
    }
}
function finalizeUpdate() {
    hooks.refresh();
    hooks.buildOk();
    // This is used by the Next.js integration test suite to notify it when HMR
    // updates have been completed.
    // TODO: Only run this in test environments (gate by `process.env.__NEXT_TEST_MODE`)
    if (globalThis.__NEXT_HMR_CB) {
        globalThis.__NEXT_HMR_CB();
        globalThis.__NEXT_HMR_CB = null;
    }
}
function subscribeToChunkUpdate(chunkListPath, sendMessage, callback) {
    return subscribeToUpdate({
        path: chunkListPath
    }, sendMessage, callback);
}
function subscribeToUpdate(resource, sendMessage, callback) {
    const key = resourceKey(resource);
    let callbackSet;
    const existingCallbackSet = updateCallbackSets.get(key);
    if (!existingCallbackSet) {
        callbackSet = {
            callbacks: new Set([
                callback
            ]),
            unsubscribe: subscribeToUpdates(sendMessage, resource)
        };
        updateCallbackSets.set(key, callbackSet);
    } else {
        existingCallbackSet.callbacks.add(callback);
        callbackSet = existingCallbackSet;
    }
    return ()=>{
        callbackSet.callbacks.delete(callback);
        if (callbackSet.callbacks.size === 0) {
            callbackSet.unsubscribe();
            updateCallbackSets.delete(key);
        }
    };
}
function triggerUpdate(msg) {
    const key = resourceKey(msg.resource);
    const callbackSet = updateCallbackSets.get(key);
    if (!callbackSet) {
        return;
    }
    for (const callback of callbackSet.callbacks){
        callback(msg);
    }
    if (msg.type === 'notFound') {
        // This indicates that the resource which we subscribed to either does not exist or
        // has been deleted. In either case, we should clear all update callbacks, so if a
        // new subscription is created for the same resource, it will send a new "subscribe"
        // message to the server.
        // No need to send an "unsubscribe" message to the server, it will have already
        // dropped the update stream before sending the "notFound" message.
        updateCallbackSets.delete(key);
    }
}
}),
"[project]/frontend/src/lib/supabase.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "STORAGE_BUCKETS",
    ()=>STORAGE_BUCKETS,
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/frontend/node_modules/next/dist/build/polyfills/process.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$module$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/@supabase/supabase-js/dist/module/index.js [client] (ecmascript) <locals>");
;
const supabaseUrl = ("TURBOPACK compile-time value", "https://ehwejkvlreyokfarjjeu.supabase.co") || __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"].env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVod2Vqa3ZscmV5b2tmYXJqamV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDU5ODgsImV4cCI6MjA3NzQyMTk4OH0.4WefvIpkIlpe9tczAEnqADMIY5_pvQKOiuUs4EqybQg") || __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"].env.REACT_APP_SUPABASE_ANON_KEY;
if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$module$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});
const STORAGE_BUCKETS = {
    MEDICAL_DOCUMENTS: 'medical-documents'
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/components/admin/AdminLayout.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$link$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/link.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/router.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/supabase.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layout$2d$dashboard$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LayoutDashboard$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/layout-dashboard.js [client] (ecmascript) <export default as LayoutDashboard>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/file-text.js [client] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$briefcase$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Briefcase$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/briefcase.js [client] (ecmascript) <export default as Briefcase>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/message-square.js [client] (ecmascript) <export default as MessageSquare>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$log$2d$out$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LogOut$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/log-out.js [client] (ecmascript) <export default as LogOut>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/menu.js [client] (ecmascript) <export default as Menu>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/x.js [client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clipboard$2d$list$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ClipboardList$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/clipboard-list.js [client] (ecmascript) <export default as ClipboardList>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/users.js [client] (ecmascript) <export default as Users>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$help$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__HelpCircle$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/circle-help.js [client] (ecmascript) <export default as HelpCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/book-open.js [client] (ecmascript) <export default as BookOpen>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$activity$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Activity$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/activity.js [client] (ecmascript) <export default as Activity>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/sonner/dist/index.mjs [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/index.js [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
;
const AdminLayout = ({ children })=>{
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [mobileMenuOpen, setMobileMenuOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isSuperAdmin, setIsSuperAdmin] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AdminLayout.useEffect": ()=>{
            checkUserRole();
        }
    }["AdminLayout.useEffect"], []);
    const checkUserRole = async ()=>{
        try {
            const { data: { user } } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].auth.getUser();
            if (!user) return;
            const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('admin_users').select('role').eq('id', user.id).maybeSingle(); // Use maybeSingle instead of single to avoid errors
            // Ignore errors - user might not be in admin_users table yet
            if (data && data.role === 'super_admin') {
                setIsSuperAdmin(true);
            }
        } catch (error) {
            // Silently fail - user just won't see Admin Users link
            console.log('Admin users table not accessible yet');
        }
    };
    const handleLogout = async ()=>{
        try {
            await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].auth.signOut();
            __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].success('Logged out successfully');
            router.push('/admin/login');
        } catch (error) {
            console.error('Logout error:', error);
            __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error('Logout failed');
        }
    };
    const navigation = [
        {
            name: 'Dashboard',
            href: '/admin/dashboard',
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layout$2d$dashboard$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LayoutDashboard$3e$__["LayoutDashboard"]
        },
        {
            name: 'Contacts',
            href: '/admin/contacts',
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__["MessageSquare"]
        },
        {
            name: 'Form Submissions',
            href: '/admin/form-submissions',
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clipboard$2d$list$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ClipboardList$3e$__["ClipboardList"]
        },
        {
            name: 'Diagnostics',
            href: '/admin/diagnostics',
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$activity$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Activity$3e$__["Activity"]
        },
        {
            name: 'Services',
            href: '/admin/services',
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$briefcase$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Briefcase$3e$__["Briefcase"]
        },
        {
            name: 'Case Studies',
            href: '/admin/case-studies',
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__["BookOpen"]
        },
        {
            name: 'Blog Posts',
            href: '/admin/blog',
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"]
        },
        {
            name: 'Community Q&A',
            href: '/admin/community',
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$help$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__HelpCircle$3e$__["HelpCircle"]
        },
        ...isSuperAdmin ? [
            {
                name: 'Admin Users',
                href: '/admin/users',
                icon: __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__["Users"]
            }
        ] : []
    ];
    const isActive = (path)=>router.pathname === path;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen bg-slate-50",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col flex-grow bg-indigo-700 overflow-y-auto",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center flex-shrink-0 px-4 py-6",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                className: "text-2xl font-bold text-white",
                                children: "Admin Panel"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                                lineNumber: 82,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                            lineNumber: 81,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                            className: "flex-1 px-2 pb-4 space-y-1",
                            children: navigation.map((item)=>{
                                const Icon = item.icon;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$link$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: item.href,
                                    className: `group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors ${isActive(item.href) ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-600 hover:text-white'}`,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                                            className: "mr-3 h-5 w-5"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                                            lineNumber: 96,
                                            columnNumber: 19
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        item.name
                                    ]
                                }, item.name, true, {
                                    fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                                    lineNumber: 88,
                                    columnNumber: 17
                                }, ("TURBOPACK compile-time value", void 0));
                            })
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                            lineNumber: 84,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-shrink-0 flex border-t border-indigo-800 p-4",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: handleLogout,
                                className: "flex-shrink-0 w-full group flex items-center px-3 py-3 text-sm font-medium text-indigo-100 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$log$2d$out$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LogOut$3e$__["LogOut"], {
                                        className: "mr-3 h-5 w-5"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                                        lineNumber: 107,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    "Logout"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                                lineNumber: 103,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                            lineNumber: 102,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                    lineNumber: 80,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                lineNumber: 79,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "md:hidden fixed top-0 left-0 right-0 bg-indigo-700 z-40",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between px-4 py-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            className: "text-xl font-bold text-white",
                            children: "Admin Panel"
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                            lineNumber: 117,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>setMobileMenuOpen(!mobileMenuOpen),
                            className: "text-white",
                            children: mobileMenuOpen ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                className: "h-6 w-6"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                                lineNumber: 122,
                                columnNumber: 31
                            }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__["Menu"], {
                                className: "h-6 w-6"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                                lineNumber: 122,
                                columnNumber: 59
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                            lineNumber: 118,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                    lineNumber: 116,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                lineNumber: 115,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            mobileMenuOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "md:hidden fixed inset-0 z-30 bg-indigo-700 pt-16",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                    className: "px-2 pb-4 space-y-1",
                    children: [
                        navigation.map((item)=>{
                            const Icon = item.icon;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$link$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                                href: item.href,
                                onClick: ()=>setMobileMenuOpen(false),
                                className: `group flex items-center px-3 py-3 text-sm font-medium rounded-lg ${isActive(item.href) ? 'bg-indigo-800 text-white' : 'text-indigo-100 hover:bg-indigo-600 hover:text-white'}`,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                                        className: "mr-3 h-5 w-5"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                                        lineNumber: 143,
                                        columnNumber: 19
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    item.name
                                ]
                            }, item.name, true, {
                                fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                                lineNumber: 134,
                                columnNumber: 17
                            }, ("TURBOPACK compile-time value", void 0));
                        }),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: handleLogout,
                            className: "w-full flex items-center px-3 py-3 text-sm font-medium text-indigo-100 rounded-lg hover:bg-indigo-600 hover:text-white",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$log$2d$out$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LogOut$3e$__["LogOut"], {
                                    className: "mr-3 h-5 w-5"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                                    lineNumber: 152,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                "Logout"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                            lineNumber: 148,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                    lineNumber: 130,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                lineNumber: 129,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "md:pl-64 flex flex-col flex-1",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                    className: "flex-1 pt-16 md:pt-0",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "py-6",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "max-w-7xl mx-auto px-4 sm:px-6 md:px-8",
                            children: children
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                            lineNumber: 163,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                        lineNumber: 162,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                }, void 0, false, {
                    fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                    lineNumber: 161,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
                lineNumber: 160,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/components/admin/AdminLayout.js",
        lineNumber: 77,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(AdminLayout, "xPIBknHCYERWJ0mKroTYteOnXj8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = AdminLayout;
const __TURBOPACK__default__export__ = AdminLayout;
var _c;
__turbopack_context__.k.register(_c, "AdminLayout");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/components/admin/ProtectedRoute.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/router.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/supabase.js [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
const ProtectedRoute = ({ children })=>{
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ProtectedRoute.useEffect": ()=>{
            // Check current session
            const checkSession = {
                "ProtectedRoute.useEffect.checkSession": async ()=>{
                    const { data: { session } } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].auth.getSession();
                    const currentUser = session?.user ?? null;
                    setUser(currentUser);
                    setLoading(false);
                    if (!currentUser) {
                        router.replace('/admin/login');
                    }
                }
            }["ProtectedRoute.useEffect.checkSession"];
            checkSession();
            // Listen for auth changes
            const { data: { subscription } } = __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].auth.onAuthStateChange({
                "ProtectedRoute.useEffect": (_event, session)=>{
                    const currentUser = session?.user ?? null;
                    setUser(currentUser);
                    if (!currentUser && !loading) {
                        router.replace('/admin/login');
                    }
                }
            }["ProtectedRoute.useEffect"]);
            return ({
                "ProtectedRoute.useEffect": ()=>subscription.unsubscribe()
            })["ProtectedRoute.useEffect"];
        }
    }["ProtectedRoute.useEffect"], [
        router,
        loading
    ]);
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "min-h-screen flex items-center justify-center",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/admin/ProtectedRoute.js",
                lineNumber: 40,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/frontend/src/components/admin/ProtectedRoute.js",
            lineNumber: 39,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    }
    if (!user) {
        return null; // or a loading spinner while redirecting
    }
    return children;
};
_s(ProtectedRoute, "8ZNwZiIFW44agV5SnSYwOiBYxdY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = ProtectedRoute;
const __TURBOPACK__default__export__ = ProtectedRoute;
var _c;
__turbopack_context__.k.register(_c, "ProtectedRoute");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/lib/formDataParser.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Form Data Parser Utility
 * Handles parsing and formatting of form submission data
 */ /**
 * Detects if a string is JSON or plain text
 * @param {string} data - The data to check
 * @returns {boolean} - True if data is valid JSON
 */ __turbopack_context__.s([
    "formatFieldValue",
    ()=>formatFieldValue,
    "groupFieldsIntoSections",
    ()=>groupFieldsIntoSections,
    "isJSON",
    ()=>isJSON,
    "parseFormData",
    ()=>parseFormData,
    "safeJSONParse",
    ()=>safeJSONParse,
    "toTitleCase",
    ()=>toTitleCase
]);
const isJSON = (data)=>{
    if (typeof data !== 'string') return false;
    try {
        const parsed = JSON.parse(data);
        return typeof parsed === 'object' && parsed !== null;
    } catch (e) {
        return false;
    }
};
const safeJSONParse = (data)=>{
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error('JSON parsing error:', e);
        return null;
    }
};
const formatFieldValue = (key, value)=>{
    // Handle empty/null values
    if (value === null || value === undefined || value === '') {
        return 'Not provided';
    }
    // Handle boolean values
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    // Handle arrays
    if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : 'Not provided';
    }
    // Handle objects (nested data)
    if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
    }
    // Handle date fields
    if (key.toLowerCase().includes('date') || key.toLowerCase().includes('dob')) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }
    // Handle phone numbers
    if (key.toLowerCase().includes('phone')) {
        const cleaned = value.toString().replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
    }
    // Handle SSN (mask for privacy)
    if (key.toLowerCase().includes('ssn')) {
        const cleaned = value.toString().replace(/\D/g, '');
        if (cleaned.length === 9) {
            return `***-**-${cleaned.slice(5)}`;
        }
    }
    return value.toString();
};
const toTitleCase = (str)=>{
    // Handle camelCase
    const spacedStr = str.replace(/([A-Z])/g, ' $1');
    // Handle snake_case
    const withSpaces = spacedStr.replace(/_/g, ' ');
    // Capitalize first letter of each word
    return withSpaces.split(' ').map((word)=>word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ').trim();
};
/**
 * Field mapping for Aid & Attendance form
 */ const AID_ATTENDANCE_FIELD_MAP = {
    // Personal Information
    veteranName: {
        label: "Veteran's Full Name",
        section: 'Personal Information'
    },
    veteranSSN: {
        label: 'Social Security Number',
        section: 'Personal Information'
    },
    veteranDOB: {
        label: 'Date of Birth',
        section: 'Personal Information'
    },
    veteranPhone: {
        label: 'Phone Number',
        section: 'Personal Information'
    },
    veteranEmail: {
        label: 'Email Address',
        section: 'Personal Information'
    },
    // Contact Person
    contactName: {
        label: 'Contact Name',
        section: 'Contact Person'
    },
    contactPhone: {
        label: 'Contact Phone',
        section: 'Contact Person'
    },
    contactEmail: {
        label: 'Contact Email',
        section: 'Contact Person'
    },
    contactRelationship: {
        label: 'Relationship to Veteran',
        section: 'Contact Person'
    },
    // Medical Information
    primaryDiagnosis: {
        label: 'Primary Diagnosis',
        section: 'Medical Information'
    },
    secondaryDiagnoses: {
        label: 'Secondary Diagnoses',
        section: 'Medical Information'
    },
    currentMedications: {
        label: 'Current Medications',
        section: 'Medical Information'
    },
    physicianName: {
        label: 'Primary Physician',
        section: 'Medical Information'
    },
    physicianPhone: {
        label: 'Physician Phone',
        section: 'Medical Information'
    },
    lastExamDate: {
        label: 'Last Medical Exam',
        section: 'Medical Information'
    },
    // Activities of Daily Living
    bathing: {
        label: 'Bathing/Showering',
        section: 'Activities of Daily Living'
    },
    dressing: {
        label: 'Dressing/Undressing',
        section: 'Activities of Daily Living'
    },
    eating: {
        label: 'Eating/Feeding',
        section: 'Activities of Daily Living'
    },
    toileting: {
        label: 'Toileting',
        section: 'Activities of Daily Living'
    },
    mobility: {
        label: 'Walking/Mobility',
        section: 'Activities of Daily Living'
    },
    transferring: {
        label: 'Transferring',
        section: 'Activities of Daily Living'
    },
    continence: {
        label: 'Continence Control',
        section: 'Activities of Daily Living'
    },
    // Care Requirements
    supervisionNeeded: {
        label: 'Supervision Level',
        section: 'Care Requirements'
    },
    assistanceHours: {
        label: 'Daily Assistance Hours',
        section: 'Care Requirements'
    },
    caregiverInfo: {
        label: 'Current Caregiver',
        section: 'Care Requirements'
    },
    // Additional Information
    additionalInfo: {
        label: 'Additional Details',
        section: 'Additional Information'
    },
    rushService: {
        label: 'Rush Service',
        section: 'Additional Information'
    },
    serviceType: {
        label: 'Service Type',
        section: 'Additional Information'
    }
};
/**
 * Field mapping for Quick Intake form
 */ const QUICK_INTAKE_FIELD_MAP = {
    fullName: {
        label: 'Full Name',
        section: 'Contact Information'
    },
    email: {
        label: 'Email',
        section: 'Contact Information'
    },
    phone: {
        label: 'Phone',
        section: 'Contact Information'
    },
    formType: {
        label: 'Form Type',
        section: 'Request Details'
    },
    briefSummary: {
        label: 'Brief Summary',
        section: 'Request Details'
    }
};
/**
 * Get field mapping based on form type
 * @param {string} formType - Type of form
 * @returns {object} - Field mapping
 */ const getFieldMap = (formType)=>{
    switch(formType){
        case 'aid-attendance':
        case 'aid_attendance':
            return AID_ATTENDANCE_FIELD_MAP;
        case 'quick-intake':
        case 'quick_intake':
            return QUICK_INTAKE_FIELD_MAP;
        default:
            return null;
    }
};
const groupFieldsIntoSections = (data, formType = null)=>{
    const fieldMap = getFieldMap(formType);
    const sections = {};
    Object.entries(data).forEach(([key, value])=>{
        // Skip empty values
        if (value === null || value === undefined || value === '') {
            return;
        }
        let sectionName = 'General Information';
        let fieldLabel = toTitleCase(key);
        // Use field map if available
        if (fieldMap && fieldMap[key]) {
            sectionName = fieldMap[key].section;
            fieldLabel = fieldMap[key].label;
        }
        // Initialize section if it doesn't exist
        if (!sections[sectionName]) {
            sections[sectionName] = [];
        }
        // Add field to section
        sections[sectionName].push({
            key,
            label: fieldLabel,
            value: formatFieldValue(key, value),
            rawValue: value
        });
    });
    // Convert to array format
    return Object.entries(sections).map(([title, fields])=>({
            title,
            fields
        }));
};
const parseFormData = (data, formType = null)=>{
    // If data is already an object, use it directly
    if (typeof data === 'object' && data !== null) {
        return {
            isJSON: true,
            sections: groupFieldsIntoSections(data, formType),
            rawData: data
        };
    }
    // If data is a string, check if it's JSON
    if (typeof data === 'string') {
        if (isJSON(data)) {
            const parsed = safeJSONParse(data);
            if (parsed) {
                return {
                    isJSON: true,
                    sections: groupFieldsIntoSections(parsed, formType),
                    rawData: parsed
                };
            }
        }
        // Plain text - return as single section
        return {
            isJSON: false,
            sections: [
                {
                    title: 'Message',
                    fields: [
                        {
                            key: 'message',
                            label: 'Message',
                            value: data,
                            rawValue: data
                        }
                    ]
                }
            ],
            rawData: data
        };
    }
    // Fallback for unexpected data types
    return {
        isJSON: false,
        sections: [
            {
                title: 'Data',
                fields: [
                    {
                        key: 'data',
                        label: 'Data',
                        value: 'Unable to parse data',
                        rawValue: data
                    }
                ]
            }
        ],
        rawData: data
    };
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/components/admin/FormDataParser.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$formDataParser$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/formDataParser.js [client] (ecmascript)");
;
;
;
/**
 * FormDataParser Component
 * Parses and displays form submission data in a clean, structured format
 * 
 * Supports multiple form types:
 * - 'aid-attendance' or 'aid_attendance': Aid & Attendance form with specialized sections
 * - 'quick-intake' or 'quick_intake': Quick Intake form with contact and request details
 * - null or unknown: Generic form with automatic field detection and formatting
 * 
 * @param {object} props
 * @param {string|object} props.data - Form data (JSON string or object)
 * @param {string} props.formType - Type of form (optional, defaults to generic parsing)
 * @param {string} props.className - Additional CSS classes
 */ const FormDataParser = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"].memo(_c = ({ data, formType = null, className = '' })=>{
    // Handle empty or null data
    if (!data) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `text-slate-500 text-sm ${className}`,
            children: "No data available"
        }, void 0, false, {
            fileName: "[project]/frontend/src/components/admin/FormDataParser.js",
            lineNumber: 22,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    }
    // Parse the form data
    const parsedData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$formDataParser$2e$js__$5b$client$5d$__$28$ecmascript$29$__["parseFormData"])(data, formType);
    // If no sections were created, show a fallback message
    if (!parsedData.sections || parsedData.sections.length === 0) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `text-slate-500 text-sm ${className}`,
            children: "Unable to parse form data"
        }, void 0, false, {
            fileName: "[project]/frontend/src/components/admin/FormDataParser.js",
            lineNumber: 34,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    }
    // Get form type label for display
    const getFormTypeLabel = (type)=>{
        if (!type) return null;
        switch(type.toLowerCase().replace('_', '-')){
            case 'aid-attendance':
                return 'Aid & Attendance Form';
            case 'quick-intake':
                return 'Quick Intake Form';
            default:
                return type.split(/[-_]/).map((word)=>word.charAt(0).toUpperCase() + word.slice(1)).join(' ') + ' Form';
        }
    };
    const formTypeLabel = getFormTypeLabel(formType);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `space-y-6 ${className}`,
        children: [
            formTypeLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800",
                children: formTypeLabel
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/admin/FormDataParser.js",
                lineNumber: 62,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)),
            parsedData.sections.map((section, sectionIndex)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2",
                            children: section.title
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/FormDataParser.js",
                            lineNumber: 71,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-3",
                            children: section.fields.map((field, fieldIndex)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid grid-cols-1 sm:grid-cols-3 gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-sm font-medium text-slate-700",
                                            children: field.label
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/FormDataParser.js",
                                            lineNumber: 80,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "sm:col-span-2 text-sm text-slate-900",
                                            children: typeof field.value === 'string' && field.value.includes('\n') ? // Multi-line text
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                                                className: "whitespace-pre-wrap font-sans",
                                                children: field.value
                                            }, void 0, false, {
                                                fileName: "[project]/frontend/src/components/admin/FormDataParser.js",
                                                lineNumber: 88,
                                                columnNumber: 21
                                            }, ("TURBOPACK compile-time value", void 0)) : // Single line text
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: field.value
                                            }, void 0, false, {
                                                fileName: "[project]/frontend/src/components/admin/FormDataParser.js",
                                                lineNumber: 91,
                                                columnNumber: 21
                                            }, ("TURBOPACK compile-time value", void 0))
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/FormDataParser.js",
                                            lineNumber: 85,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, fieldIndex, true, {
                                    fileName: "[project]/frontend/src/components/admin/FormDataParser.js",
                                    lineNumber: 78,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)))
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/FormDataParser.js",
                            lineNumber: 76,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, sectionIndex, true, {
                    fileName: "[project]/frontend/src/components/admin/FormDataParser.js",
                    lineNumber: 69,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)))
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/components/admin/FormDataParser.js",
        lineNumber: 59,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
});
_c1 = FormDataParser;
FormDataParser.displayName = 'FormDataParser';
const __TURBOPACK__default__export__ = FormDataParser;
var _c, _c1;
__turbopack_context__.k.register(_c, "FormDataParser$React.memo");
__turbopack_context__.k.register(_c1, "FormDataParser");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/lib/api.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "blogApi",
    ()=>blogApi,
    "caseStudyApi",
    ()=>caseStudyApi,
    "contactsApi",
    ()=>contactsApi,
    "default",
    ()=>__TURBOPACK__default__export__,
    "fileUploadApi",
    ()=>fileUploadApi,
    "formSubmissionsApi",
    ()=>formSubmissionsApi,
    "generateSlug",
    ()=>generateSlug,
    "servicesApi",
    ()=>servicesApi,
    "submitGenericForm",
    ()=>submitGenericForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/supabase.js [client] (ecmascript)");
;
const servicesApi = {
    async getAll () {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('services').select('*').eq('is_active', true).order('display_order', {
            ascending: true
        });
        if (error) throw error;
        return data;
    },
    async getBySlug (slug) {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('services').select('*').eq('slug', slug).eq('is_active', true).single();
        if (error) throw error;
        return data;
    },
    async delete (id) {
        const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('services').delete().eq('id', id);
        if (error) throw error;
        return true;
    }
};
const blogApi = {
    async getAll (limit = 100) {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('blog_posts').select('*').eq('is_published', true).order('published_at', {
            ascending: false
        }).limit(limit);
        if (error) throw error;
        return data;
    },
    async getBySlug (slug) {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('blog_posts').select('*').eq('slug', slug).eq('is_published', true).single();
        if (error) throw error;
        return data;
    },
    async search (query, category = null) {
        let queryBuilder = __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('blog_posts').select('*').eq('is_published', true);
        if (query) {
            queryBuilder = queryBuilder.or(`title.ilike.%${query}%,excerpt.ilike.%${query}%,content_html.ilike.%${query}%`);
        }
        if (category) {
            queryBuilder = queryBuilder.eq('category', category);
        }
        const { data, error } = await queryBuilder.order('published_at', {
            ascending: false
        }).limit(50);
        if (error) throw error;
        return data;
    }
};
const contactsApi = {
    async submit (contactData) {
        // Convert serviceTypes array to a comma-separated string for subject
        const subject = contactData.serviceTypes && contactData.serviceTypes.length > 0 ? contactData.serviceTypes.map((type)=>type.replace(/_/g, ' ').replace(/\b\w/g, (l)=>l.toUpperCase())).join(', ') : contactData.subject || 'General Inquiry';
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('contacts').insert([
            {
                name: contactData.name,
                email: contactData.email,
                phone: contactData.phone || null,
                subject: subject,
                message: contactData.message,
                service_interest: contactData.serviceTypes ? contactData.serviceTypes.join(', ') : contactData.serviceInterest || contactData.service || null,
                status: 'new'
            }
        ]).select().single();
        if (error) throw error;
        return data;
    }
};
const submitGenericForm = async (formData)=>{
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('contacts').insert([
        {
            name: formData.name,
            email: formData.email,
            phone: formData.phone || null,
            subject: 'Generic Form Submission',
            message: formData.additionalDetails || 'No additional details provided',
            status: 'new'
        }
    ]).select().single();
    if (error) throw error;
    return data;
};
const fileUploadApi = {
    async upload (file, contactId, category = 'other') {
        const fileExt = file.name.split('.').pop();
        const fileName = `${contactId}/${Date.now()}.${fileExt}`;
        // Validate category - must be one of the allowed values
        const validCategories = [
            'medical_record',
            'insurance',
            'identification',
            'other'
        ];
        const validCategory = validCategories.includes(category) ? category : 'other';
        // Upload to storage
        const { data: storageData, error: storageError } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].storage.from(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["STORAGE_BUCKETS"].MEDICAL_DOCUMENTS).upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });
        if (storageError) throw storageError;
        // Create database record
        const { data: dbData, error: dbError } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('file_uploads').insert([
            {
                contact_id: contactId,
                original_filename: file.name,
                storage_path: storageData.path,
                file_size: file.size,
                mime_type: file.type,
                file_category: validCategory,
                upload_status: 'uploaded',
                is_phi: true
            }
        ]).select().single();
        if (dbError) throw dbError;
        return dbData;
    },
    async getAll (contactId = null, formSubmissionId = null) {
        let query = __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('file_uploads').select('*').order('created_at', {
            ascending: false
        });
        if (contactId) {
            query = query.eq('contact_id', contactId);
        }
        if (formSubmissionId) {
            query = query.eq('form_submission_id', formSubmissionId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    async getById (fileId) {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('file_uploads').select('*').eq('id', fileId).single();
        if (error) throw error;
        return data;
    },
    async getDownloadUrl (storagePath) {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].storage.from(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["STORAGE_BUCKETS"].MEDICAL_DOCUMENTS).createSignedUrl(storagePath, 3600); // 1 hour expiry
        if (error) throw error;
        return data.signedUrl;
    },
    async delete (fileId, storagePath) {
        // Delete from storage
        const { error: storageError } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].storage.from(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["STORAGE_BUCKETS"].MEDICAL_DOCUMENTS).remove([
            storagePath
        ]);
        if (storageError) throw storageError;
        // Delete database record
        const { error: dbError } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('file_uploads').delete().eq('id', fileId);
        if (dbError) throw dbError;
        return true;
    }
};
const formSubmissionsApi = {
    async submit (formData) {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('form_submissions').insert([
            {
                form_type: formData.formType,
                full_name: formData.fullName,
                email: formData.email,
                phone: formData.phone || null,
                form_data: formData.formData || {},
                requires_upload: formData.requiresUpload || false,
                status: 'new'
            }
        ]).select().single();
        if (error) throw error;
        return data;
    },
    async getById (id) {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('form_submissions').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    }
};
// Update file upload to support form submissions
const originalUpload = fileUploadApi.upload;
fileUploadApi.upload = async function(file, contactIdOrFormId, category = 'other', isFormSubmission = false) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${contactIdOrFormId}/${Date.now()}.${fileExt}`;
    const validCategories = [
        'medical_record',
        'insurance',
        'identification',
        'other'
    ];
    const validCategory = validCategories.includes(category) ? category : 'other';
    const { data: storageData, error: storageError } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].storage.from(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["STORAGE_BUCKETS"].MEDICAL_DOCUMENTS).upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
    });
    if (storageError) throw storageError;
    const insertData = {
        original_filename: file.name,
        storage_path: storageData.path,
        file_size: file.size,
        mime_type: file.type,
        file_category: validCategory,
        upload_status: 'uploaded',
        is_phi: true
    };
    if (isFormSubmission) {
        insertData.form_submission_id = contactIdOrFormId;
    } else {
        insertData.contact_id = contactIdOrFormId;
    }
    const { data: dbData, error: dbError } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('file_uploads').insert([
        insertData
    ]).select().single();
    if (dbError) throw dbError;
    // Update form submission to mark it has uploads
    if (isFormSubmission) {
        await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('form_submissions').update({
            has_uploads: true
        }).eq('id', contactIdOrFormId);
    }
    return dbData;
};
const generateSlug = (title)=>{
    return title.toLowerCase().trim().replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};
// Check if slug exists and generate unique slug if needed
const ensureUniqueSlug = async (slug, excludeId = null)=>{
    let uniqueSlug = slug;
    let counter = 1;
    while(true){
        let query = __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('case_studies').select('id').eq('slug', uniqueSlug);
        if (excludeId) {
            query = query.neq('id', excludeId);
        }
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) {
            return uniqueSlug;
        }
        counter++;
        uniqueSlug = `${slug}-${counter}`;
    }
};
const caseStudyApi = {
    async getAll (includeUnpublished = false) {
        let query = __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('case_studies').select('*').order('published_at', {
            ascending: false
        });
        if (!includeUnpublished) {
            query = query.eq('is_published', true);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    async getBySlug (slug) {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('case_studies').select('*').eq('slug', slug).eq('is_published', true).single();
        if (error) throw error;
        return data;
    },
    async getById (id) {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('case_studies').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },
    async create (caseStudyData) {
        // Generate slug from title if not provided
        let slug = caseStudyData.slug || generateSlug(caseStudyData.title);
        // Ensure slug is unique
        slug = await ensureUniqueSlug(slug);
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('case_studies').insert([
            {
                slug,
                title: caseStudyData.title,
                excerpt: caseStudyData.excerpt,
                content_html: caseStudyData.content_html || caseStudyData.challenge,
                challenge: caseStudyData.challenge || null,
                solution: caseStudyData.solution || null,
                results: caseStudyData.results || null,
                key_takeaway: caseStudyData.key_takeaway || null,
                tags: caseStudyData.tags || [],
                is_published: caseStudyData.is_published !== undefined ? caseStudyData.is_published : true,
                published_at: caseStudyData.published_at || new Date().toISOString()
            }
        ]).select().single();
        if (error) throw error;
        return data;
    },
    async update (id, caseStudyData) {
        const updateData = {
            title: caseStudyData.title,
            excerpt: caseStudyData.excerpt,
            content_html: caseStudyData.content_html || caseStudyData.challenge,
            challenge: caseStudyData.challenge || null,
            solution: caseStudyData.solution || null,
            results: caseStudyData.results || null,
            key_takeaway: caseStudyData.key_takeaway || null,
            tags: caseStudyData.tags || [],
            is_published: caseStudyData.is_published,
            published_at: caseStudyData.published_at
        };
        // If slug is provided and different, ensure it's unique
        if (caseStudyData.slug) {
            const slug = generateSlug(caseStudyData.slug);
            updateData.slug = await ensureUniqueSlug(slug, id);
        }
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('case_studies').update(updateData).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async delete (id) {
        const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('case_studies').delete().eq('id', id);
        if (error) throw error;
        return true;
    },
    async togglePublished (id, currentStatus) {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('case_studies').update({
            is_published: !currentStatus
        }).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async incrementViews (slug) {
        const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].rpc('increment_case_study_views', {
            study_slug: slug
        });
        if (error) {
            console.error('Error incrementing views:', error);
        // Don't throw error for view increment failures
        }
    }
};
const __TURBOPACK__default__export__ = {
    services: servicesApi,
    blog: blogApi,
    contacts: contactsApi,
    fileUpload: fileUploadApi,
    formSubmissions: formSubmissionsApi,
    caseStudy: caseStudyApi
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/lib/fileTypeDetection.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "canPreview",
    ()=>canPreview,
    "formatFileSize",
    ()=>formatFileSize,
    "getFileCategory",
    ()=>getFileCategory,
    "getFileExtension",
    ()=>getFileExtension,
    "getFileIcon",
    ()=>getFileIcon,
    "getFileTypeLabel",
    ()=>getFileTypeLabel,
    "getMimeTypeFromExtension",
    ()=>getMimeTypeFromExtension,
    "getPreviewType",
    ()=>getPreviewType,
    "isDocument",
    ()=>isDocument,
    "isImage",
    ()=>isImage,
    "isPDF",
    ()=>isPDF,
    "isValidFileExtension",
    ()=>isValidFileExtension,
    "isValidFileSize",
    ()=>isValidFileSize,
    "isValidMimeType",
    ()=>isValidMimeType,
    "validateFile",
    ()=>validateFile
]);
/**
 * File Type Detection Utility
 * Handles file type detection, validation, and preview capability checking
 */ /**
 * Common MIME types and their categories
 */ const MIME_TYPE_CATEGORIES = {
    // Images
    'image/jpeg': 'image',
    'image/jpg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/webp': 'image',
    'image/svg+xml': 'image',
    'image/bmp': 'image',
    // PDFs
    'application/pdf': 'pdf',
    // Documents
    'application/msword': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    'application/vnd.ms-excel': 'document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
    'application/vnd.ms-powerpoint': 'document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
    'text/plain': 'document',
    'text/csv': 'document',
    // Archives
    'application/zip': 'archive',
    'application/x-rar-compressed': 'archive',
    'application/x-7z-compressed': 'archive',
    'application/x-tar': 'archive',
    'application/gzip': 'archive'
};
/**
 * File extensions mapped to MIME types
 */ const EXTENSION_TO_MIME = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    // PDFs
    'pdf': 'application/pdf',
    // Documents
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'csv': 'text/csv',
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip'
};
const getFileExtension = (filename)=>{
    if (!filename || typeof filename !== 'string') return '';
    const parts = filename.split('.');
    if (parts.length < 2) return '';
    return parts[parts.length - 1].toLowerCase();
};
const getMimeTypeFromExtension = (filename)=>{
    const extension = getFileExtension(filename);
    return EXTENSION_TO_MIME[extension] || null;
};
const getFileCategory = (mimeType)=>{
    if (!mimeType) return 'unknown';
    // Normalize MIME type
    const normalized = mimeType.toLowerCase().trim();
    return MIME_TYPE_CATEGORIES[normalized] || 'unknown';
};
const isImage = (mimeType)=>{
    return getFileCategory(mimeType) === 'image';
};
const isPDF = (mimeType)=>{
    return getFileCategory(mimeType) === 'pdf';
};
const isDocument = (mimeType)=>{
    return getFileCategory(mimeType) === 'document';
};
const canPreview = (mimeType)=>{
    const category = getFileCategory(mimeType);
    return category === 'image' || category === 'pdf';
};
const isValidFileExtension = (filename, allowedExtensions = [])=>{
    if (!allowedExtensions || allowedExtensions.length === 0) return true;
    const extension = getFileExtension(filename);
    return allowedExtensions.map((ext)=>ext.toLowerCase()).includes(extension);
};
const isValidMimeType = (mimeType, allowedMimeTypes = [])=>{
    if (!allowedMimeTypes || allowedMimeTypes.length === 0) return true;
    const normalized = mimeType.toLowerCase().trim();
    return allowedMimeTypes.map((type)=>type.toLowerCase()).includes(normalized);
};
const getFileTypeLabel = (mimeType, filename = '')=>{
    const category = getFileCategory(mimeType);
    switch(category){
        case 'image':
            return 'Image';
        case 'pdf':
            return 'PDF Document';
        case 'document':
            const ext = getFileExtension(filename).toUpperCase();
            if (ext === 'DOC' || ext === 'DOCX') return 'Word Document';
            if (ext === 'XLS' || ext === 'XLSX') return 'Excel Spreadsheet';
            if (ext === 'PPT' || ext === 'PPTX') return 'PowerPoint Presentation';
            if (ext === 'TXT') return 'Text File';
            if (ext === 'CSV') return 'CSV File';
            return 'Document';
        case 'archive':
            return 'Archive';
        default:
            const extension = getFileExtension(filename);
            return extension ? `${extension.toUpperCase()} File` : 'Unknown File';
    }
};
const formatFileSize = (bytes)=>{
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = [
        'Bytes',
        'KB',
        'MB',
        'GB',
        'TB'
    ];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
const getFileIcon = (mimeType)=>{
    const category = getFileCategory(mimeType);
    switch(category){
        case 'image':
            return 'Image';
        case 'pdf':
            return 'FileText';
        case 'document':
            return 'FileText';
        case 'archive':
            return 'Archive';
        default:
            return 'File';
    }
};
const isValidFileSize = (fileSize, maxSize)=>{
    if (!maxSize) return true;
    return fileSize <= maxSize;
};
const getPreviewType = (mimeType)=>{
    if (isImage(mimeType)) return 'image';
    if (isPDF(mimeType)) return 'pdf';
    return 'none';
};
const validateFile = (file, options = {})=>{
    const { allowedExtensions = [], allowedMimeTypes = [], maxSize = null } = options;
    // Check file extension
    if (allowedExtensions.length > 0 && !isValidFileExtension(file.name, allowedExtensions)) {
        return {
            valid: false,
            error: `File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`
        };
    }
    // Check MIME type
    if (allowedMimeTypes.length > 0 && !isValidMimeType(file.mime_type, allowedMimeTypes)) {
        return {
            valid: false,
            error: 'File type not allowed'
        };
    }
    // Check file size
    if (maxSize && !isValidFileSize(file.size, maxSize)) {
        return {
            valid: false,
            error: `File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`
        };
    }
    return {
        valid: true,
        error: null
    };
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/components/admin/SkeletonLoader.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CardSkeleton",
    ()=>CardSkeleton,
    "FileListSkeleton",
    ()=>FileListSkeleton,
    "FormDataSkeleton",
    ()=>FormDataSkeleton,
    "TableRowSkeleton",
    ()=>TableRowSkeleton,
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/index.js [client] (ecmascript)");
;
;
const FileListSkeleton = ({ count = 3 })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-3",
        children: Array.from({
            length: count
        }).map((_, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 animate-pulse",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center space-x-4 flex-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-8 h-8 bg-slate-300 rounded"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                                lineNumber: 22,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 space-y-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "h-4 bg-slate-300 rounded w-3/4"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                                        lineNumber: 26,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "h-3 bg-slate-200 rounded w-1/2"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                                        lineNumber: 27,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                                lineNumber: 25,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                        lineNumber: 20,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center space-x-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-9 h-9 bg-slate-300 rounded-lg"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                                lineNumber: 33,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-9 h-9 bg-slate-300 rounded-lg"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                                lineNumber: 34,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                        lineNumber: 32,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, index, true, {
                fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                lineNumber: 16,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)))
    }, void 0, false, {
        fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
        lineNumber: 14,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = FileListSkeleton;
const TableRowSkeleton = ({ columns = 7, rows = 5 })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: Array.from({
            length: rows
        }).map((_, rowIndex)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                className: "animate-pulse",
                children: Array.from({
                    length: columns
                }).map((_, colIndex)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                        className: "px-6 py-4 whitespace-nowrap",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-4 bg-slate-200 rounded w-full"
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                            lineNumber: 53,
                            columnNumber: 15
                        }, ("TURBOPACK compile-time value", void 0))
                    }, colIndex, false, {
                        fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                        lineNumber: 52,
                        columnNumber: 13
                    }, ("TURBOPACK compile-time value", void 0)))
            }, rowIndex, false, {
                fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                lineNumber: 50,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)))
    }, void 0, false);
};
_c1 = TableRowSkeleton;
const FormDataSkeleton = ()=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-6 animate-pulse",
        children: Array.from({
            length: 3
        }).map((_, sectionIndex)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "h-6 bg-slate-300 rounded w-1/4 mb-4"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                        lineNumber: 72,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-3",
                        children: Array.from({
                            length: 4
                        }).map((_, fieldIndex)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-1 sm:grid-cols-3 gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "h-4 bg-slate-200 rounded w-3/4"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                                        lineNumber: 78,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "sm:col-span-2 h-4 bg-slate-200 rounded w-full"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                                        lineNumber: 79,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, fieldIndex, true, {
                                fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                                lineNumber: 77,
                                columnNumber: 15
                            }, ("TURBOPACK compile-time value", void 0)))
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                        lineNumber: 75,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, sectionIndex, true, {
                fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                lineNumber: 70,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)))
    }, void 0, false, {
        fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
        lineNumber: 68,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c2 = FormDataSkeleton;
const CardSkeleton = ({ count = 1 })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: Array.from({
            length: count
        }).map((_, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-white rounded-xl shadow-sm p-6 border border-slate-200 animate-pulse",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-4 bg-slate-200 rounded w-1/3"
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                            lineNumber: 102,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-8 bg-slate-300 rounded w-1/2"
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                            lineNumber: 103,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-3 bg-slate-200 rounded w-2/3"
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                            lineNumber: 104,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                    lineNumber: 101,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0))
            }, index, false, {
                fileName: "[project]/frontend/src/components/admin/SkeletonLoader.js",
                lineNumber: 97,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)))
    }, void 0, false);
};
_c3 = CardSkeleton;
const __TURBOPACK__default__export__ = {
    FileListSkeleton,
    TableRowSkeleton,
    FormDataSkeleton,
    CardSkeleton
};
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "FileListSkeleton");
__turbopack_context__.k.register(_c1, "TableRowSkeleton");
__turbopack_context__.k.register(_c2, "FormDataSkeleton");
__turbopack_context__.k.register(_c3, "CardSkeleton");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/components/admin/DocumentViewer.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/api.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$fileTypeDetection$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/fileTypeDetection.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__File$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/file.js [client] (ecmascript) <export default as File>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/file-text.js [client] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/image.js [client] (ecmascript) <export default as Image>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$archive$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Archive$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/archive.js [client] (ecmascript) <export default as Archive>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/download.js [client] (ecmascript) <export default as Download>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eye$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/eye.js [client] (ecmascript) <export default as Eye>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/circle-alert.js [client] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/sonner/dist/index.mjs [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$SkeletonLoader$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/admin/SkeletonLoader.js [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
;
/**
 * DocumentViewer Component
 * Displays a list of uploaded documents with metadata and preview capability
 * 
 * @param {object} props
 * @param {string} props.contactId - Contact ID to fetch files for (optional)
 * @param {string} props.formSubmissionId - Form submission ID to fetch files for (optional)
 * @param {function} props.onFileClick - Callback when file is clicked for preview
 * @param {string} props.className - Additional CSS classes
 */ const DocumentViewer = /*#__PURE__*/ _s(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"].memo(_c = _s(({ contactId = null, formSubmissionId = null, onFileClick = null, className = '' })=>{
    _s();
    const [files, setFiles] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "DocumentViewer.useEffect": ()=>{
            fetchFiles();
        }
    }["DocumentViewer.useEffect"], [
        contactId,
        formSubmissionId
    ]);
    /**
   * Fetch files from the API
   */ const fetchFiles = async ()=>{
        setLoading(true);
        setError(null);
        try {
            // Fetch files based on contactId or formSubmissionId
            const data = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$js__$5b$client$5d$__$28$ecmascript$29$__["fileUploadApi"].getAll(contactId, formSubmissionId);
            setFiles(data);
        } catch (err) {
            console.error('Error fetching files:', err);
            setError('Failed to load documents');
            __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error('Failed to load documents');
        } finally{
            setLoading(false);
        }
    };
    /**
   * Handle file download
   */ const handleDownload = async (file, e)=>{
        e.stopPropagation();
        try {
            const signedUrl = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$js__$5b$client$5d$__$28$ecmascript$29$__["fileUploadApi"].getDownloadUrl(file.storage_path);
            // Create a temporary link and trigger download
            const link = document.createElement('a');
            link.href = signedUrl;
            link.download = file.original_filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].success('Download started');
        } catch (err) {
            console.error('Error downloading file:', err);
            __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error('Failed to download file');
        }
    };
    /**
   * Get icon component based on file type
   */ const getIconComponent = (mimeType)=>{
        const iconName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$fileTypeDetection$2e$js__$5b$client$5d$__$28$ecmascript$29$__["getFileIcon"])(mimeType);
        switch(iconName){
            case 'Image':
                return __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__["Image"];
            case 'FileText':
                return __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"];
            case 'Archive':
                return __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$archive$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Archive$3e$__["Archive"];
            default:
                return __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__File$3e$__["File"];
        }
    };
    /**
   * Format date for display
   */ const formatDate = (dateString)=>{
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    // Loading state
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: className,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$SkeletonLoader$2e$js__$5b$client$5d$__$28$ecmascript$29$__["FileListSkeleton"], {
                count: 3
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                lineNumber: 124,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
            lineNumber: 123,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    }
    // Error state
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `text-center py-12 ${className}`,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                        className: "w-6 h-6 text-red-600"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                        lineNumber: 134,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                }, void 0, false, {
                    fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                    lineNumber: 133,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                    className: "text-lg font-semibold text-slate-900 mb-2",
                    children: "Failed to Load Documents"
                }, void 0, false, {
                    fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                    lineNumber: 136,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-slate-600 mb-6",
                    children: error
                }, void 0, false, {
                    fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                    lineNumber: 137,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: fetchFiles,
                    className: "px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors",
                    children: "Try Again"
                }, void 0, false, {
                    fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                    lineNumber: 138,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
            lineNumber: 132,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    }
    // Empty state
    if (files.length === 0) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `text-center py-12 ${className}`,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__File$3e$__["File"], {
                    className: "w-12 h-12 text-slate-300 mx-auto mb-4"
                }, void 0, false, {
                    fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                    lineNumber: 152,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-slate-500 text-sm",
                    children: "No documents uploaded"
                }, void 0, false, {
                    fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                    lineNumber: 153,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
            lineNumber: 151,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    }
    // Files list
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `space-y-3 ${className}`,
        children: files.map((file)=>{
            const IconComponent = getIconComponent(file.mime_type);
            const fileTypeLabel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$fileTypeDetection$2e$js__$5b$client$5d$__$28$ecmascript$29$__["getFileTypeLabel"])(file.mime_type, file.original_filename);
            const formattedSize = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$fileTypeDetection$2e$js__$5b$client$5d$__$28$ecmascript$29$__["formatFileSize"])(file.file_size);
            const formattedDate = formatDate(file.created_at);
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center space-x-4 flex-1 min-w-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-shrink-0",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(IconComponent, {
                                    className: "w-8 h-8 text-indigo-600"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                    lineNumber: 176,
                                    columnNumber: 17
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                lineNumber: 175,
                                columnNumber: 15
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 min-w-0",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                        className: "text-sm font-medium text-slate-900 truncate",
                                        children: file.original_filename
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                        lineNumber: 181,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center space-x-3 mt-1 text-xs text-slate-500",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: fileTypeLabel
                                            }, void 0, false, {
                                                fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                                lineNumber: 185,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: "•"
                                            }, void 0, false, {
                                                fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                                lineNumber: 186,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: formattedSize
                                            }, void 0, false, {
                                                fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                                lineNumber: 187,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: "•"
                                            }, void 0, false, {
                                                fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                                lineNumber: 188,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: formattedDate
                                            }, void 0, false, {
                                                fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                                lineNumber: 189,
                                                columnNumber: 19
                                            }, ("TURBOPACK compile-time value", void 0))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                        lineNumber: 184,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    file.file_category && file.file_category !== 'other' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-1",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800",
                                            children: file.file_category.replace('_', ' ')
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                            lineNumber: 193,
                                            columnNumber: 21
                                        }, ("TURBOPACK compile-time value", void 0))
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                        lineNumber: 192,
                                        columnNumber: 19
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                lineNumber: 180,
                                columnNumber: 15
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                        lineNumber: 173,
                        columnNumber: 13
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center space-x-2 ml-4",
                        children: [
                            onFileClick && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>onFileClick(file),
                                className: "p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors",
                                title: "Preview file",
                                "aria-label": `Preview ${file.original_filename}`,
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eye$3e$__["Eye"], {
                                    className: "w-5 h-5",
                                    "aria-hidden": "true"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                    lineNumber: 211,
                                    columnNumber: 19
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                lineNumber: 205,
                                columnNumber: 17
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: (e)=>handleDownload(file, e),
                                className: "p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors",
                                title: "Download file",
                                "aria-label": `Download ${file.original_filename}`,
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                    className: "w-5 h-5",
                                    "aria-hidden": "true"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                    lineNumber: 222,
                                    columnNumber: 17
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                                lineNumber: 216,
                                columnNumber: 15
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                        lineNumber: 202,
                        columnNumber: 13
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, file.id, true, {
                fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
                lineNumber: 168,
                columnNumber: 11
            }, ("TURBOPACK compile-time value", void 0));
        })
    }, void 0, false, {
        fileName: "[project]/frontend/src/components/admin/DocumentViewer.js",
        lineNumber: 160,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
}, "fo9KTD/n0DDC59+6bjHTrvLrhxA=")), "fo9KTD/n0DDC59+6bjHTrvLrhxA=");
_c1 = DocumentViewer;
DocumentViewer.displayName = 'DocumentViewer';
const __TURBOPACK__default__export__ = DocumentViewer;
var _c, _c1;
__turbopack_context__.k.register(_c, "DocumentViewer$React.memo");
__turbopack_context__.k.register(_c1, "DocumentViewer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/components/admin/FilePreviewModal.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/x.js [client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/download.js [client] (ecmascript) <export default as Download>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/loader-circle.js [client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/circle-alert.js [client] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/api.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$fileTypeDetection$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/fileTypeDetection.js [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
/**
 * FilePreviewModal Component
 * 
 * Displays a modal for previewing uploaded files (PDFs and images)
 * with download capability and proper error handling.
 * 
 * @param {Object} props
 * @param {Object} props.file - File object with storage_path, original_filename, mime_type
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 */ const FilePreviewModal = ({ file, isOpen, onClose })=>{
    _s();
    const [signedUrl, setSignedUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Generate signed URL when modal opens
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "FilePreviewModal.useEffect": ()=>{
            if (!isOpen || !file) {
                setSignedUrl(null);
                setLoading(true);
                setError(null);
                return;
            }
            const generateSignedUrl = {
                "FilePreviewModal.useEffect.generateSignedUrl": async ()=>{
                    setLoading(true);
                    setError(null);
                    try {
                        const url = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$js__$5b$client$5d$__$28$ecmascript$29$__["fileUploadApi"].getDownloadUrl(file.storage_path);
                        setSignedUrl(url);
                    } catch (err) {
                        console.error('Error generating signed URL:', err);
                        setError('Failed to load file. Please try again.');
                    } finally{
                        setLoading(false);
                    }
                }
            }["FilePreviewModal.useEffect.generateSignedUrl"];
            generateSignedUrl();
        }
    }["FilePreviewModal.useEffect"], [
        isOpen,
        file
    ]);
    // Handle ESC key to close modal
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "FilePreviewModal.useEffect": ()=>{
            const handleEscape = {
                "FilePreviewModal.useEffect.handleEscape": (e)=>{
                    if (e.key === 'Escape' && isOpen) {
                        onClose();
                    }
                }
            }["FilePreviewModal.useEffect.handleEscape"];
            document.addEventListener('keydown', handleEscape);
            return ({
                "FilePreviewModal.useEffect": ()=>document.removeEventListener('keydown', handleEscape)
            })["FilePreviewModal.useEffect"];
        }
    }["FilePreviewModal.useEffect"], [
        isOpen,
        onClose
    ]);
    // Prevent body scroll when modal is open
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "FilePreviewModal.useEffect": ()=>{
            if (isOpen) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = 'unset';
            }
            return ({
                "FilePreviewModal.useEffect": ()=>{
                    document.body.style.overflow = 'unset';
                }
            })["FilePreviewModal.useEffect"];
        }
    }["FilePreviewModal.useEffect"], [
        isOpen
    ]);
    // Handle click outside to close
    const handleBackdropClick = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "FilePreviewModal.useCallback[handleBackdropClick]": (e)=>{
            if (e.target === e.currentTarget) {
                onClose();
            }
        }
    }["FilePreviewModal.useCallback[handleBackdropClick]"], [
        onClose
    ]);
    // Handle download
    const handleDownload = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "FilePreviewModal.useCallback[handleDownload]": ()=>{
            if (!signedUrl) return;
            const link = document.createElement('a');
            link.href = signedUrl;
            link.download = file.original_filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }["FilePreviewModal.useCallback[handleDownload]"], [
        signedUrl,
        file
    ]);
    if (!isOpen) return null;
    const previewType = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$fileTypeDetection$2e$js__$5b$client$5d$__$28$ecmascript$29$__["getPreviewType"])(file.mime_type);
    const fileTypeLabel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$fileTypeDetection$2e$js__$5b$client$5d$__$28$ecmascript$29$__["getFileTypeLabel"])(file.mime_type, file.original_filename);
    const canShowPreview = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$fileTypeDetection$2e$js__$5b$client$5d$__$28$ecmascript$29$__["canPreview"])(file.mime_type);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50",
        onClick: handleBackdropClick,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "file-preview-title",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "bg-white rounded-lg sm:rounded-xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between p-3 sm:p-4 border-b border-slate-200",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-1 min-w-0",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    id: "file-preview-title",
                                    className: "text-base sm:text-lg font-semibold text-slate-900 truncate",
                                    title: file.original_filename,
                                    children: file.original_filename
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                    lineNumber: 111,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs sm:text-sm text-slate-500 mt-1",
                                    children: fileTypeLabel
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                    lineNumber: 118,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                            lineNumber: 110,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: onClose,
                            className: "ml-2 sm:ml-4 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0",
                            "aria-label": "Close preview",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                className: "w-5 h-5 sm:w-6 sm:h-6"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                lineNumber: 125,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                            lineNumber: 120,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                    lineNumber: 109,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex-1 overflow-auto p-3 sm:p-6 bg-slate-50",
                    children: [
                        loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col items-center justify-center h-full min-h-[400px]",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                    className: "w-12 h-12 text-indigo-600 animate-spin"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                    lineNumber: 133,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-slate-600 mt-4",
                                    children: "Loading preview..."
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                    lineNumber: 134,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                            lineNumber: 132,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)),
                        error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col items-center justify-center h-full min-h-[400px]",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                                    className: "w-12 h-12 text-red-500"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                    lineNumber: 140,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-slate-900 font-medium mt-4",
                                    children: error
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                    lineNumber: 141,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>window.location.reload(),
                                    className: "mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors",
                                    children: "Retry"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                    lineNumber: 142,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                            lineNumber: 139,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)),
                        !loading && !error && signedUrl && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                previewType === 'pdf' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "bg-white rounded-lg shadow-sm overflow-hidden h-full min-h-[400px] sm:min-h-[600px]",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
                                        src: signedUrl,
                                        className: "w-full h-full min-h-[400px] sm:min-h-[600px]",
                                        title: `PDF preview of ${file.original_filename}`,
                                        "aria-label": "PDF document preview"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                        lineNumber: 155,
                                        columnNumber: 19
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                    lineNumber: 154,
                                    columnNumber: 17
                                }, ("TURBOPACK compile-time value", void 0)),
                                previewType === 'image' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-center",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                        src: signedUrl,
                                        alt: file.original_filename,
                                        className: "max-w-full h-auto rounded-lg shadow-lg",
                                        style: {
                                            maxHeight: '70vh'
                                        }
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                        lineNumber: 166,
                                        columnNumber: 19
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                    lineNumber: 165,
                                    columnNumber: 17
                                }, ("TURBOPACK compile-time value", void 0)),
                                previewType === 'none' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col items-center justify-center h-full min-h-[400px]",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                                            className: "w-12 h-12 text-slate-400"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                            lineNumber: 177,
                                            columnNumber: 19
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-slate-900 font-medium mt-4",
                                            children: "Preview not available"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                            lineNumber: 178,
                                            columnNumber: 19
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-slate-600 mt-2",
                                            children: "This file type cannot be previewed in the browser."
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                            lineNumber: 179,
                                            columnNumber: 19
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-slate-600",
                                            children: "Please download the file to view it."
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                            lineNumber: 182,
                                            columnNumber: 19
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                    lineNumber: 176,
                                    columnNumber: 17
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true)
                    ]
                }, void 0, true, {
                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                    lineNumber: 130,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 p-3 sm:p-4 border-t border-slate-200 bg-white",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: handleDownload,
                            disabled: !signedUrl || loading,
                            className: "flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm sm:text-base",
                            "aria-label": "Download file",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                    className: "w-4 h-4"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                    lineNumber: 197,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "Download"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                                    lineNumber: 198,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                            lineNumber: 191,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: onClose,
                            className: "px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm sm:text-base",
                            children: "Close"
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                            lineNumber: 200,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
                    lineNumber: 190,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
            lineNumber: 107,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/frontend/src/components/admin/FilePreviewModal.js",
        lineNumber: 100,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(FilePreviewModal, "Qz4+9hkA0vEaNyXlmke+JIjqBBk=");
_c = FilePreviewModal;
const __TURBOPACK__default__export__ = FilePreviewModal;
var _c;
__turbopack_context__.k.register(_c, "FilePreviewModal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/components/admin/ContactDetailModal.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/x.js [client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$FormDataParser$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/admin/FormDataParser.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$DocumentViewer$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/admin/DocumentViewer.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$FilePreviewModal$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/admin/FilePreviewModal.js [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
/**
 * ContactDetailModal Component
 * 
 * Enhanced modal for viewing contact details with tabbed interface
 * Includes Details, Documents, and Activity tabs
 * 
 * @param {Object} props
 * @param {Object} props.contact - Contact object with all details
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 * @param {Function} props.onDelete - Callback to delete the contact
 */ const ContactDetailModal = ({ contact, isOpen, onClose, onDelete })=>{
    _s();
    const [activeTab, setActiveTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('details');
    const [selectedFile, setSelectedFile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Don't render if not open
    if (!isOpen || !contact) return null;
    /**
   * Format date for display
   */ const formatDate = (dateString)=>{
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    /**
   * Handle backdrop click to close
   */ const handleBackdropClick = (e)=>{
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    /**
   * Handle delete with confirmation
   */ const handleDelete = ()=>{
        if (showDeleteConfirm) {
            onDelete(contact.id);
            onClose();
        } else {
            setShowDeleteConfirm(true);
        }
    };
    /**
   * Handle file click for preview
   */ const handleFileClick = (file)=>{
        setSelectedFile(file);
    };
    /**
   * Tab configuration
   */ const tabs = [
        {
            id: 'details',
            label: 'Details'
        },
        {
            id: 'documents',
            label: 'Documents'
        },
        {
            id: 'activity',
            label: 'Activity'
        }
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50",
                onClick: handleBackdropClick,
                role: "dialog",
                "aria-modal": "true",
                "aria-labelledby": "contact-detail-title",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "bg-white rounded-lg sm:rounded-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between p-4 sm:p-6 border-b border-slate-200",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex-1 min-w-0 pr-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            id: "contact-detail-title",
                                            className: "text-xl sm:text-2xl font-bold text-slate-900 truncate",
                                            children: "Contact Details"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                            lineNumber: 91,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-xs sm:text-sm text-slate-500 mt-1 truncate",
                                            children: [
                                                contact.name,
                                                " • ",
                                                formatDate(contact.created_at)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                            lineNumber: 97,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                    lineNumber: 90,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: onClose,
                                    className: "text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0",
                                    "aria-label": "Close modal",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                        className: "w-5 h-5 sm:w-6 sm:h-6"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                        lineNumber: 106,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                    lineNumber: 101,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                            lineNumber: 89,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "border-b border-slate-200 px-4 sm:px-6 overflow-x-auto",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                                className: "flex space-x-4 sm:space-x-8 min-w-max",
                                "aria-label": "Contact detail tabs",
                                children: tabs.map((tab)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>setActiveTab(tab.id),
                                        className: `
                    py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                    ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                  `,
                                        "aria-current": activeTab === tab.id ? 'page' : undefined,
                                        children: tab.label
                                    }, tab.id, false, {
                                        fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                        lineNumber: 114,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0)))
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                lineNumber: 112,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                            lineNumber: 111,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-1 overflow-y-auto p-4 sm:p-6",
                            children: [
                                activeTab === 'details' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-6",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "space-y-4",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-sm font-semibold text-slate-700",
                                                            children: "Name"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                            lineNumber: 140,
                                                            columnNumber: 21
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-slate-900 mt-1",
                                                            children: contact.name
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                            lineNumber: 141,
                                                            columnNumber: 21
                                                        }, ("TURBOPACK compile-time value", void 0))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                    lineNumber: 139,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-sm font-semibold text-slate-700",
                                                            children: "Email"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                            lineNumber: 145,
                                                            columnNumber: 21
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-slate-900 mt-1",
                                                            children: contact.email
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                            lineNumber: 146,
                                                            columnNumber: 21
                                                        }, ("TURBOPACK compile-time value", void 0))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                    lineNumber: 144,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                contact.phone && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-sm font-semibold text-slate-700",
                                                            children: "Phone"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                            lineNumber: 151,
                                                            columnNumber: 23
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-slate-900 mt-1",
                                                            children: contact.phone
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                            lineNumber: 152,
                                                            columnNumber: 23
                                                        }, ("TURBOPACK compile-time value", void 0))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                    lineNumber: 150,
                                                    columnNumber: 21
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                contact.subject && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-sm font-semibold text-slate-700",
                                                            children: "Subject"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                            lineNumber: 158,
                                                            columnNumber: 23
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-slate-900 mt-1",
                                                            children: contact.subject
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                            lineNumber: 159,
                                                            columnNumber: 23
                                                        }, ("TURBOPACK compile-time value", void 0))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                    lineNumber: 157,
                                                    columnNumber: 21
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                contact.service_interest && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                            className: "text-sm font-semibold text-slate-700",
                                                            children: "Service Interest"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                            lineNumber: 165,
                                                            columnNumber: 23
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-slate-900 mt-1",
                                                            children: contact.service_interest
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                            lineNumber: 166,
                                                            columnNumber: 23
                                                        }, ("TURBOPACK compile-time value", void 0))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                    lineNumber: 164,
                                                    columnNumber: 21
                                                }, ("TURBOPACK compile-time value", void 0))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                            lineNumber: 138,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        contact.message && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                    className: "text-sm font-semibold text-slate-700 block mb-3",
                                                    children: "Message / Form Data"
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                    lineNumber: 174,
                                                    columnNumber: 21
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-slate-50 rounded-lg p-4 border border-slate-200",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$FormDataParser$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                                                        data: contact.message,
                                                        formType: contact.form_type || null
                                                    }, void 0, false, {
                                                        fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                        lineNumber: 178,
                                                        columnNumber: 23
                                                    }, ("TURBOPACK compile-time value", void 0))
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                    lineNumber: 177,
                                                    columnNumber: 21
                                                }, ("TURBOPACK compile-time value", void 0))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                            lineNumber: 173,
                                            columnNumber: 19
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                    lineNumber: 136,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                activeTab === 'documents' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$DocumentViewer$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                                        contactId: contact.id,
                                        onFileClick: handleFileClick
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                        lineNumber: 191,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                    lineNumber: 190,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                activeTab === 'activity' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "bg-slate-50 rounded-lg p-6 border border-slate-200",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                    className: "text-sm font-semibold text-slate-700 mb-3",
                                                    children: "Submission Timeline"
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                    lineNumber: 202,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "space-y-3",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-start space-x-3",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "w-2 h-2 bg-indigo-600 rounded-full mt-2"
                                                            }, void 0, false, {
                                                                fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                                lineNumber: 205,
                                                                columnNumber: 23
                                                            }, ("TURBOPACK compile-time value", void 0)),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "text-sm font-medium text-slate-900",
                                                                        children: "Form Submitted"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                                        lineNumber: 207,
                                                                        columnNumber: 25
                                                                    }, ("TURBOPACK compile-time value", void 0)),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "text-xs text-slate-500",
                                                                        children: formatDate(contact.created_at)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                                        lineNumber: 208,
                                                                        columnNumber: 25
                                                                    }, ("TURBOPACK compile-time value", void 0))
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                                lineNumber: 206,
                                                                columnNumber: 23
                                                            }, ("TURBOPACK compile-time value", void 0))
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                        lineNumber: 204,
                                                        columnNumber: 21
                                                    }, ("TURBOPACK compile-time value", void 0))
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                                    lineNumber: 203,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0))
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                            lineNumber: 201,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-sm text-slate-500 text-center py-8",
                                            children: "Additional activity tracking coming soon"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                            lineNumber: 213,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                    lineNumber: 200,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                            lineNumber: 133,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 sm:p-6 border-t border-slate-200 bg-slate-50",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "order-2 sm:order-1",
                                    children: showDeleteConfirm && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-xs sm:text-sm text-red-600 font-medium text-center sm:text-left",
                                        children: "Click Delete again to confirm"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                        lineNumber: 224,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                    lineNumber: 222,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 order-1 sm:order-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: onClose,
                                            className: "px-4 py-2 border border-slate-300 rounded-lg hover:bg-white transition-colors text-sm sm:text-base",
                                            children: "Close"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                            lineNumber: 230,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: handleDelete,
                                            className: `px-4 py-2 rounded-lg transition-colors text-sm sm:text-base ${showDeleteConfirm ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-red-600 text-white hover:bg-red-700'}`,
                                            children: showDeleteConfirm ? 'Confirm Delete' : 'Delete'
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                            lineNumber: 236,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                                    lineNumber: 229,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                            lineNumber: 221,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                    lineNumber: 87,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                lineNumber: 80,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            selectedFile && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$FilePreviewModal$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                file: selectedFile,
                isOpen: !!selectedFile,
                onClose: ()=>setSelectedFile(null)
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/admin/ContactDetailModal.js",
                lineNumber: 253,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true);
};
_s(ContactDetailModal, "A4ntKSv+50CGd9HArMoldcnjlSo=");
_c = ContactDetailModal;
const __TURBOPACK__default__export__ = ContactDetailModal;
var _c;
__turbopack_context__.k.register(_c, "ContactDetailModal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/components/admin/ErrorBoundary.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/frontend/node_modules/next/dist/build/polyfills/process.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/circle-alert.js [client] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/refresh-cw.js [client] (ecmascript) <export default as RefreshCw>");
;
;
;
/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app
 */ class ErrorBoundary extends __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"].Component {
    constructor(props){
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }
    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true
        };
    }
    componentDidCatch(error, errorInfo) {
        // Log error details for debugging
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });
    // You can also log the error to an error reporting service here
    // logErrorToService(error, errorInfo);
    }
    handleReset = ()=>{
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
        // Call optional onReset callback
        if (this.props.onReset) {
            this.props.onReset();
        }
    };
    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }
            // Default fallback UI
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "min-h-[400px] flex items-center justify-center p-6",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "max-w-md w-full bg-white rounded-xl shadow-lg border border-red-200 p-8",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                                className: "w-6 h-6 text-red-600"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                                lineNumber: 62,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                            lineNumber: 61,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "text-xl font-bold text-slate-900 text-center mb-2",
                            children: "Something went wrong"
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                            lineNumber: 65,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-slate-600 text-center mb-6",
                            children: this.props.errorMessage || 'An unexpected error occurred. Please try again.'
                        }, void 0, false, {
                            fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                            lineNumber: 69,
                            columnNumber: 13
                        }, this),
                        ("TURBOPACK compile-time value", "development") === 'development' && this.state.error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                            className: "mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                    className: "cursor-pointer text-sm font-medium text-slate-700 mb-2",
                                    children: "Error Details"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                                    lineNumber: 76,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                                    className: "text-xs text-red-600 overflow-auto",
                                    children: [
                                        this.state.error.toString(),
                                        this.state.errorInfo && this.state.errorInfo.componentStack
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                                    lineNumber: 79,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                            lineNumber: 75,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col sm:flex-row gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: this.handleReset,
                                    className: "flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__["RefreshCw"], {
                                            className: "w-4 h-4"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                                            lineNumber: 91,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: "Try Again"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                                            lineNumber: 92,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                                    lineNumber: 87,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>window.location.href = '/admin/dashboard',
                                    className: "flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors",
                                    children: "Go to Dashboard"
                                }, void 0, false, {
                                    fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                                    lineNumber: 95,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                            lineNumber: 86,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                    lineNumber: 60,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/admin/ErrorBoundary.js",
                lineNumber: 59,
                columnNumber: 9
            }, this);
        }
        return this.props.children;
    }
}
const __TURBOPACK__default__export__ = ErrorBoundary;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/hooks/useDebounce.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__,
    "useDebounce",
    ()=>useDebounce
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/index.js [client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useDebounce(value, delay = 500) {
    _s();
    const [debouncedValue, setDebouncedValue] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(value);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDebounce.useEffect": ()=>{
            // Set up a timer to update the debounced value after the delay
            const handler = setTimeout({
                "useDebounce.useEffect.handler": ()=>{
                    setDebouncedValue(value);
                }
            }["useDebounce.useEffect.handler"], delay);
            // Clean up the timer if value changes before delay expires
            return ({
                "useDebounce.useEffect": ()=>{
                    clearTimeout(handler);
                }
            })["useDebounce.useEffect"];
        }
    }["useDebounce.useEffect"], [
        value,
        delay
    ]);
    return debouncedValue;
}
_s(useDebounce, "KDuPAtDOgxm8PU6legVJOb3oOmA=");
const __TURBOPACK__default__export__ = useDebounce;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/components/SEO.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$head$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/head.js [client] (ecmascript)");
;
;
// Production site URL - used for canonical URLs and OG tags
const SITE_URL = 'https://www.militarydisabilitynexus.com';
const SEO = ({ title = 'Medical Consulting for Veterans', description = 'Professional medical documentation services for VA disability claims. Expert nexus letters, DBQs, and medical consultations for veterans seeking disability benefits and compensation.', keywords = 'VA nexus letter, DBQ, disability benefits questionnaire, aid and attendance, C&P exam, veteran medical documentation', ogImage = '/android-chrome-512x512.png', article = false, publishedTime, modifiedTime, author = 'Military Disability Nexus', canonical, structuredData, faqSchema, breadcrumbs })=>{
    // Always use production URL for SEO purposes
    const siteUrl = SITE_URL;
    // In Next.js SSR, window might be undefined initially, but Head handles it.
    // For canonical, we can rely on the passed canonical or default to siteUrl.
    // Ideally, we pass the current path from the parent page or use useRouter, 
    // but for now, we'll rely on the default or prop.
    const canonicalUrl = canonical || siteUrl;
    // Truncate description to 130 characters to avoid SEO penalties
    const metaDescription = description.length > 130 ? `${description.substring(0, 127)}...` : description;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$head$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                children: [
                    title,
                    " | Military Disability Nexus"
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 36,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                name: "description",
                content: metaDescription
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 37,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                name: "keywords",
                content: keywords
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 38,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("link", {
                rel: "canonical",
                href: canonicalUrl
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 39,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                property: "og:type",
                content: article ? 'article' : 'website'
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 42,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                property: "og:title",
                content: title
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 43,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                property: "og:description",
                content: metaDescription
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 44,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                property: "og:url",
                content: canonicalUrl
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 45,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                property: "og:image",
                content: `${siteUrl}${ogImage}`
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 46,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                property: "og:site_name",
                content: "Military Disability Nexus"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 47,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            article && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                        property: "article:author",
                        content: author
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/SEO.js",
                        lineNumber: 52,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    publishedTime && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                        property: "article:published_time",
                        content: publishedTime
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/SEO.js",
                        lineNumber: 53,
                        columnNumber: 29
                    }, ("TURBOPACK compile-time value", void 0)),
                    modifiedTime && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                        property: "article:modified_time",
                        content: modifiedTime
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/SEO.js",
                        lineNumber: 54,
                        columnNumber: 28
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                name: "twitter:card",
                content: "summary_large_image"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 59,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                name: "twitter:title",
                content: title
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 60,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                name: "twitter:description",
                content: metaDescription
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 61,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                name: "twitter:image",
                content: `${siteUrl}${ogImage}`
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 62,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                name: "robots",
                content: "index, follow"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 65,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                name: "author",
                content: author
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 66,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("meta", {
                name: "language",
                content: "English"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 67,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            structuredData && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("script", {
                type: "application/ld+json",
                dangerouslySetInnerHTML: {
                    __html: JSON.stringify(structuredData)
                }
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 71,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)),
            faqSchema && faqSchema.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("script", {
                type: "application/ld+json",
                dangerouslySetInnerHTML: {
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "FAQPage",
                        "mainEntity": faqSchema.map((faq)=>({
                                "@type": "Question",
                                "name": faq.question,
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": faq.answer
                                }
                            }))
                    })
                }
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 79,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)),
            breadcrumbs && breadcrumbs.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("script", {
                type: "application/ld+json",
                dangerouslySetInnerHTML: {
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        "itemListElement": breadcrumbs.map((crumb, index)=>({
                                "@type": "ListItem",
                                "position": index + 1,
                                "name": crumb.name,
                                "item": `${siteUrl}${crumb.path}`
                            }))
                    })
                }
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/SEO.js",
                lineNumber: 100,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/components/SEO.js",
        lineNumber: 34,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = SEO;
const __TURBOPACK__default__export__ = SEO;
var _c;
__turbopack_context__.k.register(_c, "SEO");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/pages/admin/contacts.js [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/supabase.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$AdminLayout$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/admin/AdminLayout.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$ProtectedRoute$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/admin/ProtectedRoute.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$ContactDetailModal$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/admin/ContactDetailModal.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$ErrorBoundary$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/admin/ErrorBoundary.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$SkeletonLoader$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/admin/SkeletonLoader.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$hooks$2f$useDebounce$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/hooks/useDebounce.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/search.js [client] (ecmascript) <export default as Search>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mail$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Mail$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/mail.js [client] (ecmascript) <export default as Mail>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$phone$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Phone$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/phone.js [client] (ecmascript) <export default as Phone>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Calendar$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/calendar.js [client] (ecmascript) <export default as Calendar>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eye$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/eye.js [client] (ecmascript) <export default as Eye>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/trash-2.js [client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/file-text.js [client] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/frontend/node_modules/lucide-react/dist/esm/icons/circle-alert.js [client] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/sonner/dist/index.mjs [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$SEO$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/SEO.js [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
;
;
;
;
;
;
const Contacts = ()=>{
    _s();
    const [contacts, setContacts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [searchQuery, setSearchQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [selectedContact, setSelectedContact] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [fileCounts, setFileCounts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Contacts.useEffect": ()=>{
            fetchContacts();
        }
    }["Contacts.useEffect"], []);
    const fetchContacts = async ()=>{
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('contacts').select('*').order('created_at', {
                ascending: false
            });
            if (error) throw error;
            setContacts(data);
            // Fetch file counts for all contacts
            if (data && data.length > 0) {
                await fetchFileCounts(data.map((c)=>c.id));
            }
        } catch (error) {
            console.error('Error fetching contacts:', error);
            setError('Failed to load contacts. Please try again.');
            __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error('Failed to load contacts');
        } finally{
            setLoading(false);
        }
    };
    const fetchFileCounts = async (contactIds)=>{
        try {
            const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('file_uploads').select('contact_id').in('contact_id', contactIds);
            if (error) throw error;
            // Count files per contact
            const counts = {};
            data.forEach((file)=>{
                counts[file.contact_id] = (counts[file.contact_id] || 0) + 1;
            });
            setFileCounts(counts);
        } catch (error) {
            console.error('Error fetching file counts:', error);
        }
    };
    const deleteContact = async (id)=>{
        try {
            const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$js__$5b$client$5d$__$28$ecmascript$29$__["supabase"].from('contacts').delete().eq('id', id);
            if (error) throw error;
            setContacts(contacts.filter((c)=>c.id !== id));
            setSelectedContact(null);
            __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].success('Contact deleted');
        } catch (error) {
            console.error('Error deleting contact:', error);
            __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$client$5d$__$28$ecmascript$29$__["toast"].error('Failed to delete contact');
        }
    };
    // Debounce search query for better performance
    const debouncedSearchQuery = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$hooks$2f$useDebounce$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useDebounce"])(searchQuery, 300);
    // Memoize filtered contacts to avoid unnecessary recalculations
    const filteredContacts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Contacts.useMemo[filteredContacts]": ()=>{
            if (!debouncedSearchQuery) return contacts;
            const query = debouncedSearchQuery.toLowerCase();
            return contacts.filter({
                "Contacts.useMemo[filteredContacts]": (contact)=>contact.name?.toLowerCase().includes(query) || contact.email?.toLowerCase().includes(query) || contact.subject?.toLowerCase().includes(query)
            }["Contacts.useMemo[filteredContacts]"]);
        }
    }["Contacts.useMemo[filteredContacts]"], [
        contacts,
        debouncedSearchQuery
    ]);
    const formatDate = (dateString)=>{
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$ProtectedRoute$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$AdminLayout$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$SEO$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                    title: "Admin Contacts",
                    noindex: true
                }, void 0, false, {
                    fileName: "[project]/frontend/pages/admin/contacts.js",
                    lineNumber: 118,
                    columnNumber: 17
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$ErrorBoundary$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                    errorMessage: "Failed to load contacts page",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-6",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                            className: "text-3xl font-bold text-slate-900",
                                            children: "Contacts"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                            lineNumber: 123,
                                            columnNumber: 33
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-slate-600 mt-2",
                                            children: "Manage form submissions"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                            lineNumber: 124,
                                            columnNumber: 33
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/pages/admin/contacts.js",
                                    lineNumber: 122,
                                    columnNumber: 29
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                lineNumber: 121,
                                columnNumber: 25
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "bg-white rounded-xl shadow-sm p-4 border border-slate-200",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            htmlFor: "contact-search",
                                            className: "sr-only",
                                            children: "Search contacts"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                            lineNumber: 131,
                                            columnNumber: 33
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"], {
                                            className: "absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400",
                                            "aria-hidden": "true"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                            lineNumber: 132,
                                            columnNumber: 33
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            id: "contact-search",
                                            type: "text",
                                            placeholder: "Search contacts...",
                                            value: searchQuery,
                                            onChange: (e)=>setSearchQuery(e.target.value),
                                            className: "w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500",
                                            "aria-label": "Search contacts by name, email, or subject"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                            lineNumber: 133,
                                            columnNumber: 33
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/frontend/pages/admin/contacts.js",
                                    lineNumber: 130,
                                    columnNumber: 29
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                lineNumber: 129,
                                columnNumber: 25
                            }, ("TURBOPACK compile-time value", void 0)),
                            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "bg-white rounded-xl shadow-sm p-12 text-center border border-red-200",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                                            className: "w-6 h-6 text-red-600"
                                        }, void 0, false, {
                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                            lineNumber: 149,
                                            columnNumber: 37
                                        }, ("TURBOPACK compile-time value", void 0))
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                        lineNumber: 148,
                                        columnNumber: 33
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-lg font-semibold text-slate-900 mb-2",
                                        children: "Failed to Load Contacts"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                        lineNumber: 151,
                                        columnNumber: 33
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-slate-600 mb-6",
                                        children: error
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                        lineNumber: 152,
                                        columnNumber: 33
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: fetchContacts,
                                        className: "px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors",
                                        children: "Try Again"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                        lineNumber: 153,
                                        columnNumber: 33
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                lineNumber: 147,
                                columnNumber: 29
                            }, ("TURBOPACK compile-time value", void 0)),
                            !error && (loading || filteredContacts.length > 0) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "overflow-x-auto",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                        className: "min-w-full divide-y divide-slate-200",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                                className: "bg-slate-50",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider",
                                                            children: "Name"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                                            lineNumber: 169,
                                                            columnNumber: 49
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider",
                                                            children: "Contact"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                                            lineNumber: 170,
                                                            columnNumber: 49
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider",
                                                            children: "Subject"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                                            lineNumber: 171,
                                                            columnNumber: 49
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider",
                                                            children: "Files"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                                            lineNumber: 172,
                                                            columnNumber: 49
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider",
                                                            children: "Date"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                                            lineNumber: 173,
                                                            columnNumber: 49
                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider",
                                                            children: "Actions"
                                                        }, void 0, false, {
                                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                                            lineNumber: 174,
                                                            columnNumber: 49
                                                        }, ("TURBOPACK compile-time value", void 0))
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/frontend/pages/admin/contacts.js",
                                                    lineNumber: 168,
                                                    columnNumber: 45
                                                }, ("TURBOPACK compile-time value", void 0))
                                            }, void 0, false, {
                                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                                lineNumber: 167,
                                                columnNumber: 41
                                            }, ("TURBOPACK compile-time value", void 0)),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                                className: "bg-white divide-y divide-slate-200",
                                                children: loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$SkeletonLoader$2e$js__$5b$client$5d$__$28$ecmascript$29$__["TableRowSkeleton"], {
                                                    columns: 6,
                                                    rows: 5
                                                }, void 0, false, {
                                                    fileName: "[project]/frontend/pages/admin/contacts.js",
                                                    lineNumber: 179,
                                                    columnNumber: 49
                                                }, ("TURBOPACK compile-time value", void 0)) : filteredContacts.map((contact)=>{
                                                    const fileCount = fileCounts[contact.id] || 0;
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                        className: "hover:bg-slate-50",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-6 py-4 whitespace-nowrap",
                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-sm font-medium text-slate-900",
                                                                    children: contact.name
                                                                }, void 0, false, {
                                                                    fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                    lineNumber: 186,
                                                                    columnNumber: 65
                                                                }, ("TURBOPACK compile-time value", void 0))
                                                            }, void 0, false, {
                                                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                lineNumber: 185,
                                                                columnNumber: 61
                                                            }, ("TURBOPACK compile-time value", void 0)),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-6 py-4 whitespace-nowrap",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "text-sm text-slate-900 flex items-center space-x-1",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mail$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Mail$3e$__["Mail"], {
                                                                                className: "w-4 h-4 text-slate-400"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                                lineNumber: 190,
                                                                                columnNumber: 69
                                                                            }, ("TURBOPACK compile-time value", void 0)),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: contact.email
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                                lineNumber: 191,
                                                                                columnNumber: 69
                                                                            }, ("TURBOPACK compile-time value", void 0))
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                        lineNumber: 189,
                                                                        columnNumber: 65
                                                                    }, ("TURBOPACK compile-time value", void 0)),
                                                                    contact.phone && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "text-sm text-slate-500 flex items-center space-x-1 mt-1",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$phone$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Phone$3e$__["Phone"], {
                                                                                className: "w-4 h-4 text-slate-400"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                                lineNumber: 195,
                                                                                columnNumber: 73
                                                                            }, ("TURBOPACK compile-time value", void 0)),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: contact.phone
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                                lineNumber: 196,
                                                                                columnNumber: 73
                                                                            }, ("TURBOPACK compile-time value", void 0))
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                        lineNumber: 194,
                                                                        columnNumber: 69
                                                                    }, ("TURBOPACK compile-time value", void 0))
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                lineNumber: 188,
                                                                columnNumber: 61
                                                            }, ("TURBOPACK compile-time value", void 0)),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-6 py-4",
                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-sm text-slate-900",
                                                                    children: contact.subject
                                                                }, void 0, false, {
                                                                    fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                    lineNumber: 201,
                                                                    columnNumber: 65
                                                                }, ("TURBOPACK compile-time value", void 0))
                                                            }, void 0, false, {
                                                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                lineNumber: 200,
                                                                columnNumber: 61
                                                            }, ("TURBOPACK compile-time value", void 0)),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-6 py-4 whitespace-nowrap",
                                                                children: fileCount > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex items-center space-x-2",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"], {
                                                                            className: "w-4 h-4 text-indigo-600"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                            lineNumber: 206,
                                                                            columnNumber: 73
                                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800",
                                                                            children: [
                                                                                fileCount,
                                                                                " ",
                                                                                fileCount === 1 ? 'file' : 'files'
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                            lineNumber: 207,
                                                                            columnNumber: 73
                                                                        }, ("TURBOPACK compile-time value", void 0))
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                    lineNumber: 205,
                                                                    columnNumber: 69
                                                                }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "text-sm text-slate-400",
                                                                    children: "No files"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                    lineNumber: 212,
                                                                    columnNumber: 69
                                                                }, ("TURBOPACK compile-time value", void 0))
                                                            }, void 0, false, {
                                                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                lineNumber: 203,
                                                                columnNumber: 61
                                                            }, ("TURBOPACK compile-time value", void 0)),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-6 py-4 whitespace-nowrap",
                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-sm text-slate-500 flex items-center space-x-1",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Calendar$3e$__["Calendar"], {
                                                                            className: "w-4 h-4"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                            lineNumber: 217,
                                                                            columnNumber: 69
                                                                        }, ("TURBOPACK compile-time value", void 0)),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            children: formatDate(contact.created_at)
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                            lineNumber: 218,
                                                                            columnNumber: 69
                                                                        }, ("TURBOPACK compile-time value", void 0))
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                    lineNumber: 216,
                                                                    columnNumber: 65
                                                                }, ("TURBOPACK compile-time value", void 0))
                                                            }, void 0, false, {
                                                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                lineNumber: 215,
                                                                columnNumber: 61
                                                            }, ("TURBOPACK compile-time value", void 0)),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-6 py-4 whitespace-nowrap text-sm font-medium",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                        onClick: ()=>setSelectedContact(contact),
                                                                        className: "text-indigo-600 hover:text-teal-900 mr-3",
                                                                        "aria-label": `View details for ${contact.name}`,
                                                                        title: "View contact details",
                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eye$3e$__["Eye"], {
                                                                            className: "w-5 h-5",
                                                                            "aria-hidden": "true"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                            lineNumber: 228,
                                                                            columnNumber: 69
                                                                        }, ("TURBOPACK compile-time value", void 0))
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                        lineNumber: 222,
                                                                        columnNumber: 65
                                                                    }, ("TURBOPACK compile-time value", void 0)),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                        onClick: ()=>deleteContact(contact.id),
                                                                        className: "text-red-600 hover:text-red-900",
                                                                        "aria-label": `Delete contact ${contact.name}`,
                                                                        title: "Delete contact",
                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                                                            className: "w-5 h-5",
                                                                            "aria-hidden": "true"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                            lineNumber: 236,
                                                                            columnNumber: 69
                                                                        }, ("TURBOPACK compile-time value", void 0))
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                        lineNumber: 230,
                                                                        columnNumber: 65
                                                                    }, ("TURBOPACK compile-time value", void 0))
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                                                lineNumber: 221,
                                                                columnNumber: 61
                                                            }, ("TURBOPACK compile-time value", void 0))
                                                        ]
                                                    }, contact.id, true, {
                                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                                        lineNumber: 184,
                                                        columnNumber: 57
                                                    }, ("TURBOPACK compile-time value", void 0));
                                                })
                                            }, void 0, false, {
                                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                                lineNumber: 177,
                                                columnNumber: 41
                                            }, ("TURBOPACK compile-time value", void 0))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                        lineNumber: 166,
                                        columnNumber: 37
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/frontend/pages/admin/contacts.js",
                                    lineNumber: 165,
                                    columnNumber: 33
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                lineNumber: 164,
                                columnNumber: 29
                            }, ("TURBOPACK compile-time value", void 0)) : !error && filteredContacts.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "bg-white rounded-xl shadow-sm p-12 text-center border border-slate-200",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mail$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Mail$3e$__["Mail"], {
                                        className: "w-12 h-12 text-slate-300 mx-auto mb-4"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                        lineNumber: 249,
                                        columnNumber: 33
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-slate-600",
                                        children: "No contacts found"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                        lineNumber: 250,
                                        columnNumber: 33
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    searchQuery && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-slate-500 text-sm mt-2",
                                        children: "Try adjusting your search"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/pages/admin/contacts.js",
                                        lineNumber: 252,
                                        columnNumber: 37
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                lineNumber: 248,
                                columnNumber: 29
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$admin$2f$ContactDetailModal$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"], {
                                contact: selectedContact,
                                isOpen: !!selectedContact,
                                onClose: ()=>setSelectedContact(null),
                                onDelete: deleteContact
                            }, void 0, false, {
                                fileName: "[project]/frontend/pages/admin/contacts.js",
                                lineNumber: 258,
                                columnNumber: 25
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/pages/admin/contacts.js",
                        lineNumber: 120,
                        columnNumber: 21
                    }, ("TURBOPACK compile-time value", void 0))
                }, void 0, false, {
                    fileName: "[project]/frontend/pages/admin/contacts.js",
                    lineNumber: 119,
                    columnNumber: 17
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/frontend/pages/admin/contacts.js",
            lineNumber: 117,
            columnNumber: 13
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/frontend/pages/admin/contacts.js",
        lineNumber: 116,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0));
};
_s(Contacts, "HtJzdAUTcu1u5V9uFx5iyANYdJ8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$hooks$2f$useDebounce$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useDebounce"]
    ];
});
_c = Contacts;
const __TURBOPACK__default__export__ = Contacts;
var _c;
__turbopack_context__.k.register(_c, "Contacts");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[next]/entry/page-loader.ts { PAGE => \"[project]/frontend/pages/admin/contacts.js [client] (ecmascript)\" } [client] (ecmascript)", ((__turbopack_context__, module, exports) => {

const PAGE_PATH = "/admin/contacts";
(window.__NEXT_P = window.__NEXT_P || []).push([
    PAGE_PATH,
    ()=>{
        return __turbopack_context__.r("[project]/frontend/pages/admin/contacts.js [client] (ecmascript)");
    }
]);
// @ts-expect-error module.hot exists
if (module.hot) {
    // @ts-expect-error module.hot exists
    module.hot.dispose(function() {
        window.__NEXT_P.push([
            PAGE_PATH
        ]);
    });
}
}),
"[hmr-entry]/hmr-entry.js { ENTRY => \"[project]/frontend/pages/admin/contacts.js\" }", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.r("[next]/entry/page-loader.ts { PAGE => \"[project]/frontend/pages/admin/contacts.js [client] (ecmascript)\" } [client] (ecmascript)");
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__2bfa5a0b._.js.map