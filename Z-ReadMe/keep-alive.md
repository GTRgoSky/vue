```javascript
let A = {
  template: '<div class="a">' +
  '<p>A Comp</p>' +
  '</div>',
  name: 'A'
}

let B = {
  template: '<div class="b">' +
  '<p>B Comp</p>' +
  '</div>',
  name: 'B'
}

let vm = new Vue({
  el: '#app',
  template: '<div>' +
  '<keep-alive>' +
  '<component :is="currentComp">' +
  '</component>' +
  '</keep-alive>' +
  '<button @click="change">switch</button>' +
  '</div>',
  data: {
    currentComp: 'A'
  },
  methods: {
    change() {
      this.currentComp = this.currentComp === 'A' ? 'B' : 'A'
    }
  },
  components: {
    A,
    B
  }
})

// 1、Vue 的渲染最后都会到 patch 过程（src\core\vdom\patch.js 【73】createPatchFunction），
// 而组件的 patch 过程会执行 createComponent 方法（src/core/vdom/patch.js）
// 2、createComponent 定义了 在keep-alive 中使用 isReactivated 的变量；第一次渲染组件的时候为 TRUE  
// 3、因为它的父组件 <keep-alive> 的 render 函数会先执行，那么该 vnode 缓存到内存中（src\core\components\keep-alive.js【122】）
// 并且设置 vnode.data.keepAlive 为 true（src\core\components\keep-alive.js【131】）
// 4、因为 isReactivated 为 FALSE ，那么走正常的 init 的钩子函数执行组件的 mount。
// 当 vnode 已经执行完 patch 后，执行 initComponent（src\core\vdom\patch.js【194-203】） 函数
// initComponent 这里会有 vnode.elm 缓存了 vnode 创建生成的 DOM 节点
// 5、缓存渲染
// 6、当数据发送变化，在 patch 的过程中会执行 patchVnode 的逻辑（src\core\vdom\patch.js【466】）
// 它会对比新旧 vnode 节点，甚至对比它们的子节点去做更新逻辑
// 7、patchVnode 在做各种 diff 之前，会先执行 prepatch 的钩子函数（src/core/vdom/create-component【60】）
// prepatch 核心逻辑就是执行 updateChildComponent 方法，它的定义在 src/core/instance/lifecycle.js 中
// 8、updateChildComponent 方法主要是去更新组件实例的一些属性（这里我们重点关注一下 slot 部分）
// 由于 <keep-alive> 组件本质上支持了 slot，所以它执行 prepatch 的时候，需要对自己的 children，也就是这些 slots 做重新解析
// 并触发 <keep-alive> 组件实例 $forceUpdate 逻辑 -》 重新执行 <keep-alive> 的 render 方法
// 9、这个时候如果它包裹的第一个组件 vnode 命中缓存，则直接返回缓存中的 vnode.componentInstance（在我们的例子中就是缓存的 A 组件）
// 10、接着又会执行 patch 过程，再次执行到 createComponent 方法（createPatchFunction - createComponent）
// 此时 isReactivated 为 TRUE
// 11、并且在执行 init 钩子函数的时候不会再执行组件的 mount 过程了，相关逻辑在 src/core/vdom/create-component.js 中
// 这也就是被 <keep-alive> 包裹的组件在有缓存的时候就不会在执行组件的 created、mounted 等钩子函数的原因了
// 12、createComponent 方法，在 isReactivated 为 true 的情况下会执行 reactivateComponent（src\core\vdom\patch.js【222】）
// 13、最后通过执行 insert(parentElm, vnode.elm, refElm) 就把缓存的 DOM 对象直接插入到目标元素中，这样就完成了在数据更新的情况下的渲染过程。
```