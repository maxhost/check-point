const preview = document.querySelector('#preview');
const activeScreens = ['access', 'guest', 'signed', 'ready'];
const initialMarkup = preview.innerHTML;
let toastTimer;

function toast(message) {
  const element = document.querySelector('#toast');
  clearTimeout(toastTimer);
  element.textContent = message;
  element.hidden = false;
  toastTimer = setTimeout(() => { element.hidden = true; }, 4500);
}

function setView(view) {
  preview.dataset.view = view;
  document.querySelectorAll('[data-view]').forEach(button => {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.view === view));
  });
}

function showScreen(screen) {
  if (!activeScreens.includes(screen)) return;
  preview.dataset.active = screen;
  document.querySelectorAll('.screen-picker button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.screen === screen)));
  setView('single');
  history.replaceState(null, '', `#${screen}`);
}

function applyIdentity() {
  const business = document.querySelector('#business-input').value.trim() || 'Café del Barrio';
  const name = document.querySelector('#name-input').value.trim() || 'Ana';
  preview.querySelectorAll('[data-business]').forEach(element => { element.textContent = business; });
  preview.querySelectorAll('[data-name]').forEach(element => { element.textContent = name; });
}

function applyEditing() {
  const enabled = document.querySelector('#edit-input').checked;
  preview.querySelectorAll('[data-editable]').forEach(element => {
    element.contentEditable = String(enabled);
    if (enabled) {
      element.setAttribute('aria-label', 'Texto editable: ' + element.textContent.trim());
      element.setAttribute('spellcheck', 'true');
    } else element.removeAttribute('aria-label');
  });
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.view) setView(button.dataset.view);
  if (button.dataset.screen) showScreen(button.dataset.screen);
  if (document.querySelector('#edit-input').checked && button.closest('.mobile-screen')) {
    if (event.target.closest('[data-editable]')) return;
  }
  if (button.dataset.go) showScreen(button.dataset.go);
  if (button.dataset.provider) {
    const enrollment = button.closest('.preview-item').dataset.screen === 'guest';
    if (enrollment) {
      showScreen('ready');
      toast('Inscripción simulada. En la app real, primero se completará el acceso con el proveedor.');
    } else toast('Acceso simulado. En la app real, aquí se abrirá tu wallet.');
  }
  if (button.id === 'join-button') {
    showScreen('ready');
    toast('Te uniste al programa en este ejemplo. No se envió ningún registro.');
  }
  if (button.id === 'install-button') toast('Instalación simulada. La instalación real usa el aviso o el menú del navegador.');
  if (button.id === 'pass-button') toast('Aquí se abrirá tu pase. La wallet interna queda fuera de este mock.');
  if (button.id === 'reset-button') {
    preview.innerHTML = initialMarkup;
    document.querySelector('#business-input').value = 'Café del Barrio';
    document.querySelector('#name-input').value = 'Ana';
    document.querySelector('#platform-input').value = 'ios';
    preview.dataset.platform = 'ios';
    document.querySelector('#width-input').value = '390';
    document.documentElement.style.removeProperty('--phone-width');
    for (const [id, value, property] of [['title',38,'--title-size'], ['padding',24,'--screen-padding'], ['space',32,'--section-gap']]) {
      document.querySelector(`#${id}-input`).value = value;
      document.querySelector(`#${id}-output`).textContent = `${value} px`;
      document.documentElement.style.removeProperty(property);
    }
    document.querySelector('#edit-input').checked = false;
    toast('Textos y espacios restablecidos.');
  }
});

document.querySelector('#business-input').addEventListener('input', applyIdentity);
document.querySelector('#name-input').addEventListener('input', applyIdentity);
document.querySelector('#edit-input').addEventListener('change', applyEditing);
document.querySelector('#platform-input').addEventListener('change', event => { preview.dataset.platform = event.target.value; });
document.querySelector('#width-input').addEventListener('change', event => { document.documentElement.style.setProperty('--phone-width', `${event.target.value}px`); });
for (const [id, property] of [['title','--title-size'], ['padding','--screen-padding'], ['space','--section-gap']]) {
  document.querySelector(`#${id}-input`).addEventListener('input', event => {
    document.documentElement.style.setProperty(property, `${event.target.value}px`);
    document.querySelector(`#${id}-output`).textContent = `${event.target.value} px`;
  });
}
window.addEventListener('hashchange', () => showScreen(location.hash.slice(1)));
const requested = location.hash.slice(1);
if (activeScreens.includes(requested)) showScreen(requested);
else if (window.matchMedia('(max-width: 650px)').matches) setView('single');
