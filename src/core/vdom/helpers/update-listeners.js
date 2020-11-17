/* @flow */

import {
  warn,
  invokeWithErrorHandling
} from 'core/util/index'
import {
  cached,
  isUndef,
  isTrue,
  isPlainObject
} from 'shared/util'

const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean,
  handler?: Function,
  params?: Array<any>
} => {
  // 根据我们的的事件名的一些特殊标识（之前在 addHandler 的时候添加上的）区分出这个事件是否有 once、capture、passive 等修饰符。
  // src\compiler\helpers.js （57）
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  return {
    name,
    once,
    capture,
    passive
  }
})

export function createFnInvoker (fns: Function | Array<Function>, vm: ?Component): Function {
  function invoker () {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      // 由于一个事件可能会对应多个回调函数，所以这里做了数组的判断，多个回调函数就依次调用
      // eg：<div @click="test" @click="test2"></div>
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        invokeWithErrorHandling(cloned[i], null, arguments, vm, `v-on handler`)
      }
    } else {
      // return handler return value for single handlers
      return invokeWithErrorHandling(fns, null, arguments, vm, `v-on handler`)
    }
  }
  // 每一次执行 invoker 函数都是从 invoker.fns 里取执行的回调函数
  invoker.fns = fns
  return invoker
}

/**
 *
 * @param {新节点的监听} on
 * @param {老节点的监听} oldOn
 * @param {*} add
 * @param {*} remove
 * @param {*} vm
 * 遍历并且绑定事件回调
 */
export function updateListeners (
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  createOnceHandler: Function,
  vm: Component
) {
  let name, def, cur, old, event
   // 遍历 on 去添加事件监听
  for (name in on) {
    // 对于 on 的遍历。首先获得每一个事件名
    def = cur = on[name]
    old = oldOn[name]

    event = normalizeEvent(name)
    /* istanbul ignore if */
    if (__WEEX__ && isPlainObject(def)) {
      cur = def.handler
      event.params = def.params
    }
    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    } else if (isUndef(old)) {
      if (isUndef(cur.fns)) {
        // 对于第一次
        // 创建一个回调函数
        cur = on[name] = createFnInvoker(cur, vm)
      }
      if (isTrue(event.once)) {
        cur = on[name] = createOnceHandler(event.name, cur, event.capture)
      }
      // 完成一次事件绑定
      add(event.name, cur, event.capture, event.passive, event.params)
    } else if (cur !== old) {
      // 当我们第二次执行该函数的时候，判断如果 cur !== old，
      // 那么只需要更改 old.fns = cur 把之前绑定的 involer.fns 赋值为新的回调函数即可
      old.fns = cur
      // 并且 通过 on[name] = old 保留引用关
      on[name] = old
      // 这样就保证了事件回调只添加一次，之后仅仅去修改它的回调函数的引用。
    }
  }
  // 遍历 oldOn 去移除事件监听
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
