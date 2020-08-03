/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // _installedPlugins 存储所有注册过的 plugin
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    // 插入Vue
    args.unshift(this)
    // 会判断 plugin 有没有定义 install 方法
    if (typeof plugin.install === 'function') {
      // 有的话则调用该方法，并且该方法执行的第一个参数是 Vue
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // 如果传入的 plugin 是一个方法
      plugin.apply(null, args)
    }
    // 把 plugin 存储到 installedPlugins 中。
    installedPlugins.push(plugin)
    return this
  }
}
