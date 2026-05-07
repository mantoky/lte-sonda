'use strict';
const UI = (() => {
  function showPage(id) {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    window.scrollTo(0,0);
    if (id==='page-dashboard') Dashboard.render();
    if (id==='page-admin')     Admin.renderUsers();
    if (id==='page-agenda') {
      const CU = Auth.getCU();
      const btn = document.getElementById('btn-escala-adm');
      if (btn) btn.style.display = CU?.perfil==='ADMINISTRADOR'?'':'none';
      Agenda.loadData().then(()=>Agenda.renderCalendar());
    }
  }
  function toast(msg,type='i'){
    const w=document.getElementById('toast-wrap');
    const t=document.createElement('div'); t.className=`toast ${type}`;
    t.textContent=({i:'ℹ️',s:'✅',e:'❌',w:'⚠️'}[type]||'ℹ️')+' '+msg;
    t.onclick=()=>t.remove(); w.appendChild(t); setTimeout(()=>t.remove(),4500);
  }
  function loader(on,msg='Processando...'){
    document.getElementById('loader').classList.toggle('on',on);
    const el=document.getElementById('loader-msg'); if(el)el.textContent=msg;
  }
  function openModal(html,wide=false){
    const mb=document.getElementById('modal-body');
    if(wide){mb.className='';mb.style.cssText='width:min(960px,96vw);max-height:92vh;display:flex;flex-direction:column;padding:0;background:transparent;border:none;border-radius:20px;overflow:hidden;box-shadow:0 36px 70px rgba(0,0,0,.75);animation:popIn .26s ease;';}
    else{mb.className='modal';mb.style.cssText='';}
    mb.innerHTML=html;
    document.getElementById('modal-bg').classList.add('open');
  }
  function closeModal(){
    document.getElementById('modal-bg').classList.remove('open');
    const mb=document.getElementById('modal-body');mb.className='modal';mb.style.cssText='';mb.innerHTML='';
  }
  function confirm(msg){return window.confirm(msg);}
  function showTab(id,btn){
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active'); document.getElementById(id)?.classList.add('active');
    if(id==='tab-prog')    Admin.renderProgs();
    if(id==='tab-ordens')  Admin.renderOrdens('');
    if(id==='tab-allrpts') Admin.renderAllRpts();
    if(id==='tab-users')   Admin.renderUsers();
  }
  function togglePass(){
    const inp=document.getElementById('lg-pass'),eye=document.getElementById('pass-eye');
    if(!inp)return;
    if(inp.type==='password'){inp.type='text';eye.className='fa fa-eye-slash';}
    else{inp.type='password';eye.className='fa fa-eye';}
  }
  function setUserInfo(user){
    document.getElementById('d-ava').textContent=(user.nome||'?')[0].toUpperCase();
    document.getElementById('d-name').textContent=(user.nome||'—').split(' ')[0];
    document.getElementById('d-role').textContent=user.perfil||'—';
    document.getElementById('btn-admin-nav').style.display=user.perfil==='ADMINISTRADOR'?'':'none';
  }
  function emptyState(icon,msg){return `<div class="empty-state"><i class="fa ${icon}"></i><p>${sanitize(msg)}</p></div>`;}
  document.addEventListener('DOMContentLoaded',()=>{
    const pass=document.getElementById('lg-pass');
    if(pass)pass.addEventListener('keypress',e=>{if(e.key==='Enter')Auth.login();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  });
  return{showPage,toast,loader,openModal,closeModal,confirm,showTab,togglePass,setUserInfo,emptyState};
})();
