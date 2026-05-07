'use strict';
window.addEventListener('DOMContentLoaded', () => {
  const ok = initFirebase();
  if (!ok) { UI.showPage('page-login'); return; }
  window.CU = { uid: 'open', nome: 'Visitante', perfil: 'ADMINISTRADOR' };
  UI.showPage('page-dashboard');
  Dashboard.renderStats();
});
