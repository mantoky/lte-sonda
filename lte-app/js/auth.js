'use strict';
const Auth = (() => {
  let _CU = null;
  function getCU() { return _CU; }

  /* ── Carrega select de login (sem auth) ──────── */
  async function buildUserSelect() {
    const sel = document.getElementById('lg-user');
    sel.innerHTML = '<option value="">Carregando...</option>';
    try {
      // Lista pública (regras permitem sem auth)
      const snap = await fbDB.collection('users')
        .where('ativo','==',true).get();

      const users = [];
      snap.forEach(d => users.push({id:d.id,...d.data()}));
      users.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));

      if (!users.length) {
        sel.innerHTML = '<option value="">Nenhum usuário cadastrado</option>';
        document.getElementById('setup-btn-wrap').style.display = 'block';
        return;
      }
      sel.innerHTML = '<option value="">Selecione seu nome...</option>';
      users.forEach(u => {
        const o = document.createElement('option');
        o.value = u.id; o.textContent = sanitize(u.nome); sel.appendChild(o);
      });
      document.getElementById('setup-btn-wrap').style.display = 'none';
    } catch(e) {
      sel.innerHTML = '<option value="">Erro ao carregar</option>';
      document.getElementById('setup-btn-wrap').style.display = 'block';
      console.error('buildUserSelect:',e);
    }
  }

  /* ── Primeiro setup — cria todos os usuários ── */
  async function setupSystem() {
    if (!confirm(`Criar ${SEED_USERS.length} usuários no Firebase?\nSenha padrão: ${DEFAULT_PASS}`)) return;
    UI.loader(true,'Criando usuários...');
    let ok=0, erros=[];
    for (const u of SEED_USERS) {
      try {
        const resp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`,
          { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({email:u.email, password:DEFAULT_PASS, returnSecureToken:false}) }
        );
        const data = await resp.json();
        if (data.error) { erros.push(`${u.nome}: ${data.error.message}`); continue; }
        await fbDB.collection('users').doc(data.localId).set({
          nome:u.nome, email:u.email, tel:u.tel||'',
          perfil:u.perfil, empresa:'SONDA', ativo:true,
          createdAt: serverTS(),
        });
        ok++;
      } catch(e) { erros.push(`${u.nome}: ${e.message}`); }
    }
    UI.loader(false);
    if (erros.length) {
      UI.toast(`${ok} criados. Erros: ${erros.length} (ver console)`,'w');
      console.warn('Erros setup:',erros);
    } else {
      UI.toast(`✅ ${ok} usuários criados com sucesso!`,'s');
    }
    await buildUserSelect();
  }

  /* ── Login ───────────────────────────────────── */
  async function login() {
    const uid  = document.getElementById('lg-user').value;
    const pass = document.getElementById('lg-pass').value;
    const err  = document.getElementById('lg-err');
    err.style.display='none';
    if (!uid)  { showErr('⚠️ Selecione um usuário'); return; }
    if (!pass) { showErr('⚠️ Digite a senha');        return; }
    if (pass.length < 6) { showErr('⚠️ Senha muito curta'); return; }
    UI.loader(true,'Autenticando...');
    try {
      const doc = await fbDB.collection('users').doc(uid).get();
      if (!doc.exists || !doc.data().ativo) throw new Error('Usuário não encontrado ou inativo');
      await fbAuth.signInWithEmailAndPassword(doc.data().email, pass);
    } catch(e) {
      showErr('❌ ' + mapAuthError(e.code || e.message));
      UI.loader(false);
    }
  }

  function logout() {
    Dashboard.unsubscribe();
    _CU = null;
    fbAuth.signOut();
  }

  function startAuthListener() {
    fbAuth.onAuthStateChanged(async fireUser => {
      UI.loader(false);
      if (fireUser) {
        try {
          const doc = await fbDB.collection('users').doc(fireUser.uid).get();
          if (doc.exists && doc.data().ativo) {
            _CU = {uid:fireUser.uid,...doc.data()};
            UI.setUserInfo(_CU);
            UI.showPage('page-dashboard');
          } else { await fbAuth.signOut(); }
        } catch(e) { console.error(e); UI.showPage('page-login'); }
      } else {
        _CU = null;
        buildUserSelect();
        UI.showPage('page-login');
      }
    });
  }

  function showErr(msg) {
    const el=document.getElementById('lg-err');
    el.textContent=msg; el.style.display='block';
  }
  function mapAuthError(c) {
    const m={
      'auth/user-not-found':'Usuário não encontrado.',
      'auth/wrong-password':'Senha incorreta.',
      'auth/too-many-requests':'Muitas tentativas. Aguarde.',
      'auth/network-request-failed':'Sem conexão com a internet.',
      'auth/invalid-email':'E-mail inválido.',
      'auth/invalid-credential':'Credenciais inválidas.',
    };
    return m[c]||'Usuário ou senha inválidos.';
  }

  return { login, logout, startAuthListener, buildUserSelect, setupSystem, getCU };
})();
