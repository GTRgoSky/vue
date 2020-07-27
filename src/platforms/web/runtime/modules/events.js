/* @flow */

import { isDef, isUndef } from 'shared/util'
import { updateListeners } from 'core/vdom/helpers/index'
import { isIE, supportsPassive } from 'core/util/env'
import { RANGE_TOKEN } from 'web/compiler/directives/model'

// normalize v-model event tokens that can only be determined at runtime.
// it's important to place the event as the first in the array because
// the whole point is ensuring the v-model callback gets called before
// user-attached handlers.
// 对 v-model 相关的处理
function normalizeEvents (on) {
  /* istanbul ignore if */
  if (isDef(on[RANGE_TOKEN])) {
    // IE input[type=range] only supports `change` event
    const event = isIE ? 'change' : 'input'
    on[event] = [].concat(on[RANGE_TOKEN], on[event] || [])
    delete on[RANGE_TOKEN]
  }
}

let target: HTMLElement

// 添加回调的实现
// 强制在 DOM 事件的回调函数执行期间如果修改了数据，那么这些数据更改推入的队列会被当做 macroTask 在 nextTick 后执行
function add (
  event: string,
  handler: Function,
  once: boolean,
  capture: boolean,
  passive: boolean
) {
  if (once) {
    const oldHandler = handler
    const _target = target // save current target element in closure
    handler = function (ev) {
      const res = arguments.length === 1
        ? oldHandler(ev)
        : oldHandler.apply(null, arguments)
      if (res !== null) {
        remove(event, handler, capture, _target)
      }
    }
  }
  // 就是实际上调用原生 addEventListener
  target.addEventListener(
    event,
    handler,
    supportsPassive
      ? { capture, passive }
      : capture
  )
}

// 移除回调函数的实现
function remove (
  event: string,
  handler: Function,
  capture: boolean,
  _target?: HTMLElement
) {
  // 就是实际上调用原生 removeEventListener
  (_target || target).removeEventListener(event, handler, capture)
}

function updateDOMListeners (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
    return
  }
  // vnode.data.on，这就是我们之前的生成的 data 中对应的事件对象
  const on = vnode.data.on || {}
  const oldOn = oldVnode.data.on || {}
  // target 是当前 vnode 对应的 DOM 对象
  target = vnode.elm
  normalizeEvents(on)
  updateListeners(on, oldOn, add, remove, vnode.context)
}

export default {
  create: updateDOMListeners,
  update: updateDOMListeners
}
