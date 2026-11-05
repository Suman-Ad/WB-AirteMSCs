import {collection,onSnapshot} from 'firebase/firestore';
import {assetRecord} from '../utils/assetsDashboardData';

export function subscribeAssets(db,onRows,onReady,onError) {
  let active = true;
  const records = new Map();
  const unsubscribe = onSnapshot(collection(db,'assets_flat'), snapshot => {
    if (!active) return;
    const changes = snapshot.docChanges();
    for (const change of changes) {
      if (change.type === 'removed') records.delete(change.doc.id);
      else records.set(change.doc.id,assetRecord(change.doc));
    }
    if (changes.length) onRows([...records.values()]);
    onReady();
  },error => { if (active) onError(error); });
  return () => { active = false; unsubscribe(); };
}
