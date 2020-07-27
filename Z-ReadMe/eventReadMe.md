```javascript
eg:
let Child = {
  template: '<button @click="clickHandler($event)">' +
  'click me' +
  '</button>',
  methods: {
    clickHandler(e) {
      console.log('Button clicked!', e)
      this.$emit('select')
    }
  }
}

let vm = new Vue({
  el: '#app',
  template: '<div>' +
  '<child @select="selectHandler" @click.native.prevent="clickHandler"></child>' +
  '</div>',
  methods: {
    clickHandler() {
      console.log('Child clicked!')
    },
    selectHandler() {
      console.log('Child select!')
    }
  },
  components: {
    Child
  }
})

// 经过 src\compiler\parser\index.js -》parseModifiers（545） -》 如果是事件的指令addHandler（581）
// 生成 ↓

el.events = {
  select: {
    value: 'selectHandler'
  }
}

el.nativeEvents = {
  click: {
    value: 'clickHandler',
    modifiers: {
      prevent: true
    }
  }
}

// 子组件的 button 节点生成的 el.events 如下
el.events = {
  click: {
    value: 'clickHandler($event)'
  }
}

// 会在 src\compiler\codegen\index.js =》 genData（200） 函数中
// 根据 AST 元素节点上的 events（240） 和 nativeEvents（243） 生成 data 数据 -》调用 genHandlers 

// src\compiler\codegen\events.js -》 genHandlers（37）

// 父组件生成-》
data:{
  on: {"select": selectHandler},
  nativeOn: {"click": function($event) {
      $event.preventDefault();
      return clickHandler($event)
    }
  }
}
//子组件
data:{
  on: {"click": function($event) {
      clickHandler($event)
    }
  }
}
```