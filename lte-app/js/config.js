'use strict';

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDpxZgoYXz4lFfsJfU30pSgA3no7U29s2I",
  authDomain:        "reportlte-c5109.firebaseapp.com",
  projectId:         "reportlte-c5109",
  storageBucket:     "reportlte-c5109.firebasestorage.app",
  messagingSenderId: "130839880467",
  appId:             "1:130839880467:web:6f578a9a2e88cb62ca70e6",
  measurementId:     "G-XSC3RZHH7K"
};

/* ── Status das ordens ───────────────────────── */
const STATUS_OPTS = [
  'Executada','Pendente de execução','Pendente de encerramento técnico',
  'Falta HH','Falta de material','Cancelada','Antecipada',
  'Em execução','Reprogramada','Bloqueio de acesso','Falta de liberação',
];
const STATUS_COLOR = {
  'Executada':'#00e676','Pendente de execução':'#ffab00',
  'Pendente de encerramento técnico':'#ff9800','Falta HH':'#ff6b6b',
  'Falta de material':'#f06292','Cancelada':'#6888a8','Antecipada':'#a78bfa',
  'Em execução':'#29b6f6','Reprogramada':'#80cbc4',
  'Bloqueio de acesso':'#ef9a9a','Falta de liberação':'#ce93d8','default':'#6888a8',
};

/* ── Agenda ──────────────────────────────────── */
const IMPORTANCIA_OPTS = ['Crítico','Importante','Moderado'];
const IMPORTANCIA_COLOR = { 'Crítico':'#ff1744','Importante':'#ffab00','Moderado':'#00c6ff' };

const SCALE_PATTERNS = {
  '1x1':   { work:1,  rest:1,  label:'1×1 — 1 dia trabalha, 1 folga'   },
  '3x3':   { work:3,  rest:3,  label:'3×3 — 3 dias trabalha, 3 folga'  },
  '4x2':   { work:4,  rest:2,  label:'4×2 — 4 dias trabalha, 2 folga'  },
  '5x2':   { work:5,  rest:2,  label:'5×2 — Seg a Sex (padrão)'        },
  '7x7':   { work:7,  rest:7,  label:'7×7 — 7 dias trabalha, 7 folga'  },
  '14x14': { work:14, rest:14, label:'14×14 — 14 trabalha, 14 folga'   },
  '12x36h':{ work:1,  rest:2,  label:'12×36h — aprox. 1 dia/2 folga'   },
};

const TURMAS = ['A','B','C','D','ADM'];
const TURMA_COLOR = {
  'A':  { bg:'#1565C0', light:'#E3F2FD', text:'#1565C0' },
  'B':  { bg:'#2E7D32', light:'#E8F5E9', text:'#2E7D32' },
  'C':  { bg:'#F57F17', light:'#FFF8E1', text:'#E65100' },
  'D':  { bg:'#BF360C', light:'#FBE9E7', text:'#BF360C' },
  'ADM':{ bg:'#4527A0', light:'#EDE7F6', text:'#4527A0' },
};

const AUSENCIA_TIPOS = ['Folga','Férias','Licença Médica','Abono','Outro'];

/* ── Seed de usuários (para primeiro setup) ──── */
const SEED_USERS = [];
const DEFAULT_PASS = '';

/* ── Globals Firebase ────────────────────────── */
let fbApp=null, fbDB=null, fbAuth=null;

function initFirebase() {
  if (FIREBASE_CONFIG.apiKey.includes('COLE_AQUI')) {
    document.getElementById('config-banner').style.display='block';
    return false;
  }
  try {
    fbApp  = firebase.initializeApp(FIREBASE_CONFIG);
    fbDB   = firebase.firestore();
    fbAuth = firebase.auth();
    fbDB.enablePersistence({synchronizeTabs:true}).catch(()=>{});
    return true;
  } catch(e) { console.error('Firebase init:',e); return false; }
}

function sanitize(s) {
  return String(s||'').trim()
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}
function fDate(d) {
  if(!d)return'—'; const p=d.split('-');
  return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:d;
}
function serverTS() { return firebase.firestore.FieldValue.serverTimestamp(); }
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
