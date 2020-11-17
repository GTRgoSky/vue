/* @flow */
// 给 Vue 这个对象本身扩展全局的静态方法
import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  Vue.observable = (obj: T): T => {
    observe(obj)
    return obj
  }

  // 声明一个空对象
  Vue.options = Object.create(null)
  // 这个绑定的是子组件，过滤器，指令（在这里全局注册）
  // 创建各个属性得值为{}
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // 它用于标识扩展所有明文对象的“基”构造函数
  // components with in Weex's multi-instance scenarios.
  // 保存Vue这个构造器函数（典型在Vue.extend会用到）
  Vue.options._base = Vue

  //  把一些内置组件扩展到 Vue.options.components 上
  // builtInComponents -- keep-alive
  extend(Vue.options.components, builtInComponents)

  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  initAssetRegisters(Vue)
}
