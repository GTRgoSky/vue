/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   *  'component',
      'directive',
      'filter'
      绑定全局组件，指令，过滤器
   */
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        // 组件且传到是函数
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
          // packages\weex-vue-framework\factory.js
          //  把definition这个对象转换成一个继承于 Vue 的构造函数
          // 若是局部注册则再src\core\instance\init.js中有一个合并过程
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        // components何时绑上去得 -- fxquestion
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
