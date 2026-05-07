'use strict';
const Export = (() => {
  function renderPreview(r) {
    const vehs   = (r.veiculos||[]).filter(v=>v);
    const ordens = (r.ordens||[]).filter(o=>o.numeroOrdem||o.ordem);
    const listLi = (arr,n)=>{let o='';for(let i=0;i<n;i++)o+=`<li><span class="rn">${i+1}</span><span class="rv">${sanitize(arr[i]||'')}</span></li>`;return o;};
    const ordRows= arr=>!arr.length?`<tr><td class="t-ord" colspan="2" style="color:#aaa;text-align:center;">—</td></tr>`:arr.slice(0,16).map(o=>`<tr><td class="t-ord">${sanitize(o.numeroOrdem||o.ordem||'')}</td><td class="t-sta">${sanitize(o.status||'—')}</td></tr>`).join('');

    const photoPage = Upload?.generatePhotoPage?.() || '';

    document.getElementById('preview-wrap').innerHTML = `
      <div class="report-doc" id="rpt-export">
        <div class="rdoc-hdr"><div class="rdoc-hdr-l">Desmobilização Mina LTE - Sonda</div><div class="rdoc-hdr-r">Status MW / LTE</div></div>
        <div class="rdoc-body">
          <div class="rdoc-col">
            <div class="rinfo-row"><span class="rinfo-lbl">Equipe:</span><span class="rinfo-val"> ${sanitize(r.equipe||'')}</span></div>
            <div class="rinfo-row"><span class="rinfo-lbl">Turma:</span><span class="rinfo-val"> ${sanitize(r.turma||'')}</span></div>
            <div class="rinfo-row"><span class="rinfo-lbl">Dia:</span><span class="rinfo-val"> ${sanitize(r.dia||'')}</span></div>
            <div class="rinfo-row"><span class="rinfo-lbl">Data:</span><span class="rinfo-val"> ${fDate(r.data)}</span></div>
            ${vehs.length?`<div class="rveh" style="margin-top:5px;"><div class="rveh-lbl">Checklist Veículos:</div>${vehs.map(v=>`<div class="rveh-val">${sanitize(v)}</div>`).join('')}</div>`:''}
            <div class="rsec">Programação PCM (ordens)</div>
            <table class="rpcm"><tbody>${ordRows(ordens)}</tbody></table>
          </div>
          <div class="rdoc-col">
            <div class="rsec" style="margin-top:0;">Outras Atividades</div>
            <ul class="rlist">${listLi(r.outras||[],11)}</ul>
            <div class="rsec">REDEL</div>
            <ul class="rlist">${listLi(r.redel||[],4)}</ul>
            ${r.obs?`<div style="margin-top:8px;font-size:10px;color:#333;background:#eef4ff;padding:6px;border-radius:3px;border-left:3px solid #2a5298;"><b>Obs:</b> ${sanitize(r.obs)}</div>`:''}
          </div>
          <div class="rdoc-col">
            <div class="rsec" style="margin-top:0;">Rádios MW</div>
            <ul class="rlist">${listLi(r.mw||[],4)}</ul>
            <div class="rsec">Rede LTE</div>
            <ul class="rlist">${listLi(r.lte||[],4)}</ul>
            <div class="rsec">Clima Tempo</div>
            <ul class="rlist">${listLi(r.clima||[],4)}</ul>
          </div>
        </div>
        <div class="rdoc-ftr">
          <span>⚡ LTE Sonda Report — Gerado por: ${sanitize(r.byName||r.autorNome||'—')}</span>
          <span>${new Date().toLocaleString('pt-BR')}</span>
        </div>
      </div>
      ${photoPage}`;
  }

  async function pdf() {
    UI.loader(true,'Gerando PDF...');
    try {
      const el     = document.getElementById('rpt-export');
      const canvas = await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#fff'});
      const {jsPDF} = window.jspdf;
      const doc    = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
      const pw=doc.internal.pageSize.getWidth(), ph=doc.internal.pageSize.getHeight();
      const ratio=canvas.width/canvas.height;
      let w=pw-14,h=w/ratio; if(h>ph-14){h=ph-14;w=h*ratio;}
      doc.addImage(canvas.toDataURL('image/png'),'PNG',(pw-w)/2,7,w,h);

      // Photo page
      const photos = Upload?.getPhotos?.() || [];
      if (photos.length) {
        const ppEl = document.getElementById('photo-page-a4');
        if (ppEl) {
          const pc = await html2canvas(ppEl,{scale:2,useCORS:true,backgroundColor:'#fff'});
          const pr = pc.width/pc.height;
          doc.addPage('a4','portrait');
          const ppw=doc.internal.pageSize.getWidth(),pph=doc.internal.pageSize.getHeight();
          let pw2=ppw-20,ph2=pw2/pr; if(ph2>pph-20){ph2=pph-20;pw2=ph2*pr;}
          doc.addImage(pc.toDataURL('image/png'),'PNG',(ppw-pw2)/2,10,pw2,ph2);
        }
      }

      const r = Editor.getCurrentReport();
      doc.save(`LTE_Relatorio_${r?.data||'sem-data'}.pdf`);
      UI.toast('PDF gerado!','s');
    } catch(e){ UI.toast('Erro: '+e.message,'e'); console.error(e); }
    UI.loader(false);
  }

  async function image() {
    UI.loader(true,'Gerando imagem...');
    try {
      const canvas = await html2canvas(document.getElementById('rpt-export'),{scale:2,useCORS:true,backgroundColor:'#fff'});
      const a=document.createElement('a');
      const r=Editor.getCurrentReport();
      a.href=canvas.toDataURL('image/png');
      a.download=`LTE_Relatorio_${r?.data||'sem-data'}.png`; a.click();
      UI.toast('Imagem salva!','s');
    } catch(e){ UI.toast('Erro: '+e.message,'e'); }
    UI.loader(false);
  }

  function text() {
    const r = {...(Editor.getCurrentReport()||{})};
    if (Editor._collect) Object.assign(r, Editor._collect());
    const a2t=(arr,n)=>{const o=[];for(let i=0;i<n;i++)if(arr[i])o.push(`  ${i+1}. ${arr[i]}`);return o.join('\n')||'  —';};
    const photos = Upload?.getPhotos?.() || [];
    const txt=[
      '⚡ RELATÓRIO LTE SONDA — VALE','─'.repeat(54),
      `Equipe : ${r.equipe||'—'}`,`Turma  : ${r.turma||'—'}`,
      `Dia    : ${r.dia||'—'}`,`Data   : ${fDate(r.data)}`,
      `Veículos: ${(r.veiculos||[]).filter(v=>v).join(' · ')||'—'}`,'',
      'ORDENS PCM:',
      (r.ordens||[]).filter(o=>o.numeroOrdem).map(o=>`  [${o.numeroOrdem}]  ${o.status||'—'}`).join('\n')||'  —','',
      'OUTRAS ATIVIDADES:', a2t(r.outras||[],11),'',
      'REDEL:', a2t(r.redel||[],4),'',
      'RÁDIOS MW:', a2t(r.mw||[],4),'',
      'REDE LTE:', a2t(r.lte||[],4),'',
      'CLIMA:', a2t(r.clima||[],4),
      ...(r.obs?['',`OBS: ${r.obs}`]:[]),
      ...(photos.length?['',`FOTOS: ${photos.length} foto(s) anexada(s) ao relatório.`]:[]),
      '','─'.repeat(54),
      `Gerado por : ${Auth.getCU()?.nome||'—'}`,
      `Data/Hora  : ${new Date().toLocaleString('pt-BR')}`,
    ].join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain;charset=utf-8'}));
    a.download=`LTE_${r.data||'sem-data'}.txt`; a.click();
    UI.toast('Texto exportado!','s');
  }

  return { renderPreview, pdf, image, text };
})();
