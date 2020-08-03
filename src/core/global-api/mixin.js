/* @flow */

import { mergeOptions } from '../util/index'

// 混合
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // 把要混入的对象通过 mergeOptions 合并到 Vue 的 options 中
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}

// 由于每个组件的构造函数都会在 extend 阶段合并 Vue.options 到自身的 options 中，
// 所以也就相当于每个组件都定义了 mixin 定义的选项。
