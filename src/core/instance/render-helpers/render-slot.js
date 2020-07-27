/* @flow */

import { extend, warn, isObject } from 'core/util/index'

/**
 * Runtime helper for rendering <slot>
 * name 代表插槽名称 slotName
 * fallback 代表插槽的默认内容生成的 vnode 数组
 */
export function renderSlot (
  name: string,
  fallback: ?Array<VNode>,
  props: ?Object,
  bindObject: ?Object
): ?Array<VNode> {
  // this.$scopedSlots 在什么地方定义的呢？：
  // 在子组件的渲染函数执行前，在 vm_render（src/core/instance/render.js） 方法内
  const scopedSlotFn = this.$scopedSlots[name]
  if (scopedSlotFn) { // scoped slot
    // 作用域插槽
    props = props || {}
    if (bindObject) {
      if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
        warn(
          'slot v-bind without argument expects an Object',
          this
        )
      }
      props = extend(extend({}, bindObject), props)
    }
    return scopedSlotFn(props) || fallback
  } else {
    /**
     * this.$slots 是如何获取的？：
     *  子组件的 init 时机是在父组件执行 patch 过程的时候，那这个时候父组件已经编译完成了
        并且子组件在 init 过程中会执行 initRender 函数，initRender 的时候获取到 vm.$slot，
        相关代码在（src/core/instance/render.js initRender ）
        vm.$slots 是通过执行 resolveSlots 返回的 （src/core/instance/render-helpers/resolve-slots.js【6】
     */
    // 默认插槽逻辑
    // 根据插槽名称获取到对应的 vnode 数组
    // 数组里的 vnode 都是在父组件创建的，这样就实现了在父组替换子组件插槽的内容了。所以vm指向父级
    const slotNodes = this.$slots[name]
    // warn duplicate slot usage
    if (slotNodes && process.env.NODE_ENV !== 'production') {
      slotNodes._rendered && warn(
        `Duplicate presence of slot "${name}" found in the same render tree ` +
        `- this will likely cause render errors.`,
        this
      )
      slotNodes._rendered = true
    }
    // 返回它对应的 vnode 数组 || fallback
    return slotNodes || fallback
    // 对应的 slot 渲染成 vnodes，作为当前组件渲染 vnode 的 children
  }
}
