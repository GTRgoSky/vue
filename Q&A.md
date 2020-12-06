## Q: computed 是怎么做缓存的：
## A:
在第一次渲染的时候，
它会声明一个Watcher实利，并且他的 watcher.dirty = true; 表示他是一个需要更新的数据。
在模板获取 computed时 执行 computedGetter，得到当前的computed watcher。
watcher 因为是dirty 所以执行 watcher.evaluate()： --- 待验证
这个方法会执行一次 watcher的 get方法。并且把 dirty 重置为 false，
get方法 就是 执行 computed 的方法，然后得到返回值（赋值给value也就是watcher.value);
当其他模板继续使用这个值时，因为drity时false 所以；将不会在执行computed方法
