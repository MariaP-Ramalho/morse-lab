import type { Settings } from '../settings';
import { ICONS } from '../ui/components';
import { mountEscutaGame } from './escuta/escutaGame';
import { mountLetrasGame } from './escuta/letrasGame';
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
  /** Não aparece no menu (é um modo aberto de dentro de outro jogo). */
  hidden?: boolean;
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
    description: 'Ouça Morse e responda com letras: descubra a palavra secreta ou acerte o máximo de letras contra o relógio.',
    icon: ICONS.headphones,
    mount: mountEscutaGame,
  },
  {
    id: 'escuta-letras',
    kind: 'game',
    name: 'Escuta · letra a letra',
    description: 'Uma letra toca por vez; digite qual é e acerte o máximo antes do tempo acabar.',
    icon: ICONS.headphones,
    hidden: true,
    mount: mountLetrasGame,
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
