import type { Mission } from '../types/missions.js';
import { MISSION_REWARDS } from '../constants.js';

/**
 * Easy mission pool (S01-S10).
 * Each mission awards 10 points on completion.
 */
export const EASY_MISSIONS: Mission[] = [
  {
    id: 'S01',
    difficulty: 'easy',
    reward: MISSION_REWARDS.easy,
    title: '蓝色收藏家',
    description: '最终拥有至少2颗蓝色宝石',
  },
  {
    id: 'S02',
    difficulty: 'easy',
    reward: MISSION_REWARDS.easy,
    title: '红色收藏家',
    description: '最终拥有至少2颗红色宝石',
  },
  {
    id: 'S03',
    difficulty: 'easy',
    reward: MISSION_REWARDS.easy,
    title: '绿色收藏家',
    description: '最终拥有至少2颗绿色宝石',
  },
  {
    id: 'S04',
    difficulty: 'easy',
    reward: MISSION_REWARDS.easy,
    title: '黄色收藏家',
    description: '最终拥有至少2颗黄色宝石',
  },
  {
    id: 'S05',
    difficulty: 'easy',
    reward: MISSION_REWARDS.easy,
    title: '紫色收藏家',
    description: '最终拥有至少2颗紫色宝石',
  },
  {
    id: 'S06',
    difficulty: 'easy',
    reward: MISSION_REWARDS.easy,
    title: '多彩新人',
    description: '最终拥有至少3种不同颜色的宝石',
  },
  {
    id: 'S07',
    difficulty: 'easy',
    reward: MISSION_REWARDS.easy,
    title: '小富翁',
    description: '最终宝石基础分达到20分',
  },
  {
    id: 'S08',
    difficulty: 'easy',
    reward: MISSION_REWARDS.easy,
    title: '高价值起步',
    description: '最终拥有至少1颗数值达到7以上的宝石',
  },
  {
    id: 'S09',
    difficulty: 'easy',
    reward: MISSION_REWARDS.easy,
    title: '双子宝石',
    description: '最终拥有至少2颗数值相同的宝石',
  },
  {
    id: 'S10',
    difficulty: 'easy',
    reward: MISSION_REWARDS.easy,
    title: '稳定发挥',
    description: '至少有4个回合成功获得宝石',
  },
];
