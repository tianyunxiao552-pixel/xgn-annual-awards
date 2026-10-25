import { openStore } from '../server/store.mjs';
import path from 'node:path';
const password = process.env.XGN_NEW_PASSWORD;
if (!password) { console.error('Set XGN_NEW_PASSWORD in this shell, then run this script.'); process.exit(1); }
const store = openStore(process.env.XGN_DATA_DIR || path.resolve('data'));
store.setPassword(password); store.db.close(); console.log('Password updated; existing sessions have been signed out.');
