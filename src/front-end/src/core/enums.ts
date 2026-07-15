import type { FateLevel, Grade } from './types'

export const Pages = {
  LOADING: 'LOADING',
  MAIN: 'MAIN',
  CONNECT_WALLET: 'CONNECT_WALLET',
  TALENT: 'TALENT',
  PROPERTY: 'PROPERTY',
  TRAJECTORY: 'TRAJECTORY',
  SUMMARY: 'SUMMARY',
  FATE_SUMMARY: 'FATE_SUMMARY',
  MYTH_ATLAS: 'MYTH_ATLAS',
  WORLD_BOARD: 'WORLD_BOARD',
  ACHIEVEMENT: 'ACHIEVEMENT',
  THANKS: 'THANKS',
} as const
export type PageName = (typeof Pages)[keyof typeof Pages]

export const Dialogs = {
  THEMES: 'THEMES',
  SAVELOAD: 'SAVELOAD',
} as const
export type DialogName = (typeof Dialogs)[keyof typeof Dialogs]

export const Popups = {
  MESSAGE: 'MESSAGE',
  ACHIEVEMENT: 'ACHIEVEMENT',
} as const
export type PopupName = (typeof Popups)[keyof typeof Popups]

export const GRADE_COLORS: Record<Grade, string> = {
  0: '#cccccc',
  1: '#55fffe',
  2: '#b17cff',
  3: '#ffce45',
}

export const LEVEL_COLORS: Record<FateLevel, string> = {
  S: '#ffce45',
  A: '#b17cff',
  B: '#55fffe',
  C: '#cccccc',
  D: '#888888',
}

export const WORLD_COLORS: Record<string, string> = {
  传奇: '#ffce45',
  玄幻: '#b17cff',
  异域: '#55fffe',
  现实: '#888888',
  智识之境: '#55fffe',
  武道之世: '#ff7878',
  风华之世: '#e2a7ff',
  锦绣之途: '#ffc500',
  逍遥之乡: '#84ff55',
  寻常人间: '#888888',
}

export const WORLD_LABEL: Record<string, string> = {
  'zh-cn': '现实',
  'zh-cn-cf': '玄幻',
  'zh-cn-wf': '异域',
}

const WORLD_EN: Record<string, string> = {
  'zh-cn': 'Modern', 'zh-cn-cf': 'Xianxia', 'zh-cn-wf': 'Fantasy',
  现实: 'Modern', 玄幻: 'Xianxia', 异域: 'Fantasy', 传奇: 'Legend',
  智识之境: 'Realm of Wisdom', 武道之世: 'World of Martial', 风华之世: 'World of Grace',
  锦绣之途: 'Path of Splendor', 逍遥之乡: 'Land of Freedom', 寻常人间: 'Mortal World',
}

export function worldDisplayName(world: string, en: boolean): string {
  if (!en) return WORLD_LABEL[world] ?? world
  return WORLD_EN[world] ?? WORLD_LABEL[world] ?? world
}

export const Events = {
  MESSAGE: 'message',
  ACHIEVEMENT: 'achievement',
  MYTH_TEXT_UPDATE: 'myth_text_update',
} as const
