import type { Mission } from '../types/missions.js';
import { MISSION_REWARDS } from '../constants.js';

/**
 * Hard mission pool (H01-H10).
 * Each mission awards 35 points on completion.
 */
export const HARD_MISSIONS: Mission[] = [
  {
    id: 'H01',
    difficulty: 'hard',
    reward: MISSION_REWARDS.hard,
    title: '单色大师',
    description: '最终拥有至少5颗相同颜色的宝石',
  },
  {
    id: 'H02',
    difficulty: 'hard',
    reward: MISSION_REWARDS.hard,
    title: '五色收藏家',
    description: '最终同时拥有红、蓝、绿、黄、紫五种颜色',
  },
  {
    id: 'H03',
    difficulty: 'hard',
    reward: MISSION_REWARDS.hard,
    title: '三张王牌',
    description: '最终拥有至少3颗数值达到9以上的宝石',
  },
  {
    id: 'H04',
    difficulty: 'hard',
    reward: MISSION_REWARDS.hard,
    title: '大宝藏',
    description: '最终宝石基础分达到45分',
  },
  {
    id: 'H05',
    difficulty: 'hard',
    reward: MISSION_REWARDS.hard,
    title: '同色四连',
    description: '最终拥有至少4颗相同颜色的宝石',
  },
  {
    id: 'H06',
    difficulty: 'hard',
    reward: MISSION_REWARDS.hard,
    title: '三色成双',
    description: '最终至少有3种颜色分别拥有2颗宝石',
  },
  {
    id: 'H07',
    difficulty: 'hard',
    reward: MISSION_REWARDS.hard,
    title: '宝石猎人',
    description: '最终一共获得6颗宝石',
  },
  {
    id: 'H08',
    difficulty: 'hard',
    reward: MISSION_REWARDS.hard,
    title: '心理大师',
    description: '至少有2个回合与其他玩家选择相同数字，并且自己在对应候选组中最终获得宝石',
  },
  {
    id: 'H09',
    difficulty: 'hard',
    reward: MISSION_REWARDS.hard,
    title: '逆袭者',
    description: '第3轮结束时基础分排名不在前三，但最终进入前三',
  },
  {
    id: 'H10',
    difficulty: 'hard',
    reward: MISSION_REWARDS.hard,
    title: '全能赢家',
    description: '最终宝石基础分达到40分，同时至少拥有4种颜色',
  },
];
