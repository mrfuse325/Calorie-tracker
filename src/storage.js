let connection;
function database() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open('calorie-tracker', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('entries', { keyPath: 'id' });
      db.createObjectStore('preferences');
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); connection = undefined; };
      resolve(db);
    };
    request.onerror = () => { connection = undefined; reject(request.error); };
    request.onblocked = () => { connection = undefined; reject(Error('Close other tracker tabs and retry.')); };
  });
  return connection;
}
async function transact(store, mode, operation) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = operation(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error || request.error);
    tx.onabort = () => reject(tx.error || Error('Storage operation was interrupted.'));
  });
}
export const storage = {
  list: () => transact('entries', 'readonly', store => store.getAll()),
  save: entry => transact('entries', 'readwrite', store => store.put(entry)),
  remove: id => transact('entries', 'readwrite', store => store.delete(id)),
  goals: () => transact('preferences', 'readonly', store => store.get('goals')),
  saveGoals: goals => transact('preferences', 'readwrite', store => store.put(goals, 'goals')),
};
