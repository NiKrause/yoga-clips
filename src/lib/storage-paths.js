/**
 * Where this browser keeps its data, by Level path.
 *
 * Separate paths per concern: Helia's blockstore holds content-addressed
 * blocks, its datastore pins and routing records, OrbitDB's `directory` the
 * logs and the keystore. `browser-level` maps each to its own IndexedDB
 * database, so these names are what somebody sees in devtools.
 *
 * Deliberately not in p2p.js: nothing else should have to import libp2p to
 * learn a storage path.
 */
export const PERSISTENT_STORAGE_PATHS = Object.freeze({
	blockstore: 'yoga-clips/helia-blocks',
	datastore: 'yoga-clips/helia-data',
	orbitdb: 'yoga-clips/orbitdb'
});
