'use strict';

const Agenda = (() => {
  const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DAYS_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  let _state = {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    eventos: [], escalas: [], ausencias: [],
    unsub: [],
  };

  /* ══════════════════════════════════════════
     ACTION SHEET
  ══════════════════════════════════════════ */
  function showActionSheet() {
    UI.openModal(`
      <div style="text-align:center;margin-bottom:18px;">
        <div style="font-size:28px;margin-bottom:6px;">📅</div>
        <h3 class="gradient-text" style="font-size:18px;font-weight:800;">Agenda</h3>
        <p style="font-size:12px;color:var(--dim);margin-top:4px;">O que deseja fazer?</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn btn-secondary agenda-action-btn" onclick="Agenda.openCreateEvent();UI.closeModal()">
          <span style="font-size:18px;">📝</span>
          <div style="text-align:left;flex:1;">
            <div style="font-weight:700;">Criar Evento</div>
            <div style="font-size:11px;color:var(--dim);">Adicionar evento com nível de importância</div>
          </div>
          <i class="fa fa-chevron-right" style="color:var(--dim);font-size:12px;"></i>
        </button>
        <button class="btn btn-secondary agenda-action-btn" onclick="Agenda.openCreateEscala();UI.closeModal()">
          <span style="font-size:18px;">🔄</span>
          <div style="text-align:left;flex:1;">
            <div style="font-weight:700;">Criar Escala de Trabalho</div>
            <div style="font-size:11px;color:var(--dim);">7×7, 5×2, 3×3 e outras rotações</div>
          </div>
          <i class="fa fa-chevron-right" style="color:var(--dim);font-size:12px;"></i>
        </button>
        <button class="btn btn-secondary agenda-action-btn" onclick="Agenda.openCreateAusencia();UI.closeModal()">
          <span style="font-size:18px;">🚫</span>
          <div style="text-align:left;flex:1;">
            <div style="font-weight:700;">Registrar Ausência</div>
            <div style="font-size:11px;color:var(--dim);">Folga, férias, licença</div>
          </div>
          <i class="fa fa-chevron-right" style="color:var(--dim);font-size:12px;"></i>
        </button>
        <button class="btn btn-primary btn-full" onclick="UI.closeModal();UI.showPage('page-agenda')" style="margin-top:4px;">
          <i class="fa fa-calendar-alt"></i> Ver Calendário Completo
        </button>
      </div>
      <div class="mbtns" style="margin-top:10px;">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Fechar</button>
      </div>`);
  }

  /* ══════════════════════════════════════════
     CRIAR EVENTO
  ══════════════════════════════════════════ */
  function openCreateEvent(preDate='') {
    const today = new Date().toISOString().slice(0,10);
    const impoOpts = IMPORTANCIA_OPTS.map(i =>
      `<option value="${i}">${i}</option>`
    ).join('');
    UI.openModal(`
      <h3 class="gradient-text"><i class="fa fa-calendar-plus"></i> Criar Evento</h3>
      <div class="fgroup"><label>Título do Evento</label>
        <input id="ev-titulo" type="text" placeholder="Ex: Reunião de alinhamento" maxlength="100">
      </div>
      <div class="fgroup"><label>Data</label>
        <input id="ev-data" type="date" value="${preDate||today}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="fgroup"><label>Hora início</label>
          <input id="ev-hora-ini" type="time" value="08:00">
        </div>
        <div class="fgroup"><label>Hora fim</label>
          <input id="ev-hora-fim" type="time" value="09:00">
        </div>
      </div>
      <div class="fgroup"><label>Grau de Importância</label>
        <select id="ev-importancia">${impoOpts}</select>
      </div>
      <div class="fgroup"><label>Descrição (opcional)</label>
        <textarea id="ev-desc" rows="2" placeholder="Detalhes do evento..." maxlength="300"></textarea>
      </div>
      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;">
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;">Compartilhar com a equipe?</div>
          <div style="font-size:11px;color:var(--dim);margin-top:2px;">Outros usuários poderão ver este evento</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="ev-compartilhar">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="mbtns">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Agenda.saveEvent()">
          <i class="fa fa-save"></i> Salvar Evento
        </button>
      </div>`);
  }

  async function saveEvent() {
    const CU = Auth.getCU();
    const titulo  = document.getElementById('ev-titulo')?.value?.trim();
    const data    = document.getElementById('ev-data')?.value;
    const imp     = document.getElementById('ev-importancia')?.value;
    const desc    = document.getElementById('ev-desc')?.value?.trim();
    const comp    = document.getElementById('ev-compartilhar')?.checked||false;
    const hIni    = document.getElementById('ev-hora-ini')?.value;
    const hFim    = document.getElementById('ev-hora-fim')?.value;
    if (!titulo||!data) { UI.toast('Título e data são obrigatórios.','w'); return; }
    UI.loader(true,'Salvando evento...');
    try {
      await fbDB.collection('eventos').add({
        titulo, data, horaInicio:hIni, horaFim:hFim,
        importancia:imp, descricao:desc||'',
        compartilhado:comp, userId:CU.uid, autorNome:CU.nome,
        createdAt:serverTS(),
      });
      UI.closeModal();
      UI.toast('Evento salvo!','s');
      if (document.getElementById('page-agenda')?.classList.contains('active')) {
        await loadData(); renderCalendar();
      }
    } catch(e) { UI.toast('Erro: '+e.message,'e'); }
    UI.loader(false);
  }

  async function deleteEvent(id) {
    if (!UI.confirm('Excluir este evento?')) return;
    try { await fbDB.collection('eventos').doc(id).delete(); UI.toast('Evento excluído.','w'); await loadData(); renderCalendar(); }
    catch(e) { UI.toast(e.message,'e'); }
  }

  /* ══════════════════════════════════════════
     CRIAR ESCALA
  ══════════════════════════════════════════ */
  function openCreateEscala() {
    const patternOpts = Object.entries(SCALE_PATTERNS).map(([k,v])=>
      `<option value="${k}">${v.label}</option>`).join('');
    const today = new Date().toISOString().slice(0,10);
    UI.openModal(`
      <h3 class="gradient-text"><i class="fa fa-sync-alt"></i> Criar Escala de Trabalho</h3>
      <div style="background:rgba(0,198,255,.06);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:var(--dim);">
        <i class="fa fa-info-circle" style="color:var(--accent);margin-right:6px;"></i>
        A data de início é o primeiro dia de trabalho da Turma A. As demais turmas são calculadas automaticamente.
      </div>
      <div class="fgroup"><label>Tipo de Rotação</label>
        <select id="esc-pattern">${patternOpts}</select>
      </div>
      <div class="fgroup"><label>Turma</label>
        <select id="esc-turma">
          ${TURMAS.map(t=>`<option value="${t}">Turma ${t}</option>`).join('')}
        </select>
      </div>
      <div class="fgroup"><label>Data de Início da Turma A</label>
        <input id="esc-inicio" type="date" value="${today}">
      </div>
      <div class="fgroup"><label>Descrição / Nome da Escala</label>
        <input id="esc-nome" type="text" placeholder="Ex: Escala Mina S11D — 2026" maxlength="80">
      </div>
      <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;padding:12px;margin-top:4px;">
        <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Offsets automáticos por turma</div>
        <div id="offset-preview" style="font-size:12px;color:var(--dim);"></div>
      </div>
      <div class="mbtns">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Agenda.saveEscala()">
          <i class="fa fa-save"></i> Salvar Escala
        </button>
      </div>`);

    // Live preview of offsets
    const updatePreview = () => {
      const pat = document.getElementById('esc-pattern')?.value;
      const p   = SCALE_PATTERNS[pat];
      if (!p) return;
      const cycle = p.work + p.rest;
      const offsets = TURMAS.filter(t=>t!=='ADM').map((t,i) => {
        const off = pat==='5x2' ? 0 : Math.round((cycle/4)*i);
        return `<span style="display:inline-flex;align-items:center;gap:5px;margin:3px 8px 3px 0;">
          <span style="background:${TURMA_COLOR[t].bg};color:#fff;border-radius:4px;padding:1px 7px;font-size:11px;font-weight:700;">${t}</span>
          +${off} dia${off!==1?'s':''}
        </span>`;
      }).join('');
      document.getElementById('offset-preview').innerHTML = offsets +
        `<span style="display:inline-flex;align-items:center;gap:5px;margin:3px 8px 3px 0;">
          <span style="background:${TURMA_COLOR['ADM'].bg};color:#fff;border-radius:4px;padding:1px 7px;font-size:11px;font-weight:700;">ADM</span>
          Seg-Sex
        </span>`;
    };
    setTimeout(() => {
      document.getElementById('esc-pattern')?.addEventListener('change', updatePreview);
      updatePreview();
    }, 50);
  }

  async function saveEscala() {
    const CU    = Auth.getCU();
    const pat   = document.getElementById('esc-pattern')?.value;
    const turma = document.getElementById('esc-turma')?.value;
    const ini   = document.getElementById('esc-inicio')?.value;
    const nome  = document.getElementById('esc-nome')?.value?.trim();
    if (!pat||!ini) { UI.toast('Preencha todos os campos.','w'); return; }
    const p     = SCALE_PATTERNS[pat];
    const cycle = p.work + p.rest;
    const offsets = {};
    TURMAS.filter(t=>t!=='ADM').forEach((t,i)=>{ offsets[t] = pat==='5x2'?0:Math.round((cycle/4)*i); });
    offsets['ADM'] = 0;
    UI.loader(true,'Salvando escala...');
    try {
      await fbDB.collection('escalas').add({
        nome: nome || `Escala ${pat} — ${turma}`,
        pattern: pat, turma, dataInicioA: ini,
        offsets, criadoPor: CU.uid, autorNome: CU.nome,
        createdAt: serverTS(),
      });
      UI.closeModal();
      UI.toast('Escala criada!','s');
      if (document.getElementById('page-agenda')?.classList.contains('active')) {
        await loadData(); renderCalendar();
      }
    } catch(e) { UI.toast('Erro: '+e.message,'e'); }
    UI.loader(false);
  }

  /* ══════════════════════════════════════════
     CRIAR AUSÊNCIA
  ══════════════════════════════════════════ */
  function openCreateAusencia() {
    const today = new Date().toISOString().slice(0,10);
    const tipoOpts = AUSENCIA_TIPOS.map(t=>`<option value="${t}">${t}</option>`).join('');
    UI.openModal(`
      <h3 class="gradient-text"><i class="fa fa-calendar-times"></i> Registrar Ausência</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="fgroup"><label>Data Início</label>
          <input id="aus-ini" type="date" value="${today}">
        </div>
        <div class="fgroup"><label>Data Fim</label>
          <input id="aus-fim" type="date" value="${today}">
        </div>
      </div>
      <div class="fgroup"><label>Tipo de Ausência</label>
        <select id="aus-tipo">${tipoOpts}</select>
      </div>
      <div class="fgroup"><label>Observação (opcional)</label>
        <textarea id="aus-obs" rows="2" placeholder="Detalhes..." maxlength="200"></textarea>
      </div>
      <div style="background:rgba(255,171,0,.08);border:1px solid rgba(255,171,0,.25);border-radius:10px;padding:11px;font-size:12px;color:var(--warn);margin-top:4px;">
        <i class="fa fa-info-circle" style="margin-right:6px;"></i>
        Todos os usuários podem criar ausências. Somente o Administrador pode excluí-las.
      </div>
      <div class="mbtns">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Agenda.saveAusencia()">
          <i class="fa fa-save"></i> Registrar
        </button>
      </div>`);
  }

  async function saveAusencia() {
    const CU   = Auth.getCU();
    const ini  = document.getElementById('aus-ini')?.value;
    const fim  = document.getElementById('aus-fim')?.value;
    const tipo = document.getElementById('aus-tipo')?.value;
    const obs  = document.getElementById('aus-obs')?.value?.trim();
    if (!ini||!fim) { UI.toast('Informe o período.','w'); return; }
    if (fim < ini)  { UI.toast('Data fim deve ser >= data início.','w'); return; }
    UI.loader(true,'Registrando ausência...');
    try {
      await fbDB.collection('ausencias').add({
        dataInicio:ini, dataFim:fim, tipo, obs:obs||'',
        userId:CU.uid, autorNome:CU.nome, createdAt:serverTS(),
      });
      UI.closeModal();
      UI.toast('Ausência registrada!','s');
      if (document.getElementById('page-agenda')?.classList.contains('active')) {
        await loadData(); renderCalendar();
      }
    } catch(e) { UI.toast('Erro: '+e.message,'e'); }
    UI.loader(false);
  }

  async function deleteAusencia(id) {
    const CU = Auth.getCU();
    if (CU.perfil !== 'ADMINISTRADOR') { UI.toast('Somente administradores podem excluir ausências.','e'); return; }
    if (!UI.confirm('Excluir este registro de ausência?')) return;
    try { await fbDB.collection('ausencias').doc(id).delete(); UI.toast('Ausência excluída.','w'); await loadData(); renderCalendar(); renderAbsenceDash(); }
    catch(e) { UI.toast(e.message,'e'); }
  }

  /* ══════════════════════════════════════════
     LOAD DATA
  ══════════════════════════════════════════ */
  async function loadData() {
    const CU = Auth.getCU(); if (!CU) return;
    try {
      const [evSnap, escSnap, ausSnap] = await Promise.all([
        fbDB.collection('eventos').get(),
        fbDB.collection('escalas').get(),
        fbDB.collection('ausencias').get(),
      ]);
      _state.eventos   = evSnap.docs.map(d=>({id:d.id,...d.data()}));
      _state.escalas   = escSnap.docs.map(d=>({id:d.id,...d.data()}));
      _state.ausencias = ausSnap.docs.map(d=>({id:d.id,...d.data()}));
    } catch(e) { console.error('Agenda loadData:',e); }
  }

  /* ══════════════════════════════════════════
     CALENDAR RENDER
  ══════════════════════════════════════════ */
  function renderCalendar() {
    const wrap = document.getElementById('agenda-cal-wrap');
    if (!wrap) return;
    const y = _state.year, m = _state.month;
    const monthLabel = `${MONTHS_PT[m]} ${y}`;
    document.getElementById('agenda-month-label').textContent = monthLabel;

    // Build schedule lookup
    const schedLookup = _buildSchedLookup(y, m);

    // Build events/absences per day
    const evByDay = {};
    _state.eventos.filter(e => e.data?.startsWith(`${y}-${String(m+1).padStart(2,'0')}`))
      .forEach(e => { const d=parseInt(e.data.split('-')[2]); if(!evByDay[d])evByDay[d]=[]; evByDay[d].push(e); });
    const ausSet = new Set();
    _state.ausencias.forEach(a => {
      const ini = new Date(a.dataInicio+'T00:00'), fim = new Date(a.dataFim+'T00:00');
      for (let dt = new Date(ini); dt <= fim; dt.setDate(dt.getDate()+1)) {
        if (dt.getFullYear()===y && dt.getMonth()===m) ausSet.add(dt.getDate());
      }
    });

    // Calendar grid
    const firstDay  = new Date(y,m,1).getDay(); // 0=Sun
    const daysInMonth = new Date(y,m+1,0).getDate();
    const today     = new Date(); const todayY=today.getFullYear(), todayM=today.getMonth(), todayD=today.getDate();
    const CU = Auth.getCU();

    let html = `<div class="cal-grid">`;
    DAYS_PT.forEach(d => { html += `<div class="cal-hdr">${d}</div>`; });

    // Empty cells before first day
    for (let i=0;i<firstDay;i++) html += `<div class="cal-cell cal-empty"></div>`;

    for (let d=1; d<=daysInMonth; d++) {
      const dt = new Date(y,m,d);
      const isToday = (y===todayY && m===todayM && d===todayD);
      const isAusent = ausSet.has(d);
      const dayEvs  = evByDay[d]||[];
      const turmasWorking = Object.entries(schedLookup)
        .filter(([t,days])=>days.has(d)).map(([t])=>t);

      // Turma background color (first working turma)
      let dayBg = '', turmaLabel = '';
      if (turmasWorking.length) {
        const t = turmasWorking[0];
        dayBg = `background:${TURMA_COLOR[t]?.light||'transparent'};`;
        turmaLabel = turmasWorking.map(t=>
          `<span class="cal-turma-badge" style="background:${TURMA_COLOR[t]?.bg};color:#fff;">${t}</span>`
        ).join('');
      }

      // Importance dots
      const dots = dayEvs.map(e =>
        `<span class="cal-dot" style="background:${IMPORTANCIA_COLOR[e.importancia]||'var(--accent)'};" title="${sanitize(e.titulo)}"></span>`
      ).join('');

      html += `
        <div class="cal-cell ${isToday?'cal-today':''} ${isAusent?'cal-ausent':''}"
             style="${dayBg}"
             onclick="Agenda.clickDay(${y},${m+1},${d})">
          <span class="cal-num ${isToday?'cal-num-today':''}">${d}</span>
          <div class="cal-turmas">${turmaLabel}</div>
          <div class="cal-dots">${dots}</div>
          ${isAusent?'<div class="cal-ausent-bar" title="Ausência registrada">🚫</div>':''}
        </div>`;
    }
    html += '</div>';

    wrap.innerHTML = html;
    renderScheduleDash();
    renderAbsenceDash();
  }

  function _buildSchedLookup(y, m) {
    const lookup = {};
    TURMAS.forEach(t => lookup[t] = new Set());
    const daysInMonth = new Date(y,m+1,0).getDate();

    _state.escalas.forEach(esc => {
      const turma = esc.turma;
      if (!turma || !TURMA_COLOR[turma]) return;
      const pat  = SCALE_PATTERNS[esc.pattern];
      if (!pat) return;
      const off  = (esc.offsets||{})[turma]||0;
      const refDate = new Date(esc.dataInicioA+'T00:00');

      for (let d=1; d<=daysInMonth; d++) {
        const dt = new Date(y,m,d);
        if (_isWorking(dt, esc.pattern, refDate, off)) lookup[turma].add(d);
      }
    });
    return lookup;
  }

  function _isWorking(date, pattern, refDate, offsetDays) {
    if (pattern === '5x2') {
      const day = date.getDay(); return day>=1 && day<=5;
    }
    const p = SCALE_PATTERNS[pattern];
    if (!p) return false;
    const cycle = p.work + p.rest;
    const ref   = new Date(refDate); ref.setHours(0,0,0,0);
    const chk   = new Date(date);    chk.setHours(0,0,0,0);
    const diff  = Math.floor((chk-ref)/(86400000));
    const adj   = ((diff - offsetDays) % cycle + cycle) % cycle;
    return adj < p.work;
  }

  function clickDay(y, m, d) {
    const dayStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvs = _state.eventos.filter(e=>e.data===dayStr);
    const dayAus = _state.ausencias.filter(a=>a.dataInicio<=dayStr && a.dataFim>=dayStr);
    const CU = Auth.getCU();

    let html = `<h3 class="gradient-text"><i class="fa fa-calendar-day"></i> ${d} de ${MONTHS_PT[m-1]} de ${y}</h3>`;

    if (dayEvs.length) {
      html += `<div style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📝 Eventos</div>`;
      dayEvs.forEach(e => {
        const ic = IMPORTANCIA_COLOR[e.importancia]||'var(--accent)';
        html += `<div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:9px;padding:10px 13px;margin-bottom:7px;border-left:4px solid ${ic};">
          <div style="font-weight:700;font-size:13px;">${sanitize(e.titulo)}</div>
          <div style="font-size:11px;color:var(--dim);margin-top:3px;">${e.horaInicio||''}${e.horaFim?' – '+e.horaFim:''} &nbsp;·&nbsp; <span style="color:${ic};font-weight:700;">${e.importancia}</span></div>
          ${e.descricao?`<div style="font-size:12px;margin-top:5px;">${sanitize(e.descricao)}</div>`:''}
          ${(CU.perfil==='ADMINISTRADOR'||e.userId===CU.uid)?`<div style="margin-top:8px;"><button class="del-btn" style="font-size:11px;" onclick="Agenda.deleteEvent('${e.id}');UI.closeModal()"><i class='fa fa-trash'></i> Excluir</button></div>`:''}
        </div>`;
      });
      html += '</div>';
    }

    if (dayAus.length) {
      html += `<div style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;color:var(--warn);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🚫 Ausências</div>`;
      dayAus.forEach(a => {
        html += `<div style="background:rgba(255,171,0,.08);border:1px solid rgba(255,171,0,.25);border-radius:9px;padding:10px 13px;margin-bottom:7px;">
          <div style="font-weight:700;font-size:13px;color:var(--warn);">${a.tipo}</div>
          <div style="font-size:11px;color:var(--dim);">👤 ${sanitize(a.autorNome)} &nbsp;·&nbsp; ${fDate(a.dataInicio)} até ${fDate(a.dataFim)}</div>
          ${a.obs?`<div style="font-size:12px;margin-top:4px;">${sanitize(a.obs)}</div>`:''}
          ${CU.perfil==='ADMINISTRADOR'?`<div style="margin-top:8px;"><button class="del-btn" style="font-size:11px;" onclick="Agenda.deleteAusencia('${a.id}');UI.closeModal()"><i class='fa fa-trash'></i> Excluir</button></div>`:''}
        </div>`;
      });
      html += '</div>';
    }

    if (!dayEvs.length && !dayAus.length) {
      html += `<div style="text-align:center;padding:20px;color:var(--dim);font-size:13px;">Nenhum evento ou ausência neste dia.</div>`;
    }

    html += `<div class="mbtns">
      <button class="btn btn-secondary" onclick="UI.closeModal()">Fechar</button>
      <button class="btn btn-primary" onclick="UI.closeModal();Agenda.openCreateEvent('${dayStr}')">
        <i class="fa fa-plus"></i> Criar Evento
      </button>
    </div>`;
    UI.openModal(html);
  }

  /* ══════════════════════════════════════════
     SCHEDULE DASHBOARD
  ══════════════════════════════════════════ */
  function renderScheduleDash() {
    const el = document.getElementById('sched-dash');
    if (!el) return;
    const CU = Auth.getCU();

    if (!_state.escalas.length) {
      el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--dim);">
        Nenhuma escala configurada.
        ${CU?.perfil==='ADMINISTRADOR'?`<br><button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="UI.closeModal();Agenda.openCreateEscala()"><i class="fa fa-plus"></i> Criar Escala</button>`:''}
      </div>`;
      return;
    }

    // Próximos 14 dias
    const today = new Date(); today.setHours(0,0,0,0);
    const days = [];
    for (let i=0;i<14;i++) {
      const dt = new Date(today); dt.setDate(today.getDate()+i);
      days.push(dt);
    }

    // Legend
    let html = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">`;
    TURMAS.forEach(t => {
      const tc = TURMA_COLOR[t];
      html += `<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;">
        <span style="width:12px;height:12px;border-radius:3px;background:${tc.bg};display:inline-block;"></span>
        Turma ${t}
      </span>`;
    });
    html += `<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;">
      <span style="width:12px;height:12px;border-radius:3px;background:rgba(255,255,255,.1);border:1px solid var(--border);display:inline-block;"></span>
      Folga
    </span></div>`;

    // Grid header
    html += `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:500px;">
      <thead><tr>
        <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--border);font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;background:rgba(0,198,255,.05);">Turma</th>`;
    days.forEach(dt => {
      const isT = dt.toDateString() === today.toDateString();
      html += `<th style="text-align:center;padding:5px 3px;border-bottom:1px solid var(--border);font-size:10px;color:${isT?'var(--accent)':'var(--dim)'};min-width:34px;background:${isT?'rgba(0,198,255,.08)':'rgba(0,198,255,.025)'};">
        <div>${DAYS_PT[dt.getDay()]}</div>
        <div style="font-weight:700;font-size:12px;">${dt.getDate()}</div>
      </th>`;
    });
    html += `</tr></thead><tbody>`;

    // Group escalas by turma (latest escala per turma wins)
    const escalaPorTurma = {};
    _state.escalas.forEach(e => {
      if (!escalaPorTurma[e.turma] || e.createdAt > escalaPorTurma[e.turma].createdAt)
        escalaPorTurma[e.turma] = e;
    });

    TURMAS.forEach(turma => {
      const esc = escalaPorTurma[turma];
      const tc  = TURMA_COLOR[turma];
      html += `<tr>
        <td style="padding:6px 10px;font-weight:700;font-size:12px;border-bottom:1px solid rgba(255,255,255,.04);">
          <span style="background:${tc.bg};color:#fff;padding:2px 8px;border-radius:5px;">${turma}</span>
          ${esc?`<span style="font-size:10px;color:var(--dim);margin-left:6px;">${esc.pattern}</span>`:''}
        </td>`;
      days.forEach(dt => {
        let working = false;
        if (esc) {
          const off = (esc.offsets||{})[turma]||0;
          const ref = new Date(esc.dataInicioA+'T00:00');
          working   = _isWorking(dt, esc.pattern, ref, off);
        }
        const isT = dt.toDateString() === today.toDateString();
        html += `<td style="text-align:center;padding:4px 3px;border-bottom:1px solid rgba(255,255,255,.04);background:${isT?'rgba(0,198,255,.05)':'transparent'};">
          <span style="display:inline-block;width:26px;height:20px;border-radius:4px;background:${working?tc.bg:'rgba(255,255,255,.06)'};font-size:10px;line-height:20px;color:${working?'#fff':'var(--dim)'};">
            ${working?'✔':'–'}
          </span>
        </td>`;
      });
      html += '</tr>';
    });
    html += `</tbody></table></div>`;

    el.innerHTML = html;
  }

  /* ══════════════════════════════════════════
     ABSENCE DASHBOARD
  ══════════════════════════════════════════ */
  function renderAbsenceDash() {
    const el = document.getElementById('absence-dash');
    if (!el) return;
    const CU = Auth.getCU();

    const sorted = [..._state.ausencias].sort((a,b)=>a.dataInicio.localeCompare(b.dataInicio));
    if (!sorted.length) {
      el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--dim);">Nenhuma ausência registrada.</div>`;
      return;
    }

    const tipoColor = {
      'Folga':'#00c6ff','Férias':'#00e676','Licença Médica':'#ff9800',
      'Abono':'#a78bfa','Outro':'#6888a8'
    };

    let html = `<div style="display:flex;flex-direction:column;gap:8px;">`;
    sorted.forEach(a => {
      const tc = tipoColor[a.tipo]||'#6888a8';
      const ini = new Date(a.dataInicio+'T00:00'), fim = new Date(a.dataFim+'T00:00');
      const dias = Math.round((fim-ini)/86400000)+1;
      html += `<div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-left:4px solid ${tc};border-radius:10px;padding:12px 15px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:13px;">
            <span style="background:${tc};color:#000;border-radius:5px;padding:2px 8px;font-size:11px;margin-right:8px;">${a.tipo}</span>
            ${sanitize(a.autorNome)}
          </div>
          <div style="font-size:11px;color:var(--dim);margin-top:4px;">
            📅 ${fDate(a.dataInicio)} → ${fDate(a.dataFim)} &nbsp;·&nbsp;
            <span style="font-weight:700;color:${tc};">${dias} dia${dias!==1?'s':''}</span>
          </div>
          ${a.obs?`<div style="font-size:12px;margin-top:4px;color:var(--dim);">${sanitize(a.obs)}</div>`:''}
        </div>
        ${CU.perfil==='ADMINISTRADOR'?`
        <button class="del-btn" onclick="Agenda.deleteAusencia('${a.id}')">
          <i class="fa fa-trash"></i>
        </button>`:''}
      </div>`;
    });
    html += '</div>';
    el.innerHTML = html;
  }

  /* ══════════════════════════════════════════
     NAVIGATION
  ══════════════════════════════════════════ */
  function prevMonth() {
    _state.month--;
    if (_state.month<0){ _state.month=11; _state.year--; }
    renderCalendar();
  }
  function nextMonth() {
    _state.month++;
    if (_state.month>11){ _state.month=0; _state.year++; }
    renderCalendar();
  }
  function goToday() {
    const n=new Date(); _state.year=n.getFullYear(); _state.month=n.getMonth();
    renderCalendar();
  }

  return {
    showActionSheet, openCreateEvent, saveEvent, deleteEvent,
    openCreateEscala, saveEscala,
    openCreateAusencia, saveAusencia, deleteAusencia,
    loadData, renderCalendar, renderScheduleDash, renderAbsenceDash,
    prevMonth, nextMonth, goToday, clickDay,
  };
})();
