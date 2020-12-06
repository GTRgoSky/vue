/* @flow */
//  依赖管理
import type Watcher from './watcher'
import { remove } from '../util/index'

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
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
// Dep.target 永远指向一个Watcher的实例
Dep.target = null
const targetStack = []

export function pushTarget (_target: Watcher) {
  if (Dep.target) targetStack.push(Dep.target) // 保存上一个Watcher实例
  Dep.target = _target
}

export function popTarget () {
  Dep.target = targetStack.pop() // 获取上一个Watcher实例
}
