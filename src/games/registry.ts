import type { Settings } from '../settings';
import { ICONS } from '../ui/components';
import { mountEscutaGame } from './escuta/escutaGame';
import { mountTranslator } from './translator/translator';
import { mountTypingGame } from './typing/typingGame';

export interface GameContext {
  container: HTMLElement;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  exit: () => void;
}

export interface GameDef {
  id: string;
  /** 'game' = jogo, 'tool' = ferramenta. */
  kind: 'game' | 'tool';
  name: string;
  description: string;
  /** SVG do ícone no menu. */
  icon: string;
  /** Monta o jogo e devolve a função de limpeza. */
  mount: (ctx: GameContext) => () => void;
}

/** Para adicionar um jogo novo, basta incluí-lo aqui. */
export const GAMES: GameDef[] = [
  {
    id: 'typing',
    kind: 'game',
    name: 'Digitação',
    description: 'Frases aleatórias aparecem e você digita em Morse até o tempo acabar.',
    icon: ICONS.timer,
    mount: mountTypingGame,
  },
  {
    id: 'escuta',
    kind: 'game',
    name: 'Escuta',
    description: 'Ouça uma palavra secreta em Morse e descubra qual é em até 6 tentativas.',
    icon: ICONS.headphones,
    mount: mountEscutaGame,
  },
  {
    id: 'translator',
    kind: 'tool',
    name: 'Tradutor',
    description: 'Escreva livremente em Morse e veja as letras aparecendo na tela.',
    icon: ICONS.translate,
    mount: mountTranslator,
  },
];
