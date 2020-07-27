/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type VNodeCache = { [key: string]: ?VNode };

function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

// 对 cache 做遍历，发现缓存的节点名称和新的规则没有匹配上的时候，就把这个缓存节点从缓存中摘除
function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      const name: ?string = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

function pruneCacheEntry (
  cache: VNodeCache,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const cached = cache[key]
  // 如果要删除的缓存的组件 tag 不是当前渲染组件 tag，执行删除缓存的组件实例的 $destroy 方法 (触发 beforeDestroy 和 destroyed 的钩子)
  if (cached && cached !== current) {
    cached.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',

  // 抽象组件
  abstract: true,

  props: {
    include: patternTypes, // 只有匹配的组件会被缓存
    exclude: patternTypes, // 任何匹配的组件都不会被缓存
    max: [String, Number] // 指定缓存大小（数量）
  },

  created () {
    // 用于缓存已经创建过的 vnode ！！
    this.cache = Object.create(null)
    this.keys = []
  },

  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  watch: {
    // 观测 include 和 exclude 的变化，对缓存做处理
    include (val: string | RegExp | Array<string>) {
      pruneCache(this, name => matches(val, name))
    },
    exclude (val: string | RegExp | Array<string>) {
      pruneCache(this, name => !matches(val, name))
    }
  },

  render () {
    // 1、首先获取第一个子元素的 vnode
    // 只处理第一个子元素，
    const vnode: VNode = getFirstComponentChild(this.$slots.default)
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      // 判断当前组件名称（要有组件名），和 include、exclude 的关系
      const name: ?string = getComponentName(componentOptions)
      // 如果匹配了排除，或者不匹配了包含且有名称，则直接返回vnode，否则走下一步
      if (name && (
        (this.include && !matches(this.include, name)) ||
        (this.exclude && matches(this.exclude, name))
      )) {
        return vnode
      }

      // 获取缓存
      const { cache, keys } = this
      // key是从组建的cid中获取，如果有vnode.key则从key中获取
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
        // 如果命中缓存则直接取，并且重新调整了 key 的顺序放在了最后一个
      if (cache[key]) {
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        remove(keys, key)
        keys.push(key)
      } else {
        // 把 vnode 设置进缓存
        cache[key] = vnode
        keys.push(key)
        // prune oldest entry
        // 如果配置了 max 并且缓存的长度超过了 this.max，还要从缓存中删除第一个
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }

      vnode.data.keepAlive = true
    }
    return vnode
  }
}
