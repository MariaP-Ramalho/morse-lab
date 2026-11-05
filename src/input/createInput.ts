import { ArrowInput } from './arrowInput';
import { KeyboardInput } from './keyboardInput';
import { SpaceHoldInput } from './spaceHoldInput';
import type { ControlMode, MorseInput } from './types';

export function createInput(
  mode: ControlMode,
  opts: { spaceThresholdMs: number; letterGapMs?: number },
): MorseInput {
  switch (mode) {
    case 'keyboard':
      return new KeyboardInput();
    case 'arrows':
      return new ArrowInput();
    case 'space':
      return new SpaceHoldInput(opts.spaceThresholdMs, opts.letterGapMs ?? 600);
  }
}
