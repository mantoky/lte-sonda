'use strict';

/* ============================================
   MOCK FIREBASE - LOCALSTORAGE OFFLINE MODE
   ============================================ */

const OFFLINE_MODE = true;

const DB_KEYS = {
  users: 'lte_users',
  programacoes: 'lte_programacoes',
  ordens: 'lte_ordens',
  relatorios: 'lte_relatorios',
  ordemHistorico: 'lte_ordem_historico',
  fotos: 'lte_fotos',
  eventos: 'lte_eventos',
  escalas: 'lte_escalas',
  ausencias: 'lte_ausencias'
};

function getDB(key) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function setDB(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function initOfflineDB() {
  Object.values(DB_KEYS).forEach(key => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '[]');
    }
  });
}

initOfflineDB();

const MockAuth = {
  currentUser: null,
  listeners: [],
  
  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    setTimeout(() => callback(this.currentUser), 100);
  },
  
  signInWithEmailAndPassword(email, pass) {
    return new Promise((resolve, reject) => {
      const users = getDB(DB_KEYS.users);
      const user = users.find(u => u.email === email);
      if (user && pass === 'Vale@2026') {
        this.currentUser = { uid: user.id, email: user.email };
        this.listeners.forEach(cb => cb(this.currentUser));
        resolve({ user: this.currentUser });
      } else {
        reject({ code: 'auth/wrong-password' });
      }
    });
  },
  
  signOut() {
    this.currentUser = null;
    this.listeners.forEach(cb => cb(null));
    return Promise.resolve();
  }
};

const MockFirestore = {
  _idCounter: Date.now(),
  
  newId() {
    return 'id_' + (++this._idCounter) + '_' + Math.random().toString(36).substr(2, 9);
  },
  
  FieldValue: {
    serverTimestamp: () => new Date().toISOString()
  },
  
  collection(name) {
    const self = this;
    return {
      doc(id) {
        return {
          get() {
            return new Promise(resolve => {
              const data = getDB(DB_KEYS[name] || 'lte_' + name);
              const doc = data.find(d => d.id === id);
              resolve({
                exists: !!doc,
                data: () => doc || null,
                id: id
              });
            });
          },
          
          set(data) {
            return new Promise(resolve => {
              const key = DB_KEYS[name] || 'lte_' + name;
              const list = getDB(key);
              const newDoc = { id, ...data, createdAt: new Date().toISOString() };
              list.push(newDoc);
              setDB(key, list);
              resolve();
            });
          },
          
          update(data) {
            return new Promise(resolve => {
              const key = DB_KEYS[name] || 'lte_' + name;
              const list = getDB(key);
              const idx = list.findIndex(d => d.id === id);
              if (idx !== -1) {
                list[idx] = { ...list[idx], ...data };
                setDB(key, list);
              }
              resolve();
            });
          },
          
          delete() {
            return new Promise(resolve => {
              const key = DB_KEYS[name] || 'lte_' + name;
              const list = getDB(key);
              const filtered = list.filter(d => d.id !== id);
              setDB(key, filtered);
              resolve();
            });
          }
        };
      },
      
      add(data) {
        return new Promise(resolve => {
          const id = self.newId();
          const key = DB_KEYS[name] || 'lte_' + name;
          const list = getDB(key);
          list.push({ id, ...data });
          setDB(key, list);
          resolve({ id });
        });
      },
      
      where(field, op, value) {
        return {
          get() {
            return new Promise(resolve => {
              const key = DB_KEYS[name] || 'lte_' + name;
              const data = getDB(key);
              const filtered = data.filter(d => {
                if (op === '==') return d[field] === value;
                return true;
              });
              resolve({
                forEach(callback) {
                  filtered.forEach(doc => callback({ id: doc.id, data: () => doc }));
                }
              });
            });
          }
        };
      },
      
      get() {
        return new Promise(resolve => {
          const key = DB_KEYS[name] || 'lte_' + name;
          const data = getDB(key);
          resolve({
            forEach(callback) {
              data.forEach(doc => callback({ id: doc.id, data: () => doc }));
            }
          });
        });
      }
    };
  },
  
  enablePersistence() {
    return Promise.resolve();
  }
};

window.firebase = {
  initializeApp: () => ({ Firestore: MockFirestore, Auth: MockAuth }),
  auth: () => MockAuth,
  firestore: () => MockFirestore
};

function seedUsers() {
  const users = getDB(DB_KEYS.users);
  if (users.length === 0) {
    setDB(DB_KEYS.users, []);
    console.log('✅ Usuários limpos (open code)');
  }
}

seedUsers();

console.log('🔥 Firebase MOCK loaded - OFFLINE MODE');