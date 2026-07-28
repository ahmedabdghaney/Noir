import { registerPlugin } from '@capacitor/core';

interface NoirPlayerPlugin {
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
}

export const NoirPlayer = registerPlugin<NoirPlayerPlugin>('NoirPlayer');
