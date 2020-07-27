/* @flow */

/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 * chilren 对应的是父 vnode 的 children
 * context 是父 vnode 的上下文，也就是父组件的 vm 实例
 */
export function resolveSlots (
  children: ?Array<VNode>,
  context: ?Component
): { [key: string]: Array<VNode> } {
  const slots = {}
  if (!children) {
    return slots
  }
  // 遍历 chilren，拿到每一个 child 的 data，
  const defaultSlot = []
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i]
    const data = child.data
    // remove slot attribute if the node is resolved as a Vue slot node
    if (data && data.attrs && data.attrs.slot) {
      delete data.attrs.slot
    }
    // named slots should only be respected if the vnode was rendered in the
    // same context.
    if ((child.context === context || child.functionalContext === context) &&
      data && data.slot != null
    ) {
      // 然后通过 data.slot 获取到插槽名称
      // 这个 slot 就是我们之前编译父组件在 codegen 阶段设置的 data.slot
      // 以插槽名称为 key 把 child 添加到 slots 中
      const name = child.data.slot
      const slot = (slots[name] || (slots[name] = []))
      if (child.tag === 'template') {
        slot.push.apply(slot, child.children)
      } else {
        slot.push(child)
      }
    } else {
      // 如果 data.slot 不存在，则是默认插槽的内容 则把对应的 child 添加到 slots.defaults 中
      defaultSlot.push(child)
    }
  }
  // ignore whitespace
  if (!defaultSlot.every(isWhitespace)) {
    slots.default = defaultSlot
  }
  // 这样就获取到整个 slots，它是一个对象，key 是插槽名称，value 是一个 vnode 类型的数组，因为它可以有多个同名插槽
  // 这个就是 vm.$slots
  return slots
}

function isWhitespace (node: VNode): boolean {
  return node.isComment || node.text === ' '
}

export function resolveScopedSlots (
  fns: ScopedSlotsData, // see flow/vnode
  res?: Object
): { [key: string]: Function } {
  res = res || {}
  // fns 是一个数组，每一个数组元素都有一个 key 和一个 fn，
  // key 对应的是插槽的名称，fn 对应一个函数。
  // 整个逻辑就是遍历这个 fns 数组，
  // 生成一个对象，对象的 key 就是插槽名称，value 就是函数
  for (let i = 0; i < fns.length; i++) {
    if (Array.isArray(fns[i])) {
      resolveScopedSlots(fns[i], res)
    } else {
      res[fns[i].key] = fns[i].fn
    }
  }
  return res
}
