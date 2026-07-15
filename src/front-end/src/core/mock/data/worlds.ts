import type { Grade } from '../../types'

export interface MockTalent {
  id: number
  name: string
  description: string
  grade: Grade
  effect?: Record<string, number>
  exclude?: number[]
  status?: number 
  condition?: string 
}

export interface MockEvent {
  id: number
  event: string
  grade: Grade
  effect?: Record<string, number>
  postEvent?: string
}

export interface MockMyth {
  id: string
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  grade: Grade
  effect?: Record<string, number>
  fallback: string
}

export interface MockWorld {
  folder: 'zh-cn' | 'zh-cn-wf' | 'zh-cn-cf'
  label: string 
  worldText: string 
  namePool: string[]
  talents: MockTalent[]
  agePool: Record<number, Array<string | number>>
  events: Record<number, MockEvent>
  myths: MockMyth[]
}


const modern: MockWorld = {
  folder: 'zh-cn',
  label: '现实',
  worldText: '凡人纪元，灵气消退的现代都市。平凡人在烟火气中度过一生，偶有命运之线悄然交织。',
  namePool: ['张伟', '李云', '王芳', '陈静', '刘洋', '赵敏', '孙浩', '周婷', '吴磊', '郑爽'],
  talents: [
    { id: 1001, name: '天生丽质', description: '初始颜值 +3', grade: 1, effect: { CHR: 3 } },
    { id: 1002, name: '过目不忘', description: '初始智力 +3', grade: 1, effect: { INT: 3 } },
    { id: 1003, name: '体魄强健', description: '初始体质 +3', grade: 1, effect: { STR: 3 } },
    { id: 1004, name: '含着金汤匙', description: '初始家境 +3', grade: 1, effect: { MNY: 3 }, exclude: [1005] },
    { id: 1005, name: '寒门之子', description: '家境 -2，但可分配点 +3', grade: 1, effect: { MNY: -2 }, status: 3, exclude: [1004] },
    { id: 1006, name: '乐天派', description: '初始快乐 +4', grade: 0, effect: { SPR: 4 } },
    { id: 1007, name: '锦鲤附体', description: '一生好运，颜值/智力各 +2', grade: 2, effect: { CHR: 2, INT: 2 } },
    { id: 1008, name: '逆境重生', description: '30 岁时全属性 +2', grade: 2, effect: { CHR: 2, INT: 2, STR: 2 }, condition: 'AGE=30' },
    { id: 1009, name: '命运之子', description: '神话气运加身，全属性 +3', grade: 3, effect: { CHR: 3, INT: 3, STR: 3, MNY: 3 } },
    { id: 1010, name: '平平淡淡', description: '普通的一生', grade: 0 },
    { id: 1011, name: '社交达人', description: '颜值 +2，快乐 +2', grade: 1, effect: { CHR: 2, SPR: 2 } },
    { id: 1012, name: '工作狂', description: '家境 +3，快乐 -1', grade: 1, effect: { MNY: 3, SPR: -1 } },
  ],
  agePool: {},
  events: {
    10001: { id: 10001, event: '你出生在一个普通的家庭，父母给你取了名字。', grade: 0 },
    10002: { id: 10002, event: '上小学了，你第一次认识了好朋友。', grade: 0, effect: { SPR: 1 } },
    10003: { id: 10003, event: '考试拿了第一名，老师表扬了你。', grade: 1, effect: { INT: 1, SPR: 1 } },
    10004: { id: 10004, event: '青春期的你开始注意自己的容貌。', grade: 0, effect: { CHR: 1 } },
    10005: { id: 10005, event: '高考结束，你考上了理想的大学。', grade: 1, effect: { INT: 2 } },
    10006: { id: 10006, event: '步入职场，第一份工作虽然辛苦，但收获颇丰。', grade: 0, effect: { MNY: 2, STR: -1 } },
    10007: { id: 10007, event: '你遇到了人生的另一半。', grade: 1, effect: { SPR: 3 } },
    10008: { id: 10008, event: '一场大病让你卧床数月。', grade: 0, effect: { STR: -3, LIF: 0 } },
    10009: { id: 10009, event: '你创业成功，财富自由。', grade: 2, effect: { MNY: 5 } },
    10010: { id: 10010, event: '岁月不饶人，你的身体一年不如一年。', grade: 0, effect: { STR: -2 } },
    10011: { id: 10011, event: '儿孙满堂，你安享晚年。', grade: 1, effect: { SPR: 3 } },
    10012: { id: 10012, event: '平静的一年，没有什么特别的事发生。', grade: 0 },
    10013: { id: 10013, event: '你迷上了读书，知识让你充实。', grade: 0, effect: { INT: 1 } },
    10014: { id: 10014, event: '坚持锻炼，你的身体越来越好。', grade: 0, effect: { STR: 1 } },
  },
  myths: [
    { id: 'm_modern_1', rarity: 'common', grade: 2, effect: { SPR: 3 }, fallback: '夜空中划过一道流星，你许下了愿望，命运之线在此刻悄然交织。' },
    { id: 'm_modern_2', rarity: 'rare', grade: 3, effect: { CHR: 2, INT: 2 }, fallback: '一个陌生人递给你一封旧信，信中提到了一个你从未听过的名字，却莫名熟悉。' },
    { id: 'm_modern_3', rarity: 'legendary', grade: 3, effect: { MNY: 4 }, fallback: '都市传说在你身上应验，灵气余烬重燃，你成为传说的一部分。' },
  ],
}

const xianxia: MockWorld = {
  folder: 'zh-cn-cf',
  label: '玄幻',
  worldText: '九天仙途，五境升阶。凡人逆天而行，求一线长生。命运如剑，斩断红尘。',
  namePool: ['云无涯', '凌霄', '叶孤鸿', '苏沐雪', '萧逸尘', '慕容雪', '楚天阔', '白清歌', '玄玉', '司命'],
  talents: [
    { id: 2001, name: '灵根天成', description: '修仙资质，智力 +3', grade: 1, effect: { INT: 3 } },
    { id: 2002, name: '剑骨', description: '体质 +3，颜值 +1', grade: 1, effect: { STR: 3, CHR: 1 } },
    { id: 2003, name: '仙缘', description: '初始家境 +4', grade: 1, effect: { MNY: 4 }, exclude: [2004] },
    { id: 2004, name: '散修出身', description: '家境 -2，可分配点 +3', grade: 1, effect: { MNY: -2 }, status: 3, exclude: [2003] },
    { id: 2005, name: '逍遥心境', description: '快乐 +4', grade: 0, effect: { SPR: 4 } },
    { id: 2006, name: '天命之子', description: '全属性 +3', grade: 3, effect: { CHR: 3, INT: 3, STR: 3, MNY: 3 } },
    { id: 2007, name: '顿悟', description: '40 岁时智力 +4', grade: 2, effect: { INT: 4 }, condition: 'AGE=40' },
    { id: 2008, name: '凡骨', description: '资质平平的一生', grade: 0 },
    { id: 2009, name: '九天玄女血脉', description: '颜值 +3，智力 +2', grade: 2, effect: { CHR: 3, INT: 2 } },
    { id: 2010, name: '丹道天才', description: '家境 +3', grade: 1, effect: { MNY: 3 } },
  ],
  agePool: {},
  events: {
    20001: { id: 20001, event: '你降生于灵气浓郁之地，天生亲近天地灵气。', grade: 0 },
    20002: { id: 20002, event: '幼年被宗门长老看中，引入山门。', grade: 1, effect: { INT: 1 } },
    20003: { id: 20003, event: '初入炼气境，丹田中第一缕灵气流转。', grade: 1, effect: { INT: 1, STR: 1 } },
    20004: { id: 20004, event: '宗门大比，你一鸣惊人。', grade: 2, effect: { CHR: 2, STR: 1 } },
    20005: { id: 20005, event: '渡劫失败，元气大伤。', grade: 0, effect: { STR: -3, LIF: 0 } },
    20006: { id: 20006, event: '你在秘境中觅得一枚灵丹。', grade: 1, effect: { STR: 2 } },
    20007: { id: 20007, event: '突破筑基，寿元大增。', grade: 2, effect: { STR: 3, INT: 2 } },
    20008: { id: 20008, event: '一场闭关，岁月静好。', grade: 0, effect: { SPR: 1 } },
    20009: { id: 20009, event: '与道侣携手同游九天。', grade: 1, effect: { SPR: 3 } },
    20010: { id: 20010, event: '心魔入侵，道心险些崩溃。', grade: 0, effect: { SPR: -2, STR: -1 } },
    20011: { id: 20011, event: '寿元将尽，你坐化于洞府之中。', grade: 1, effect: { SPR: 2 } },
    20012: { id: 20012, event: '平淡的修行岁月，灵力缓缓增长。', grade: 0, effect: { INT: 1 } },
  },
  myths: [
    { id: 'm_xx_1', rarity: 'common', grade: 2, effect: { INT: 3 }, fallback: '一道仙音自九天传来，你似有所悟，命运之线在此刻悄然交织。' },
    { id: 'm_xx_2', rarity: 'rare', grade: 3, effect: { STR: 3 }, fallback: '古老的剑冢前，一柄无主仙剑认你为主，剑身刻着一个陌生的名字。' },
    { id: 'm_xx_3', rarity: 'legendary', grade: 3, effect: { CHR: 2, INT: 3 }, fallback: '天道垂青，你窥见一缕大道真意，自此踏入传说之境。' },
  ],
}

const fantasy: MockWorld = {
  folder: 'zh-cn-wf',
  label: '异域',
  worldText: '埃尔德兰，剑与魔法的西方奇幻大陆。英雄与诸神交织，命运在史诗中书写。',
  namePool: ['阿尔文', '塞德里克', '伊莎贝拉', '兰斯洛特', '薇薇安', '罗德里克', '艾琳娜', '加雷斯', '莉雅', '奥兰多'],
  talents: [
    { id: 3001, name: '精灵血统', description: '颜值 +3，智力 +1', grade: 1, effect: { CHR: 3, INT: 1 } },
    { id: 3002, name: '战士之魂', description: '体质 +4', grade: 1, effect: { STR: 4 } },
    { id: 3003, name: '贵族后裔', description: '家境 +4', grade: 1, effect: { MNY: 4 }, exclude: [3004] },
    { id: 3004, name: '流浪者', description: '家境 -2，可分配点 +3', grade: 1, effect: { MNY: -2 }, status: 3, exclude: [3003] },
    { id: 3005, name: '吟游诗人', description: '快乐 +3，颜值 +1', grade: 0, effect: { SPR: 3, CHR: 1 } },
    { id: 3006, name: '天选英雄', description: '全属性 +3', grade: 3, effect: { CHR: 3, INT: 3, STR: 3, MNY: 3 } },
    { id: 3007, name: '魔法天赋', description: '35 岁时智力 +4', grade: 2, effect: { INT: 4 }, condition: 'AGE=35' },
    { id: 3008, name: '平民出身', description: '普通的冒险者', grade: 0 },
    { id: 3009, name: '龙裔', description: '体质 +3，颜值 +2', grade: 2, effect: { STR: 3, CHR: 2 } },
    { id: 3010, name: '炼金术士', description: '智力 +2，家境 +2', grade: 1, effect: { INT: 2, MNY: 2 } },
  ],
  agePool: {},
  events: {
    30001: { id: 30001, event: '你出生在埃尔德兰的一个小村庄。', grade: 0 },
    30002: { id: 30002, event: '村中的游侠教你识字与剑术。', grade: 0, effect: { STR: 1, INT: 1 } },
    30003: { id: 30003, event: '你加入了冒险者公会，领到第一枚徽章。', grade: 1, effect: { STR: 1 } },
    30004: { id: 30004, event: '在地下城中，你击败了一只哥布林。', grade: 1, effect: { STR: 2, MNY: 1 } },
    30005: { id: 30005, event: '一场战斗让你身负重伤。', grade: 0, effect: { STR: -3, LIF: 0 } },
    30006: { id: 30006, event: '你在古遗迹中发现了魔法卷轴。', grade: 2, effect: { INT: 3 } },
    30007: { id: 30007, event: '你被册封为骑士，声名远扬。', grade: 2, effect: { CHR: 2, MNY: 2 } },
    30008: { id: 30008, event: '与同伴在酒馆畅饮，其乐融融。', grade: 0, effect: { SPR: 2 } },
    30009: { id: 30009, event: '你与心爱之人在星空下立誓。', grade: 1, effect: { SPR: 3 } },
    30010: { id: 30010, event: '岁月与伤痛让你逐渐力不从心。', grade: 0, effect: { STR: -2 } },
    30011: { id: 30011, event: '你将冒险的故事讲给后辈，安然老去。', grade: 1, effect: { SPR: 2 } },
    30012: { id: 30012, event: '平静的旅途，你欣赏着大陆的风景。', grade: 0, effect: { SPR: 1 } },
  },
  myths: [
    { id: 'm_wf_1', rarity: 'common', grade: 2, effect: { STR: 3 }, fallback: '一位神秘旅人为你指引方向，命运之线在此刻悄然交织。' },
    { id: 'm_wf_2', rarity: 'rare', grade: 3, effect: { INT: 3 }, fallback: '古龙的低语在你耳边响起，提及一位早已逝去的传奇之名。' },
    { id: 'm_wf_3', rarity: 'legendary', grade: 3, effect: { CHR: 3, STR: 2 }, fallback: '诸神的目光落在你身上，你的名字将被吟游诗人传唱千年。' },
  ],
}

function buildAgePool(world: MockWorld): void {
  const ids = Object.keys(world.events).map(Number)
  world.agePool[0] = [ids[0]]
  for (let age = 1; age <= 100; age++) {
    const pool: number[] = []
    for (const id of ids) {
      pool.push(id)
    }
    world.agePool[age] = pool
  }
}
;[modern, xianxia, fantasy].forEach(buildAgePool)

export const WORLDS: Record<string, MockWorld> = {
  'zh-cn': modern,
  'zh-cn-cf': xianxia,
  'zh-cn-wf': fantasy,
}

export const WORLD_ORDER: Array<'zh-cn' | 'zh-cn-wf' | 'zh-cn-cf'> = ['zh-cn', 'zh-cn-wf', 'zh-cn-cf']

export interface MockAchievement {
  id: number
  name: string
  description: string
  nameEn: string
  descEn: string
  grade: Grade
  hide?: 0 | 1
  check: (f: { sum: number; mythCount: number; fateLevel: string; HAGE: number }) => boolean
}

export const ACHIEVEMENTS: MockAchievement[] = [
  { id: 9001, name: '初次铭刻', description: '完成第一次命运铭刻', nameEn: 'First Inscription', descEn: 'Inscribe a fate for the first time', grade: 0, check: () => true },
  { id: 9002, name: '长寿之人', description: '享年达到 80 岁', nameEn: 'Long-Lived', descEn: 'Reach a lifespan of 80', grade: 1, check: (f) => f.HAGE >= 80 },
  { id: 9003, name: '百岁人瑞', description: '享年达到 100 岁', nameEn: 'Centenarian', descEn: 'Reach a lifespan of 100', grade: 2, check: (f) => f.HAGE >= 100 },
  { id: 9004, name: '命运宠儿', description: '单局触发 2 次以上神话事件', nameEn: 'Favored by Fate', descEn: 'Trigger 2+ myth events in one life', grade: 2, check: (f) => f.mythCount >= 2 },
  { id: 9005, name: '传奇命运', description: '达成 S 级命运', nameEn: 'Legendary Fate', descEn: 'Achieve an S-grade fate', grade: 3, check: (f) => f.fateLevel === 'S' },
  { id: 9006, name: '英杰人物', description: '综评达到 100', nameEn: 'Paragon', descEn: 'Reach a score of 100', grade: 2, check: (f) => f.sum >= 100 },
  { id: 9007, name: '隐藏的命运', description: '在神话中与前人相遇', nameEn: 'Hidden Fate', descEn: 'Meet a predecessor within a myth', grade: 3, hide: 1, check: (f) => f.mythCount >= 3 },
]
