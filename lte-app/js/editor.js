'use strict';
const Editor = (() => {
  let _currentReport = null;
  let _allOrdens     = [];

  function newReport() {
    _currentReport = {id:null};
    _clearForm();
    Upload?.clearPhotos?.();
    document.getElementById('f-data').value = new Date().toISOString().slice(0,10);
    document.getElementById('editor-sub').textContent = 'Novo Relatório';
    UI.showPage('page-editor');
  }

  async function edit(id) {
    UI.loader(true,'Carregando relatório...');
    try {
      const snap = await fbDB.collection('relatorios').doc(id).get();
      if (!snap.exists) { UI.toast('Não encontrado.','e'); return; }
      const r = {id:snap.id,...snap.data()};
      _currentReport = r;
      _fillForm(r);
      document.getElementById('editor-sub').textContent = `Editando — ${fDate(r.data)}`;
      await Upload?.loadPhotos?.(id);
      UI.showPage('page-editor');
    } catch(e) { UI.toast(e.message,'e'); }
    UI.loader(false);
  }

  async function view(id) {
    UI.loader(true,'Carregando...');
    try {
      const snap = await fbDB.collection('relatorios').doc(id).get();
      if (!snap.exists) { UI.toast('Não encontrado.','e'); return; }
      const r = {id:snap.id,...snap.data()};
      _currentReport = r;
      await Upload?.loadPhotos?.(id);
      Export.renderPreview({...r,byName:r.autorNome});
      UI.showPage('page-preview');
    } catch(e) { UI.toast(e.message,'e'); }
    UI.loader(false);
  }

  async function save() {
    const CU = Auth.getCU();
    if (!CU) { UI.toast('Sessão expirada.','e'); return; }
    UI.loader(true,'Salvando...');
    try {
      const body = {
        ..._collect(),
        userId:    CU.uid,
        autorNome: CU.nome,
        updatedAt: serverTS(),
      };
      const ordens = body.ordens;
      const batch  = fbDB.batch();
      await _processOrdersHistory(ordens, batch, _currentReport?.id);

      if (_currentReport?.id) {
        batch.update(fbDB.collection('relatorios').doc(_currentReport.id), body);
        await batch.commit();
        await Upload?.savePhotos?.(_currentReport.id);
        UI.toast('Relatório atualizado!','s');
      } else {
        body.createdAt = serverTS();
        await batch.commit();
        const ref = await fbDB.collection('relatorios').add(body);
        _currentReport = {id:ref.id,...body};
        await Upload?.savePhotos?.(ref.id);
        UI.toast('Relatório salvo!','s');
      }
      Dashboard.renderStats();
    } catch(e) { UI.toast('Erro: '+e.message,'e'); console.error(e); }
    UI.loader(false);
  }

  async function preview() { await save(); Export.renderPreview({..._collect(),byName:Auth.getCU()?.nome}); UI.showPage('page-preview'); }

  async function _processOrdersHistory(ordens, batch, relId) {
    for (const o of ordens) {
      if (!o.ordemId||!o.status) continue;
      try {
        const snap = await fbDB.collection('ordens').doc(o.ordemId).get();
        if (!snap.exists) continue;
        const ant = snap.data().statusAtual;
        if (ant===o.status) continue;
        batch.update(fbDB.collection('ordens').doc(o.ordemId),{statusAtual:o.status,updatedAt:serverTS()});
        batch.set(fbDB.collection('ordemHistorico').doc(),{
          ordemId:o.ordemId,numeroOrdem:o.numeroOrdem,
          statusAnterior:ant,statusNovo:o.status,
          alteradoPor:Auth.getCU()?.uid,nomeTecnico:Auth.getCU()?.nome,
          relatorioId:relId||'novo',createdAt:serverTS(),
        });
      } catch{}
    }
  }

  function _clearForm() {
    ['f-equipe','f-turma','f-dia','f-data','f-obs','v0','v1','v2','v3'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    buildOrdersTable([]); buildNumList('out-list',11); buildNumList('redel-list',4);
    buildNumList('mw-list',4); buildNumList('lte-list',4); buildNumList('clima-list',4);
  }
  function _fillForm(r) {
    document.getElementById('f-equipe').value=r.equipe||'';
    document.getElementById('f-turma').value=r.turma||'';
    document.getElementById('f-dia').value=r.dia||'';
    document.getElementById('f-data').value=r.data||'';
    document.getElementById('f-obs').value=r.obs||'';
    ['v0','v1','v2','v3'].forEach((id,i)=>{document.getElementById(id).value=(r.veiculos||[])[i]||'';});
    buildOrdersTable(r.ordens||[]);
    buildNumList('out-list',11,r.outras||[]);
    buildNumList('redel-list',4,r.redel||[]);
    buildNumList('mw-list',4,r.mw||[]);
    buildNumList('lte-list',4,r.lte||[]);
    buildNumList('clima-list',4,r.clima||[]);
  }
  function _collect() {
    return {
      equipe:  document.getElementById('f-equipe').value.trim(),
      turma:   document.getElementById('f-turma').value.trim(),
      dia:     document.getElementById('f-dia').value.trim(),
      data:    document.getElementById('f-data').value,
      obs:     document.getElementById('f-obs').value.trim().slice(0,1000),
      veiculos:['v0','v1','v2','v3'].map(id=>document.getElementById(id).value.trim()),
      outras:  getNumList('out-list'),redel:getNumList('redel-list'),
      mw:      getNumList('mw-list'),lte:getNumList('lte-list'),clima:getNumList('clima-list'),
      ordens:  getOrders(),
    };
  }

  function buildOrdersTable(orders=[]) {
    const tb=document.getElementById('ord-body'); tb.innerHTML='';
    const rows=[...orders]; while(rows.length<13)rows.push({});
    rows.forEach((o,i)=>_addOrdRow(o,i+1));
  }
  function addOrderRow() { const tb=document.getElementById('ord-body'); _addOrdRow({},tb.rows.length+1); }
  function _addOrdRow(o={},n) {
    const tb=document.getElementById('ord-body');
    const opts=STATUS_OPTS.map(s=>`<option value="${s}" ${(o.status||'')==s?'selected':''}>${s}</option>`).join('');
    const col=STATUS_COLOR[o.status]||STATUS_COLOR.default;
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="mono" style="color:var(--dim);font-size:11px;text-align:center;">${n}</td>
      <td><input type="text" value="${sanitize(o.numeroOrdem||o.ordem||o.numero_ordem||'')}" placeholder="Nº Ordem" data-id="${sanitize(o.ordemId||o.id||'')}" maxlength="20"></td>
      <td style="font-size:11px;color:var(--dim);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${sanitize(o.descricao||o.local||'')}">${sanitize(o.descricao||o.local||'')}</td>
      <td><select class="st-sel" style="border-left-color:${col};" onchange="this.style.borderLeftColor=STATUS_COLOR[this.value]||STATUS_COLOR.default"><option value="">— Status —</option>${opts}</select></td>
      <td style="text-align:center;"><button class="ord-del-btn" onclick="this.closest('tr').remove()"><i class="fa fa-times"></i></button></td>`;
    tb.appendChild(tr);
  }
  function getOrders() {
    return [...document.querySelectorAll('#ord-body tr')].map(tr=>({
      ordemId:     tr.cells[1]?.querySelector('input')?.dataset.id||'',
      numeroOrdem: (tr.cells[1]?.querySelector('input')?.value||'').trim(),
      descricao:   tr.cells[2]?.title||'',
      status:      tr.cells[3]?.querySelector('select')?.value||'',
    })).filter(o=>o.numeroOrdem);
  }
  function buildNumList(id,n,vals=[]) {
    const el=document.getElementById(id); if(!el)return; el.innerHTML='';
    for(let i=0;i<n;i++){
      const d=document.createElement('div'); d.className='num-item';
      d.innerHTML=`<span class="num-badge">${i+1}</span><input type="text" value="${sanitize(vals[i]||'')}" placeholder="—" maxlength="120">`;
      el.appendChild(d);
    }
  }
  function getNumList(id) { return [...document.querySelectorAll(`#${id} input`)].map(i=>i.value.trim()); }

  async function openOrdensModal() {
    UI.loader(true,'Buscando ordens...');
    try {
      const snap=await fbDB.collection('ordens').orderBy('createdAt','desc').get();
      _allOrdens=snap.docs.map(d=>({id:d.id,...d.data()}));
      UI.loader(false);
      if(!_allOrdens.length){UI.toast('Nenhuma ordem no banco. Admin deve fazer upload do PCM.','w');return;}
      _showOrdensModal(_allOrdens);
    } catch(e){UI.toast(e.message,'e');UI.loader(false);}
  }

  function _showOrdensModal(ordens) {
    const rows=ordens.map((o,idx)=>{
      const sc=STATUS_COLOR[o.statusAtual]||STATUS_COLOR.default;
      return`<tr id="orow-${idx}" onclick="_toggleRow(${idx})">
        <td style="width:40px;text-align:center;"><input type="checkbox" class="cb-ord" id="cb-${idx}" onclick="event.stopPropagation();_updCount()"></td>
        <td class="td-ord">${sanitize(o.numeroOrdem)}</td>
        <td class="td-txt">${sanitize(o.descricao||'—')}</td>
        <td class="td-loc">${sanitize(o.localInstalacao||'—')}</td>
        <td><span class="tipo-badge tipo-${sanitize(o.tipo||'')}">${sanitize(o.tipo||'—')}</span></td>
        <td class="td-dt">${sanitize(o.dataProgramada||'—')}</td>
        <td><span style="font-size:11px;font-weight:700;color:${sc};">${sanitize(o.statusAtual||'Pendente')}</span></td>
        <td style="font-size:10px;color:var(--dim);">${sanitize(o.semana||'')}</td>
      </tr>`;
    }).join('');
    UI.openModal(`<div class="ord-modal">
      <div class="ord-modal-hdr">
        <div><h3 class="gradient-text"><i class="fa fa-database"></i> Ordens da Programação PCM</h3>
          <p style="font-size:11px;color:var(--dim);margin-top:2px;">${ordens.length} ordens disponíveis</p></div>
        <button class="btn btn-secondary btn-sm" onclick="UI.closeModal()"><i class="fa fa-times"></i></button>
      </div>
      <div class="ord-modal-toolbar">
        <button class="btn btn-secondary btn-sm" onclick="_selAll(true)"><i class="fa fa-check-square"></i> Todas</button>
        <button class="btn btn-secondary btn-sm" onclick="_selAll(false)"><i class="fa fa-square"></i> Nenhuma</button>
        <div class="search-wrap"><i class="fa fa-search search-icon"></i><input class="search-box" type="text" placeholder="Filtrar..." oninput="_filterModal(this.value)" style="width:220px;"></div>
        <span class="sel-count" id="sel-count">0 selecionadas</span>
      </div>
      <div class="ord-modal-body"><div style="overflow-x:auto;">
        <table class="ord-sel-table">
          <thead><tr><th>✔</th><th>Nº Ordem</th><th>Descrição</th><th>Local</th><th>Tipo</th><th>Data Prog.</th><th>Status</th><th>Semana</th></tr></thead>
          <tbody id="osel-body">${rows}</tbody>
        </table>
      </div></div>
      <div class="ord-modal-ftr">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="_confirmSel()"><i class="fa fa-plus-circle"></i> Adicionar</button>
      </div>
    </div>`,true);
    _updCount();
  }

  window._toggleRow=(idx)=>{const cb=document.getElementById(`cb-${idx}`),tr=document.getElementById(`orow-${idx}`);if(!cb||tr.style.display==='none')return;cb.checked=!cb.checked;tr.classList.toggle('sel-row',cb.checked);_updCount();};
  window._selAll=(v)=>{document.querySelectorAll('.cb-ord').forEach(cb=>{const tr=cb.closest('tr');if(tr&&tr.style.display!=='none'){cb.checked=v;tr.classList.toggle('sel-row',v);}});_updCount();};
  window._updCount=()=>{const n=document.querySelectorAll('.cb-ord:checked').length;const el=document.getElementById('sel-count');if(el)el.textContent=`${n} selecionada${n!==1?'s':''}`;};
  window._filterModal=(q)=>{const l=q.toLowerCase();document.querySelectorAll('#osel-body tr').forEach(tr=>{tr.style.display=(!q||tr.textContent.toLowerCase().includes(l))?'':'none';});_updCount();};
  window._confirmSel=()=>{
    const checked=[...document.querySelectorAll('.cb-ord:checked')];
    if(!checked.length){UI.toast('Nenhuma ordem selecionada.','w');return;}
    const sel=checked.map(cb=>_allOrdens[parseInt(cb.id.replace('cb-',''))]).filter(Boolean);
    const existing=getOrders();const exNums=new Set(existing.map(o=>o.numeroOrdem));
    const toAdd=sel.filter(o=>!exNums.has(o.numeroOrdem));
    buildOrdersTable([...existing,...toAdd.map(o=>({id:o.id,ordemId:o.id,numeroOrdem:o.numeroOrdem,descricao:o.descricao||o.localInstalacao||'',local:o.localInstalacao||'',status:o.statusAtual||''}))]);
    UI.closeModal();
    UI.toast(`${toAdd.length} ordem(s) adicionada(s)!`,'s');
    if(toAdd.length<sel.length)UI.toast(`${sel.length-toAdd.length} duplicada(s) ignorada(s).`,'w');
  };

  // expose _collect for export.js
  Editor._collect = _collect;

  return {newReport,edit,view,save,preview,addOrderRow,openOrdensModal,buildOrdersTable,buildNumList,getNumList,getOrders,getCurrentReport:()=>_currentReport};
})();
window.buildOrdersTable=Editor.buildOrdersTable;
window.buildNumList=Editor.buildNumList;
window.getNumList=Editor.getNumList;
window.getOrders=Editor.getOrders;
