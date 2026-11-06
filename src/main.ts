import './styles.css';
import { GAMES, type GameDef } from './games/registry';
import { loadSettings, saveSettings, type Settings } from './settings';
import { nextControl } from './ui/controlPicker';
import { mountMenu } from './ui/menu';
import { mountProgressScreen } from './ui/progressScreen';

const app = document.getElementById('app')!;
// Objeto único e mutável: menu e jogos sempre leem a configuração atual.
const settings = loadSettings();
let unmount: (() => void) | null = null;

function updateSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  saveSettings(settings);
}

function showMenu() {
  unmount?.();
  unmount = mountMenu(app, { settings, updateSettings, onPlay: (g) => (location.hash = g.id) });
  window.scrollTo(0, 0);
}

function play(game: GameDef) {
  unmount?.();
  unmount = game.mount({
    container: app,
    settings,
    updateSettings,
    exit: () => (location.hash = ''),
  });
  window.scrollTo(0, 0);
}

/** Telas que não são jogos. */
const SCREENS: Record<string, () => () => void> = {
  progresso: () => mountProgressScreen(app),
};

// Cada tela tem seu endereço (#typing, #progresso...), então atualizar a página mantém a tela.
function route() {
  const id = location.hash.slice(1);
  const game = GAMES.find((g) => g.id === id);
  if (game) play(game);
  else if (SCREENS[id]) {
    unmount?.();
    unmount = SCREENS[id]();
    window.scrollTo(0, 0);
  } else showMenu();
}

// Selo do controle no topo das telas: cada clique troca para o próximo controle
// e remonta a tela atual com ele.
app.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('[data-act="cycle-control"]')) return;
  updateSettings({ control: nextControl(settings.control) });
  route();
});

window.addEventListener('hashchange', route);
route();
