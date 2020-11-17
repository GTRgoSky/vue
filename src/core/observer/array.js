/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

// arrayMethods 首先继承了 Array，然后对数组中所有能改变数组自身的方法
const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

/**
 * Intercept mutating methods and emit events
 * 重写后的方法会先执行它们本身原有的逻辑，
 * 并对能增加数组长度的 3 个方法 push、unshift、splice 方法做了判断，
 * 获取到插入的值，然后把新添加的值变成一个响应式对象，
 * 并且再调用 ob.dep.notify() 手动触发依赖通知，
 * 这就很好地解释了之前的示例中调用 vm.items.splice(newLength) 方法可以检测到变化。
 */
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 获取到插入的值，然后把新添加的值变成一个响应式对象，并且再调用 ob.dep.notify() 手动触发依赖通知
    if (inserted) ob.observeArray(inserted) // src\core\observer\index.js 76
    // notify change
    ob.dep.notify()
    return result
  })
})
