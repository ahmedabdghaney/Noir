/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live sports channels (DaddyLive / DLHD).
 * Player pages are public; no API key needed to embed a channel by id.
 * Stream URL pattern: https://dlhd.pk/stream/stream-<id>.php
 * Fallback folders if one is blocked: cast, watch, plus, casting, player.
 */

export interface LiveChannel {
  id: string;
  name: string;
  group: string;
}

const BASE = 'https://dlhd.pk';

export const STREAM_FOLDERS = ['stream', 'cast', 'watch', 'plus', 'casting', 'player'];

export function buildStreamUrl(id: string, folder: string = 'stream'): string {
  const f = STREAM_FOLDERS.includes(folder) ? folder : 'stream';
  return `${BASE}/${f}/stream-${id}.php`;
}

export const LIVE_CHANNELS: LiveChannel[] = [
  // العربية (MENA)
  { id: '91', name: 'beIN Sports 1 Arabic', group: 'العربية' },
  { id: '92', name: 'beIN Sports 2 Arabic', group: 'العربية' },
  { id: '93', name: 'beIN Sports 3 Arabic', group: 'العربية' },
  { id: '94', name: 'beIN Sports 4 Arabic', group: 'العربية' },
  { id: '95', name: 'beIN Sports 5 Arabic', group: 'العربية' },
  { id: '96', name: 'beIN Sports 6 Arabic', group: 'العربية' },
  { id: '97', name: 'beIN Sports 7 Arabic', group: 'العربية' },
  { id: '98', name: 'beIN Sports 8 Arabic', group: 'العربية' },
  { id: '99', name: 'beIN Sports 9 Arabic', group: 'العربية' },
  { id: '100', name: 'beIN Sports XTRA 1', group: 'العربية' },
  { id: '578', name: 'beIN Sports HD Qatar', group: 'العربية' },
  { id: '597', name: 'beIN Sports MAX AR', group: 'العربية' },
  { id: '61', name: 'beIN Sports MENA English 1', group: 'العربية' },
  { id: '90', name: 'beIN Sports MENA English 2', group: 'العربية' },

  // فرنسا
  { id: '116', name: 'beIN Sports 1 France', group: 'فرنسا' },
  { id: '117', name: 'beIN Sports 2 France', group: 'فرنسا' },
  { id: '118', name: 'beIN Sports 3 France', group: 'فرنسا' },
  { id: '494', name: 'beIN Sports MAX 4 France', group: 'فرنسا' },
  { id: '495', name: 'beIN Sports MAX 5 France', group: 'فرنسا' },
  { id: '496', name: 'beIN Sports MAX 6 France', group: 'فرنسا' },
  { id: '497', name: 'beIN Sports MAX 7 France', group: 'فرنسا' },
  { id: '498', name: 'beIN Sports MAX 8 France', group: 'فرنسا' },
  { id: '499', name: 'beIN Sports MAX 9 France', group: 'فرنسا' },
  { id: '500', name: 'beIN Sports MAX 10 France', group: 'فرنسا' },

  // تركيا
  { id: '62', name: 'beIN Sports 1 Turkey', group: 'تركيا' },
  { id: '63', name: 'beIN Sports 2 Turkey', group: 'تركيا' },
  { id: '64', name: 'beIN Sports 3 Turkey', group: 'تركيا' },
  { id: '67', name: 'beIN Sports 4 Turkey', group: 'تركيا' },
  { id: '1010', name: 'beIN Sports 5 Turkey', group: 'تركيا' },

  // أستراليا
  { id: '491', name: 'beIN Sports Australia 1', group: 'أستراليا' },
  { id: '492', name: 'beIN Sports Australia 2', group: 'أستراليا' },
  { id: '493', name: 'beIN Sports Australia 3', group: 'أستراليا' },

  // ماليزيا
  { id: '712', name: 'beIN Sports 1 Malaysia', group: 'ماليزيا' },
  { id: '713', name: 'beIN Sports 2 Malaysia', group: 'ماليزيا' },
  { id: '714', name: 'beIN Sports 3 Malaysia', group: 'ماليزيا' },

  // أخرى
  { id: '425', name: 'beIN Sports USA', group: 'أخرى' },
  { id: '372', name: 'beIN Sports en Español', group: 'أخرى' },
];

export const CHANNEL_GROUPS = ['الكل', 'العربية', 'فرنسا', 'تركيا', 'أستراليا', 'ماليزيا', 'أخرى'];
