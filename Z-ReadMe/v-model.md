```javascript
let vm = new Vue({
  el: '#app',
  template: '<div>'
  + '<input v-model="message" placeholder="edit me">' +
  '<p>Message is: {{ message }}</p>' +
  '</div>',
  data() {
    return {
      message: ''
    }
  }
})

/**
1、先是 parse 阶段 -> v-model 被当做普通的指令解析到 el.directives 中（src\compiler\codegen\index.js【50】）

2、在 codegen 阶段，执行 genData 的时候 会执行 
const dirs = genDirectives(el, state)（src/compiler/codegen/index.js【212】）

3、genDrirectives 方法就是遍历 el.directives（标签上的指令）这里是model，然后回找到 src/platforms/web/compiler/directives/model.js的model方法

4、执行这里的 genDefaultModel 方法（src/platforms/web/compiler/directives/model.js【48】）

5、执行 （src\platforms\web\compiler\directives\model.js【160】）
addProp(el, 'value', `(${value})`)
addHandler(el, event, code, null, true)
生成如下模板（代码块1）
其实就是动态绑定了 input 的 value 指向了 messgae 变量，并且在触发 input 事件的时候去动态把 message 设置为目标值，这样实际上就完成了数据双向绑定了

6、再回到 genDirectives，它接下来的逻辑就是根据指令生成一些 data 的代码：
最终生成（代码块2）的代码

**/


// （代码块1）
<input
  v-bind:value="message"
  v-on:input="message=$event.target.value" />

// 最终生成（代码块2）
with(this) {
  return _c('div',[_c('input',{
    directives:[{
      name:"model",
      rawName:"v-model",
      value:(message),
      expression:"message"
    }],
    attrs:{"placeholder":"edit me"},
    domProps:{"value":(message)},
    on:{"input":function($event){
      if($event.target.composing)
        return;
      message=$event.target.value
    }}}),_c('p',[_v("Message is: "+_s(message))])
    ])
}
```


```javascript
    let Child = {
        template: '<div>'
        + '<input :value="value" @input="updateValue" placeholder="edit me">' +
        '</div>',
        props: ['value'],
        methods: {
            updateValue(e) {
            this.$emit('input', e.target.value)
            }
        }
    }

    let vm = new Vue({
        el: '#app',
        template: '<div>' +
        '<child v-model="message"></child>' +
        '<p>Message is: {{ message }}</p>' +
        '</div>',
        data() {
            return {
            message: ''
            }
        },
        components: {
            Child
        }
    })

    /**
     * 1、执行 genData 函数中的 genDirectives 函数
     * 2、接着执行 src/platforms/web/compiler/directives/model.js 中定义的 model 函数
     * 3、genComponentModel 函数 src\compiler\directives\model.js ->生成代（代码块1）
     * 4、src\compiler\codegen\index.js 【265】
     * 5、父组件最终生成的 render 代码 （代码块2）
     * 6、然后在创建子组件 vnode 阶段，会执行 createComponent 函数，它的定义在 src/core/vdom/create-component.js 中：
     * 7、其中会对 data.model 的情况做处理，执行 transformModel(Ctor.options, data) 【290】生成代（代码块3）
     * 8、相当于我们写了（代码块4）
     * 9、典型的 Vue 的父子组件通讯模式，父组件通过 prop 把数据传递到子组件，子组件修改了数据后把改变通过 $emit 事件的方式通知父组件，
     * 所以说组件上的 v-model 也是一种语法糖。
    */

   // 代码块1
    el.model = {
        callback:'function ($$v) {message=$$v}',
        expression:'"message"',
        value:'(message)'
    }

    // 代码块2
    with(this){
        return _c('div',[
            _c('child',{
                model:{
                    value:(message),
                    callback:function ($$v) {
                        message=$$v
                    },
                    expression:"message"
                }
            }),
            _c('p',[_v("Message is: "+_s(message))])
        ],1)
    }

    //代码块3
    data.props = {
        value: (message),
    }
    data.on = {
        input: function ($$v) {
            message=$$v
        }
    } 

    //代码块4
    let vm = new Vue({
        el: '#app',
        template: '<div>' +
        '<child :value="message" @input="message=arguments[0]"></child>' +
        '<p>Message is: {{ message }}</p>' +
        '</div>',
        data() {
            return {
            message: ''
            }
        },
        components: {
            Child
        }
    })
```