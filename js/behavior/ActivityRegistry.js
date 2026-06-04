/**
 * ActivityRegistry — Activity 工厂注册表（独立文件，防循环依赖）
 *
 * Activity 文件 import registerActivity 并自注册；
 * SocialLayer import getRegistry 查找工厂。
 */

const REGISTRY = {};

export function registerActivity(type, factory) {
  REGISTRY[type] = factory;
}

export function getRegistry() {
  return REGISTRY;
}
