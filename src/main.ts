import './styles.css';
import { GAMES, type GameDef } from './games/registry';
import { loadSettings, saveSettings, type Settings } from './settings';
import { mountMenu } from './ui/menu';

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

// Cada tela tem seu endereço (#typing, #translator), então atualizar a página mantém a tela.
function route() {
  const game = GAMES.find((g) => g.id === location.hash.slice(1));
  if (game) play(game);
  else showMenu();
}

window.addEventListener('hashchange', route);
route();
