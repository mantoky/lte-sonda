'use strict';
const Admin = (() => {
  let _ordensCache = [];

  /* ── Users ──────────────────────────────── */
  async function renderUsers() {
    const el=document.getElementById('users-list'); if(!el)return;
    try {
      const snap=await fbDB.collection('users').get();
      const users=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
      if(!users.length){el.innerHTML=UI.emptyState('fa-users','Nenhum usuário.');return;}
      el.innerHTML=users.map(u=>`
        <div class="user-row">
          <div class="uava">${(u.nome||'?')[0].toUpperCase()}</div>
          <div class="u-info"><div class="u-name">${sanitize(u.nome)}</div><div class="u-email">${sanitize(u.email||'—')}</div></div>
          <span class="u-tag ${u.perfil==='ADMINISTRADOR'?'tag-admin':'tag-user'}">${u.perfil==='ADMINISTRADOR'?'Admin':'User'}</span>
          <span class="u-status ${u.ativo?'ok':'err'}">${u.ativo?'● Ativo':'○ Inativo'}</span>
          <div class="u-actions">
            <button class="btn btn-secondary btn-xs" onclick="Admin.openEditUser('${u.id}')"><i class="fa fa-pencil-alt"></i></button>
            <button class="btn btn-${u.ativo?'warning':'success'} btn-xs" onclick="Admin.toggleUser('${u.id}',${!u.ativo})">
              <i class="fa fa-${u.ativo?'ban':'check'}"></i>
            </button>
          </div>
        </div>`).join('');
    } catch(e){el.innerHTML=`<div class="err-state">${e.message}</div>`;}
  }

  function openAddUser() {
    UI.openModal(`<h3 class="gradient-text"><i class="fa fa-user-plus"></i> Adicionar Usuário</h3>
      <div class="fgroup"><label>Nome Completo</label><input id="nu-nome" type="text" maxlength="60"></div>
      <div class="fgroup"><label>E-mail Vale (@vale.com)</label><input id="nu-email" type="email" maxlength="80"></div>
      <div class="fgroup"><label>Telefone</label><input id="nu-tel" type="tel" maxlength="20"></div>
      <div class="fgroup"><label>Perfil</label>
        <select id="nu-perfil"><option value="USER">Usuário</option><option value="ADMINISTRADOR">Administrador</option></select>
      </div>
      <div class="fgroup"><label>Senha Inicial</label><input id="nu-pass" type="text" value="${DEFAULT_PASS}" maxlength="30"></div>
      <div class="mbtns">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Admin.createUser()"><i class="fa fa-save"></i> Criar Usuário</button>
      </div>`);
  }

  async function createUser() {
    const nome=document.getElementById('nu-nome')?.value?.trim();
    const email=document.getElementById('nu-email')?.value?.trim();
    const tel=document.getElementById('nu-tel')?.value?.trim();
    const perfil=document.getElementById('nu-perfil')?.value;
    const pass=document.getElementById('nu-pass')?.value?.trim();
    if(!nome||!email||!pass){UI.toast('Preencha nome, e-mail e senha.','w');return;}
    UI.loader(true,'Criando usuário...');
    try {
      const resp=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`,
        {method:'POST',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({email,password:pass,returnSecureToken:false})});
      const data=await resp.json();
      if(data.error)throw new Error(data.error.message);
      await fbDB.collection('users').doc(data.localId).set({nome,email,tel:tel||'',perfil,empresa:'SONDA',ativo:true,createdAt:serverTS()});
      UI.closeModal();UI.toast('Usuário criado!','s');renderUsers();
    } catch(e){UI.toast('Erro: '+e.message,'e');}
    UI.loader(false);
  }

  async function openEditUser(id) {
    const snap=await fbDB.collection('users').doc(id).get(); if(!snap.exists)return;
    const u=snap.data();
    UI.openModal(`<h3 class="gradient-text"><i class="fa fa-user-edit"></i> Editar Usuário</h3>
      <div class="fgroup"><label>Nome</label><input id="eu-nome" type="text" value="${sanitize(u.nome)}" maxlength="60"></div>
      <div class="fgroup"><label>Telefone</label><input id="eu-tel" type="tel" value="${sanitize(u.tel||'')}" maxlength="20"></div>
      <div class="fgroup"><label>Perfil</label>
        <select id="eu-perfil"><option value="USER" ${u.perfil==='USER'?'selected':''}>Usuário</option><option value="ADMINISTRADOR" ${u.perfil==='ADMINISTRADOR'?'selected':''}>Administrador</option></select>
      </div>
      <div class="mbtns">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Admin._saveEditUser('${id}')"><i class="fa fa-save"></i> Salvar</button>
      </div>`);
  }

  async function _saveEditUser(id) {
    const nome=document.getElementById('eu-nome')?.value?.trim();
    const tel=document.getElementById('eu-tel')?.value?.trim();
    const perfil=document.getElementById('eu-perfil')?.value;
    if(!nome){UI.toast('Nome obrigatório.','w');return;}
    UI.loader(true);
    try{await fbDB.collection('users').doc(id).update({nome,tel:tel||'',perfil});UI.closeModal();UI.toast('Usuário atualizado!','s');renderUsers();}
    catch(e){UI.toast(e.message,'e');}
    UI.loader(false);
  }

  async function toggleUser(id,ativo) {
    if(!UI.confirm(`${ativo?'Reativar':'Desativar'} este usuário?`))return;
    try{await fbDB.collection('users').doc(id).update({ativo});UI.toast(ativo?'Usuário ativado.':'Usuário desativado.','w');renderUsers();}
    catch(e){UI.toast(e.message,'e');}
  }

  /* ── Prog PCM ────────────────────────────── */
  async function renderProgs() {
    const el=document.getElementById('prog-list'); if(!el)return;
    try {
      const snap=await fbDB.collection('programacoes').orderBy('createdAt','desc').limit(20).get();
      if(!snap.size){el.innerHTML=UI.emptyState('fa-file-excel','Nenhuma programação.');return;}
      el.innerHTML=snap.docs.map(d=>{const p=d.data();return`
        <div class="prog-card">
          <div class="prog-info">
            <div class="prog-title"><i class="fa fa-file-excel" style="color:#21a366;"></i> ${sanitize(p.semana)} · ${sanitize(p.equipe)}</div>
            <div class="prog-meta">📋 ${p.totalOrdens||0} ordens · 👤 ${sanitize(p.uploadedByNome)} · 🕐 ${sanitize(p.createdAtStr||'')}</div>
          </div>
          <button class="btn btn-danger btn-xs" onclick="Admin.deleteProg('${d.id}')"><i class="fa fa-trash"></i></button>
        </div>`;}).join('');
    } catch(e){el.innerHTML=`<div class="err-state">${e.message}</div>`;}
  }

  async function uploadProg(input) {
    const file=input.files[0]; if(!file)return;
    const semana=document.getElementById('prog-semana')?.value?.trim();
    const equipe=document.getElementById('prog-equipe')?.value?.trim();
    if(!semana||!equipe){UI.toast('Preencha semana e equipe antes do upload.','w');input.value='';return;}
    UI.loader(true,'Processando Excel PCM...');
    try {
      const buffer=await file.arrayBuffer();
      const uint8=new Uint8Array(buffer);
      let wb;
      try {
        wb=XLSX.read(uint8,{type:'array'});
      } catch(readErr) {
        console.error('XLSX read error:',readErr);
        if(readErr.message?.includes('uint8')) {
          wb=XLSX.read(buffer,{type:'buffer'});
        } else {
          throw new Error('Arquivo Excel inválido ou corrompido: '+readErr.message);
        }
      }
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      const HDR_KEYS=['nr_ordem','tipo','descricao','local','data','status'];
      let hdrIdx=-1;
      for(let i=0;i<Math.min(rows.length,15);i++){
        const r=rows[i].map(c=>String(c).toLowerCase());
        if(r.some(c=>c.includes('ordem')||c.includes('numero'))){hdrIdx=i;break;}
      }
      const ordens=[];
      const startRow=hdrIdx>=0?hdrIdx+1:0;
      for(let i=startRow;i<rows.length;i++){
        const row=rows[i];
        const num=String(row[hdrIdx>=0?row.findIndex((_,ci)=>String(rows[hdrIdx][ci]||'').toLowerCase().includes('ordem'))||0:0]||'').trim();
        if(!num||num.length<5)continue;
        ordens.push({
          numeroOrdem:    num,
          tipo:           String(row[1]||'').trim(),
          descricao:      String(row[2]||'').trim(),
          localInstalacao:String(row[3]||'').trim(),
          dataProgramada: String(row[4]||'').trim(),
          statusAtual:    String(row[5]||'Pendente de execução').trim(),
          semana,equipe,createdAt:serverTS(),
        });
      }
      if(!ordens.length){UI.toast('Nenhuma ordem encontrada no arquivo.','w');UI.loader(false);return;}
      const CHUNK=400;const progRef=fbDB.collection('programacoes').doc();
      const batch=fbDB.batch();
      batch.set(progRef,{semana,equipe,arquivo:file.name,totalOrdens:ordens.length,uploadedBy:Auth.getCU()?.uid,uploadedByNome:Auth.getCU()?.nome,createdAt:serverTS(),createdAtStr:new Date().toLocaleString('pt-BR')});
      for(let i=0;i<ordens.length;i+=CHUNK){
        const b2=fbDB.batch();
        ordens.slice(i,i+CHUNK).forEach(o=>{b2.set(fbDB.collection('ordens').doc(),{...o,progId:progRef.id});});
        await b2.commit();
      }
      await batch.commit();
      UI.toast(`✅ ${ordens.length} ordens importadas!`,'s');
      input.value='';renderProgs();
    } catch(e){UI.toast('Erro: '+e.message,'e');console.error(e);}
    UI.loader(false);
  }

  async function deleteProg(id) {
    if(!UI.confirm('Excluir esta programação e suas ordens?'))return;
    UI.loader(true,'Excluindo...');
    try{
      const snap=await fbDB.collection('ordens').where('progId','==',id).get();
      const b=fbDB.batch();
      snap.docs.forEach(d=>b.delete(d.ref));
      b.delete(fbDB.collection('programacoes').doc(id));
      await b.commit();UI.toast('Programação excluída.','w');renderProgs();
    }catch(e){UI.toast(e.message,'e');}
    UI.loader(false);
  }

  /* ── Ordens ──────────────────────────────── */
  async function renderOrdens(q='') {
    const el=document.getElementById('ordens-list'); if(!el)return;
    el.innerHTML=`<div class="empty-state"><i class="fa fa-spinner fa-spin"></i><p>Carregando...</p></div>`;
    try {
      const snap=await fbDB.collection('ordens').orderBy('createdAt','desc').limit(200).get();
      _ordensCache=snap.docs.map(d=>({id:d.id,...d.data()}));
      _renderOrdensTable(q);
    } catch(e){el.innerHTML=`<div class="err-state">${e.message}</div>`;}
  }

  function _renderOrdensTable(q='') {
    const el=document.getElementById('ordens-list'); if(!el)return;
    let list=_ordensCache;
    if(q){const l=q.toLowerCase();list=list.filter(o=>JSON.stringify(o).toLowerCase().includes(l));}
    if(!list.length){el.innerHTML=UI.emptyState('fa-list-ol','Nenhuma ordem.');return;}
    el.innerHTML=`<div style="overflow-x:auto;"><table class="admin-table">
      <thead><tr><th>Nº Ordem</th><th>Descrição</th><th>Local</th><th>Tipo</th><th>Data Prog.</th><th>Status</th><th>Semana</th></tr></thead>
      <tbody>${list.map(o=>{const sc=STATUS_COLOR[o.statusAtual]||STATUS_COLOR.default;return`<tr>
        <td class="td-ord">${sanitize(o.numeroOrdem)}</td>
        <td class="td-txt">${sanitize(o.descricao||'—')}</td>
        <td class="td-loc">${sanitize(o.localInstalacao||'—')}</td>
        <td><span class="tipo-badge tipo-${sanitize(o.tipo||'')}">${sanitize(o.tipo||'—')}</span></td>
        <td style="font-size:11px;white-space:nowrap;">${sanitize(o.dataProgramada||'—')}</td>
        <td><span style="font-weight:700;font-size:11px;color:${sc};">${sanitize(o.statusAtual||'—')}</span></td>
        <td style="font-size:11px;color:var(--dim);">${sanitize(o.semana||'—')}</td>
      </tr>`}).join('')}</tbody></table></div>`;
  }

  /* ── All reports ─────────────────────────── */
  async function renderAllRpts() {
    const el=document.getElementById('admin-rpts'); if(!el)return;
    el.innerHTML=`<div class="empty-state"><i class="fa fa-spinner fa-spin"></i><p>Carregando...</p></div>`;
    try {
      const snap=await fbDB.collection('relatorios').orderBy('createdAt','desc').limit(100).get();
      if(!snap.size){el.innerHTML=UI.emptyState('fa-file-alt','Nenhum relatório.');return;}
      el.innerHTML=snap.docs.map(d=>{const r=d.data();return`
        <div class="report-card" onclick="Editor.view('${d.id}')">
          <div class="rc-info">
            <div class="rc-title"><i class="fa fa-file-alt"></i> ${sanitize(r.equipe||'—')} — Turma ${sanitize(r.turma||'?')} — ${fDate(r.data)}</div>
            <div class="rc-meta"><span>👤 ${sanitize(r.autorNome||'?')}</span></div>
          </div>
          <div class="rc-actions" onclick="event.stopPropagation()">
            <button class="btn btn-success btn-xs" onclick="Editor.view('${d.id}')"><i class="fa fa-eye"></i></button>
            <button class="btn btn-danger btn-xs" onclick="deleteReport('${d.id}')"><i class="fa fa-trash"></i></button>
          </div>
        </div>`;}).join('');
    } catch(e){el.innerHTML=`<div class="err-state">${e.message}</div>`;}
  }

  return { renderUsers, openAddUser, createUser, openEditUser, _saveEditUser, toggleUser, renderProgs, uploadProg, deleteProg, renderOrdens, renderAllRpts };
})();
