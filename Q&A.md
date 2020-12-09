## Q: computed 是怎么做缓存的：

在第一次渲染的时候，
它会声明一个Watcher实利，并且他的 watcher.dirty = true; 表示他是一个需要更新的数据。
在模板获取 computed时 执行 computedGetter，得到当前的computed watcher。
watcher 因为是dirty 所以执行 watcher.evaluate()： --- 待验证
这个方法会执行一次 watcher的 get方法。并且把 dirty 重置为 false，
get方法 就是 执行 computed 的方法，然后得到返回值（赋值给value也就是watcher.value);
当其他模板继续使用这个值时，因为drity时false 所以；将不会在执行computed方法


## Q：Vue-compile的作用和行为：
https://zhuanlan.zhihu.com/p/114239056

该模块可用于将 Vue 2.0 模板预编译为渲染函数（template => ast => render），以避免运行时编译开销和 CSP 限制

vue-template-compiler 的代码是从 vue 源码中抽离的

```js
// 举例学习：
const compiler = require('vue-template-compiler')
// compiler.compile(template, [options])

const result = compiler.compile(`
  <div id="test">
    <div>
      <p>This is my vue render test</p>
    </div>
    <p>my name is {{myName}}</p>
  </div>`
)

console.log(result)

// 生成

{
  ast: ASTElement, // 解析模板生成的ast
  render: string,    // 渲染函数
  staticRenderFns: Array<string>, // 静态子树
  errors: Array<string>,
  tips: Array<string>
}


{
  ast: {
    type: 1,
    tag: 'div',
    attrsList: [ [Object] ],
    attrsMap: { id: 'test' },
    rawAttrsMap: {},
    parent: undefined,
    children: [ [Object], [Object], [Object] ],
    plain: false,
    attrs: [ [Object] ],
    static: false,
    staticRoot: false
  },
  render: `with(this){return _c('div',{attrs:{"id":"test"}},[ // 对应 children 的三个 Object
        _m(0),          // 上述提到的静态子树，索引为0 <div><p>This is my vue render test</p></div>
        _v(" "),        // 空白节点 </div> <p> 之间的换行内容
        _c('p',[_v("my name is "+_s(myName))])  // <p>my name is {{myName}}</p>
    ])}`,
  staticRenderFns: [
    `with(this){return _c('div',[_c('p',[_v("This is my vue render test")])])}`
  ],
  errors: [],
  tips: []
}

// generate(ast, options) 生成 render函数
```

```js
// compiler.parseComponent(file, [options])
// 将 SFC （单文件组件或* .vue文件）解析为描述符「以下述提供SFC为例」

{
  template: {
    type: 'template',
    content: '\n<div class="example">{{ msg }}</div>\n',
    start: 10,
    attrs: {},
    end: 54
  },
  script: {
    type: 'script',
    content: '\n' +
      'export default {\n' +
      '  data () {\n' +
      '    return {\n' +
      "      msg: 'Hello world!'\n" +
      '    }\n' +
      '  }\n' +
      '}\n',
    start: 77,
    attrs: {},
    end: 174
  },
  styles: [
    {
      type: 'style',
      content: '\n.example {\n  color: red;\n}\n',
      start: 194,
      attrs: {},
      end: 236
    }
  ],
  customBlocks: [
    {
      type: 'custom1',
      content: '自定义块',
      start: 257,
      attrs: {},
       end: 261
    }
  ],
  errors: []
}
```

## Q：vue-loader的作用和行为：

// vue-loader 将解析文件，提取每个语言块，如有必要，将它们通过其他加载器进行管道传输，最后将它们组装回ES 模块，其默认导出为 Vue.js 组件选项对象。


#### Template：
每个*.vue. 文件一次最多可以包含一个 <template> 块；内容将被提取并传递给 vue-template-compiler 并预编译为 JavaScript 渲染函数，最后注入<script> 部分的导出组件中

#### Script：
每个 *.vue. 文件一次最多可以包含一个 <script> 块；任何针对 .js 文件的 webpack rules 都将应用于 <script> 块中的内容

#### Style： 
默认匹配/\.css$/；可以包含多个 <style> 块；可以包含 Scoped 或者 module 属性；任何针对 .css 文件的 webpack rules 都将应用于 <style> 块中的内容

#### Custom Blocks： 
自定义块，以满足任何项目的特定需求

```js
/// 在模板中，我们 import Components from 'xxx';
Components = {
    beforeCreate: [ƒ]
    beforeDestroy: [ƒ]
    data: ƒ ()
    render: ƒ ()
    staticRenderFns: []
    _Ctor: {0: ƒ}
    __file: "E:***/vue-yuanma-study/compile/index.vue"
    __proto__: Object
}
```
