```javascript
// 组件
let AppLayout = {
  template: '<div class="container">' +
  '<header><slot name="header"></slot></header>' +
  '<main><slot>默认内容</slot></main>' +
  '<footer><slot name="footer"></slot></footer>' +
  '</div>'
}

// 实例
let vm = new Vue({
  el: '#app',
  template: '<div>' +
  '<app-layout>' +
  '<h1 slot="header">{{title}}</h1>' +
  '<p>{{msg}}</p>' +
  '<p slot="footer">{{desc}}</p>' +
  '</app-layout>' +
  '</div>',
  data() {
    return {
      title: '我是标题',
      msg: '我是内容',
      desc: '其它信息'
    }
  },
  components: {
    AppLayout
  }
})

// 生成
<div>
  <div class="container">
    <header><h1>我是标题</h1></header>
    <main><p>我是内容</p></main>
    <footer><p>其它信息</p></footer>
  </div>
</div>


/**
 * 1、$mounted进入编译 - src\platforms\web\entry-runtime-with-compiler.js
 * 2、执行 compileToFunctions 【52】-执行 parse
 * 3、执行 src\compiler\parser\index.js【188】 processElement 编译模板（slot=“”）/标签<slot>
 * 4、在父组件中- 当解析到标签上有 slot 属性的时候，会给对应的 AST 元素节点添加 slotTarget 属性，
 * 5、进入codegen阶段（src\compiler\index.js 3个阶段）（将VNODE编译成可执行函数）编译形成（代码块1） 
 * 5、在子组件中当遇到 slot 标签的时候会给对应的 AST 元素节点添加 slotName 属性，然后进入codegen 阶段
 * 6、在 codegen 阶段，会判断如果当前 AST 元素节点是 slot 标签，则执行 genSlot 函数（src/compiler/codegen/index.js【470】）
 * 7、先不考虑 slot 标签上有 attrs 以及 v-bind 的情况，那么它生成的代码 （代码块2）
 * 8、最终生成：（代码块3）
 * 9、_t 函数对应的就是 renderSlot 方法（src/core/instance/render-heplpers/render-slot.js【8】）
 * 10、执行 resolveSlots  （src/core/instance/render-helpers/resolve-slots.js【6】-》获取 renderSlot 中需要的 this.$slots
 * 11、根据key渲染需要slot的Vnode数组对应的 slot 渲染成 vnodes，作为当前组件渲染 vnode 的 children
*/


// 代码块1
with(this){
    return _c('div',
        [
            _c('app-layout',
            [
                _c('h1',{attrs:{"slot":"header"},slot:"header"},[
                    _v(_s(title))
                ]),
                _c('p',[
                    _v(_s(msg))
                ]),
                _c('p',{attrs:{"slot":"footer"},slot:"footer"},[
                    _v(_s(desc))
                ])
            ])
        ],
    1)}

    // 代码块2
    const slotName = el.slotName || '"default"'
    const children = genChildren(el, state)
    let res = `_t(${slotName}${children ? `,${children}` : ''}`

    // 代码块3
    with(this) {
    return _c('div',{
            staticClass:"container"
        },[
            _c('header',[_t("header")],2),
            _c('main',[_t("default",[_v("默认内容")])],2),
            _c('footer',[_t("footer")],2)
        ]
    )
    }
```


```javascript
// 作用域插槽

let Child = {
  template: '<div class="child">' +
  '<slot text="Hello " :msg="msg"></slot>' +
  '</div>',
  data() {
    return {
      msg: 'Vue'
    }
  }
}

let vm = new Vue({
  el: '#app',
  template: '<div>' +
  '<child>' +
  '<template slot-scope="props">' +
  '<p>Hello from parent</p>' +
  '<p>{{ props.text + props.msg}}</p>' +
  '</template>' +
  '</child>' +
  '</div>',
  components: {
    Child
  }
})

<div>
  <div class="child">
    <p>Hello from parent</p>
    <p>Hello Vue</p>
  </div>
</div>


/**
 * 1、先编译父组件，同样是通过 processSlot 函数去处理 scoped-slot，（ src/compiler/parser/index.js ）
 * 2、对于拥有 scopedSlot 属性的 AST 元素节点而言，是不会作为 children 添加到当前 AST 树中，而是存到父 AST 元素节点的 scopedSlots 属性上，它是一个对象，以插槽名称 name 为 key
 * 3、然后在 genData 的过程，会对 scopedSlots 做处理
 * 4、genScopedSlots 对 scopedSlots 对象遍历，执行 genScopedSlot 把结果用逗号拼接，而 genScopedSlot 是先生成一段函数代码，并且函数的参数就是我们的 slotScope，也就是写在标签属性上的 scoped-slot 对应的值，然后再返回一个对象，key 为插槽名称，fn 为生成的函数代码
 * 5、它和普通插槽父组件编译结果的一个很明显的区别就是没有 children 了，data 部分多了一个对象，并且执行了 _u 方法（代码块1）
 * 6、子组件的编译，和普通插槽的过程基本相同，唯一一点区别是在 genSlot 的时候
 * 7、会对 attrs 和 v-bind 做处理，对应到我们的例子，最终生成的代码如下（代码块2）
 * 8、回到 genSlot 函数，我们就可以通过插槽的名称拿到对应的 scopedSlotFn，然后把相关的数据扩展到 props 上，作为函数的参数传入，原来之前我们提到的函数这个时候执行，然后返回生成的 vnodes，为后续渲染节点用
*/

// 代码块1
// 没有 children 了，data 部分多了一个对象，并且执行了 _u 方法
// _u 函数对的就是 resolveScopedSlots 方法，它的定义在 src/core/instance/render-heplpers/resolve-slots.js 中
with(this){
  return _c('div',
    [_c('child',
      {scopedSlots:_u([
        {
          key: "default",
          fn: function(props) {
            return [
              _c('p',[_v("Hello from parent")]),
              _c('p',[_v(_s(props.text + props.msg))])
            ]
          }
        }])
      }
    )],
  1)
}

// 代码块2 子组件的编译
// 唯一一点区别是在 genSlot 的时候
// 它会对 attrs 和 v-bind 做处理，对应到我们的例子，最终生成的代码如下
// _t 对应 renderSlot 方法
with(this){
  return _c('div',
    {staticClass:"child"},
    [_t("default",null,
      {text:"Hello ",msg:msg}
    )],
  2)}
```