import type { Mission } from '../types/missions.js';
import { MISSION_REWARDS } from '../constants.js';

/**
 * Medium mission pool (M01-M10).
 * Each mission awards 20 points on completion.
 */
export const MEDIUM_MISSIONS: Mission[] = [
  {
    id: 'M01',
    difficulty: 'medium',
    reward: MISSION_REWARDS.medium,
    title: '三色收藏家',
    description: '最终拥有至少3种颜色，且其中一种颜色至少有3颗',
  },
  {
    id: 'M02',
    difficulty: 'medium',
    reward: MISSION_REWARDS.medium,
    title: '蓝色专精',
    description: '最终拥有至少3颗蓝色宝石',
  },
  {
    id: 'M03',
    difficulty: 'medium',
    reward: MISSION_REWARDS.medium,
    title: '红色专精',
    description: '最终拥有至少3颗红色宝石',
  },
  {
    id: 'M04',
    difficulty: 'medium',
    reward: MISSION_REWARDS.medium,
    title: '四色玩家',
    description: '最终拥有至少4种不同颜色的宝石',
  },
  {
    id: 'M05',
    difficulty: 'medium',
    reward: MISSION_REWARDS.medium,
    title: '高价值收藏家',
    description: '最终拥有至少3颗数值达到8以上的宝石',
  },
  {
    id: 'M06',
    difficulty: 'medium',
    reward: MISSION_REWARDS.medium,
    title: '中产阶级',
    description: '最终宝石基础分达到35分',
  },
  {
    id: 'M07',
    difficulty: 'medium',
    reward: MISSION_REWARDS.medium,
    title: '双重颜色',
    description: '最终至少有2种颜色分别拥有3颗宝石',
  },
  {
    id: 'M08',
    difficulty: 'medium',
    reward: MISSION_REWARDS.medium,
    title: '双十收藏',
    description: '最终拥有至少2颗数值为10的宝石',
  },
  {
    id: 'M09',
    difficulty: 'medium',
    reward: MISSION_REWARDS.medium,
    title: '同色三连',
    description: '最终拥有至少3颗相同颜色宝石，且基础分达到30分',
  },
  {
    id: 'M10',
    difficulty: 'medium',
    reward: MISSION_REWARDS.medium,
    title: '最后一搏',
    description: '第6轮成功获得宝石，且该宝石数值达到8以上',
  },
];
