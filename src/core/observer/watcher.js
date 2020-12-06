/* @flow */

import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import type { ISet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 * 用于监听data/computed/watcher的数据变化。
 * 数据被劫持后执行Dep的notify然后；subs遍历收集的Watcher，进模板更新 update
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: ISet;
  newDepIds: ISet;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: Object
  ) {
    this.vm = vm
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep // watch深度监听
      this.user = !!options.user // 当是watch时为true
      this.lazy = !!options.lazy // 当时computed时为true
      this.sync = !!options.sync
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    // 在属性的watcher：{}中这个cb就是watcher监听属性的回调
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    //  Watcher 实例持有的 Dep 实例的数组
    this.deps = []
    this.newDeps = []
    // 代表 this.deps 和 this.newDeps 的 id
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = ''
    // parse expression for getter
    // expOrFn 在lifeCycle中是一个生成VNODE 更新DOM得回调
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () {}
      }
    }
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   * 若是computed时，相关data的自身持有的 dep 添加到当前正在计算的 watcher 中
   * this.getter.call执行computed的方法，并触发data的getter方法
   */
  get () {
    // 将当前Wacther赋值给Dep.target
    // 在 computed 流程中 this 指向的时 watchers[key]
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        // 遍历 要递归去访问 value，触发它所有子项的 getter
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   * 向此指令添加依赖项。
   */
  addDep (dep: Dep) {
    // dep Dep对象的实例
    const id = dep.id
    // 将对应的depId存在newDepIds中，每个depId都是一个更新数据的劫持的绑定
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      // 如果没有加入到dep中subs的队列则将对应视图的wather实例推入，再更新data时会触发这个队列更新视图
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   * // 将depIds/deps赋值为新的newDepIds/newDepIds
   * 将newDepIds/newDepIds还原为空
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDepIds
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   * 异步任务的队列
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) { // computed
      // 更新时，再将dirty变成true
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else { // 一般执行到这里
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      // 会执行监听的 getter 方法
      const value = this.get() // 获取当前data[key]的值（新值）
      // this.value 是老值
      // 如果满足新旧值不等、新值是对象类型、deep 模式任何一个条件，则执行 watcher 的回调
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        // 在watcher中看为false
        // 写了watch的会执行再第一次值改变时才执行，若用了 immediate 则会立即执行一次，但不是在这里而是再
        //  src\core\instance\state.js （415）
        if (this.user) {
          try {
            // 传入了新老值，this指向Vue实例
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          // 传入了新老值，this指向Vue实例
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    // 会执行 value = this.getter.call(vm, vm)
    // 实际上就是执行了计算属性定义的 getter 函数
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   * 收集所有deps的实例到watcher的newDeps
   * 将对应的watcher实例推入到Dep类中的subs数组中
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      // 从computed过来时：
      // 这时候的 Dep.target 是渲染 watcher，所以 this.dep.depend() 相当于渲染 watcher 订阅了这个 computed watcher 的变化。
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
// b保存已经记录过的深层次DepId，如果存在就不再深度遍历
const seenObjects = new Set()

// 对一个对象做深层递归遍历
// 因为遍历过程中就是对一个子对象的访问，会触发它们的 getter 过程，
// 这样就可以收集到依赖，也就是订阅它们变化的 watcher
function traverse (val: any) {
  seenObjects.clear()
  _traverse(val, seenObjects)
}

function _traverse (val: any, seen: ISet) {
  let i, keys
  const isA = Array.isArray(val)
  if ((!isA && !isObject(val)) || !Object.isExtensible(val)) {
    return
  }
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
