# dsh-token-saver-100

**token 立省 100%** — 一个把 DeepSeek Harness 的每一次模型调用都拦下来、直接回你一句
「恭喜你，又省下了 token！」的插件。省下的调用次数记在设置页里。

> 这是个玩笑插件（joke plugin）。它并不能真的让你的 agent 更聪明，只是让每一轮对话
> 都得到同一句固定回复，从而**一个 token 都不花**。

## 效果

- 你随便发一条消息，插件在模型调用分发之前就把它拦下，替换成一段本地生成的文本流，
  于是助手回复永远是「恭喜你，又省下了 token！」。
- 设置页多出一个 **token立省100%** 分页，显示「当前共省 *n* 次可能的 token 消耗」，
  *n* 在每次拦截时 +1，并持久化在磁盘上，重启后继续累加。
- 标题生成、上下文压缩等带 `purpose` 的后台请求**不受影响**，所以会话列表、压缩等
  功能仍然正常工作。

## 安装

把仓库克隆到本地任意目录，然后在 DeepSeek Harness 的 **插件 → 添加插件** 里选择该目录
（本地目录安装是软链接，改代码即生效）；或者直接用 `plugin_manager` 的 `install_bundle`，
`target` 传包的绝对路径。

```bash
git clone https://github.com/Frost-wu/dsh-token-saver-100.git
```

安装后需要重启 Harness（或用托盘退出后重开）才会加载新的模块。

## 工作方式

| 文件 | 职责 |
| --- | --- |
| `index.js` | Host 半边：挂 `llm/stream` 瀑布（`prepend: true`），命中即自造 chunk 流并 `increment()`；另外注册 `/token-saver-100/state` 同源 JSON 路由 |
| `client.js` | 浏览器半边：往 `settings.section` 插一个分页，打开/轮询（4s）/切回标签页时刷新计数 |
| `cordis.patch.yml` | 往 Loader 里插入 `token-saver-100` 这一行 |
| `locale/*.json` | 插件管理器和设置页的中英文标题、描述 |

拦截判定很简单：请求带 `sessionId`、且**没有** `purpose`，就认定为对话主流程的调用。
计数写在 `$DSH_HOME/token-saver-100/state.json`（原子写入：临时文件 + rename），
不使用插件 Config，因为设置页只读它，而这个值是插件自己写的。

## 卸载

在 **插件** 里禁用或移除 `dsh-token-saver-100`。计数文件留在
`$DSH_HOME/token-saver-100/state.json`，需要的话手动删掉即可。

## 许可

[MIT](LICENSE)