'use strict';
const Dashboard = (() => {
  let _unsub = null;

  function render() { renderStats(); renderReports(); }

  async function renderStats() {
    const CU = Auth.getCU(); if (!CU) return;
    const isAdmin = CU.perfil === 'ADMINISTRADOR';
    const grid = document.getElementById('stats-grid'); if (!grid) return;
    try {
      const [rSnap, oSnap] = await Promise.all([
        isAdmin ? fbDB.collection('relatorios').get()
                : fbDB.collection('relatorios').where('userId','==',CU.uid).get(),
        fbDB.collection('ordens').get(),
      ]);
      const total = rSnap.size;
      const today = new Date().toISOString().slice(0,10);
      const todayR = rSnap.docs.filter(d=>d.data().data===today).length;
      const ordens = oSnap.docs.map(d=>d.data());
      const pend   = ordens.filter(o=>!['Executada','Cancelada','Antecipada'].includes(o.statusAtual)).length;
      const exec   = ordens.filter(o=>o.statusAtual==='Executada').length;
      grid.innerHTML = `
        <div class="stat-card"><div class="s-ico accent">📄</div><div class="s-val">${total}</div><div class="s-lbl">Relatórios</div></div>
        <div class="stat-card"><div class="s-ico accent">📅</div><div class="s-val">${todayR}</div><div class="s-lbl">Hoje</div></div>
        <div class="stat-card"><div class="s-ico accent">📋</div><div class="s-val">${ordens.length}</div><div class="s-lbl">Ordens BD</div></div>
        <div class="stat-card warn"><div class="s-ico warn">⏰</div><div class="s-val warn">${pend}</div><div class="s-lbl">Pendentes</div></div>
        <div class="stat-card ok"><div class="s-ico ok">✅</div><div class="s-val ok">${exec}</div><div class="s-lbl">Executadas</div></div>
        ${isAdmin?`<div class="stat-card"><div class="s-ico accent">👥</div><div class="s-val">14</div><div class="s-lbl">Usuários</div></div>`:''}`;
    } catch(e) { console.error(e); }
  }

  function renderReports(q='') {
    const CU = Auth.getCU(); if (!CU) return;
    const isAdmin = CU.perfil === 'ADMINISTRADOR';
    const list = document.getElementById('reports-list'); if (!list) return;
    if (_unsub) _unsub();
    let query = fbDB.collection('relatorios').orderBy('createdAt','desc').limit(60);
    if (!isAdmin) query = query.where('userId','==',CU.uid);
    _unsub = query.onSnapshot(snap => {
      let docs = snap.docs.map(d=>({id:d.id,...d.data()}));
      if (q) { const l=q.toLowerCase(); docs=docs.filter(d=>(d.equipe||'').toLowerCase().includes(l)||(d.turma||'').toLowerCase().includes(l)||(d.data||'').includes(l)); }
      if (!docs.length) { list.innerHTML=UI.emptyState('fa-file-alt','Nenhum relatório encontrado.'); return; }
      list.innerHTML = docs.map(r=>`
        <div class="report-card" onclick="Editor.view('${r.id}')">
          <div class="rc-info">
            <div class="rc-title"><i class="fa fa-file-alt"></i> ${sanitize(r.equipe||'—')} — Turma ${sanitize(r.turma||'?')} — Dia ${sanitize(r.dia||'?')}</div>
            <div class="rc-meta"><span>📅 ${fDate(r.data)}</span><span>👤 ${sanitize(r.autorNome||'?')}</span><span class="rc-ordens">${(r.ordens||[]).filter(o=>o.numeroOrdem).length} ordem(ns)</span></div>
          </div>
          <div class="rc-actions" onclick="event.stopPropagation()">
            <button class="btn btn-secondary btn-xs" onclick="Editor.edit('${r.id}')" title="Editar"><i class="fa fa-pencil-alt"></i></button>
            <button class="btn btn-success btn-xs" onclick="Editor.view('${r.id}')" title="Visualizar"><i class="fa fa-eye"></i></button>
            ${isAdmin||r.userId===CU.uid?`<button class="btn btn-danger btn-xs" onclick="deleteReport('${r.id}')" title="Excluir"><i class="fa fa-trash"></i></button>`:''}
          </div>
        </div>`).join('');
    }, e=>{ list.innerHTML=UI.emptyState('fa-exclamation-triangle',e.message); });
  }

  function filterReports(q) { renderReports(q); }
  function unsubscribe() { if(_unsub){_unsub();_unsub=null;} }

  window.deleteReport = async(id)=>{
    if(!UI.confirm('Excluir este relatório?'))return;
    try{await fbDB.collection('relatorios').doc(id).delete();UI.toast('Excluído.','w');renderStats();}
    catch(e){UI.toast(e.message,'e');}
  };

  return { render, renderStats, renderReports, filterReports, unsubscribe };
})();
