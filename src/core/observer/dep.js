/* @flow */
//  依赖管理
import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * 发布订阅---可以用eventbus来理解
 */
export default class Dep {
  static target: ?Watcher; // 全局唯一 Watcher
  id: number;
  subs: Array<Watcher>; //  Watcher 的数组

  constructor () {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      // 他是一个watcher 实例
      Dep.target.addDep(this)
    }
  }

  notify () {
    // 当设置data时执行这里，执行每个watcher实例的update方法更新视图
    // stabilize the subscriber list first
    const subs = this.subs.slice() // sub里每个都是watcher
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
const targetStack = []

export function pushTarget (target: ?Watcher) {
  targetStack.push(target) // 保存上一个Watcher实例
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1] // 获取上一个Watcher实例
}
