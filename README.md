# dsh-think-flow

Codex 风格的过程播报：让 agent 在工具调用之间用正文说明「正在做什么、做到哪一步、结果如何」，
而不是只在回合结束时一次性汇报。

插件把一段可配置的行为规则注入 DSH 的系统提示，并在 **插件页 → dsh-think-flow**
里提供自己的配置页。配置存在 `$DSH_HOME/think-flow.json`，每个回合重新读取，
保存后下一回合生效，不需要重启。

## 安装

```sh
dsh plugin --profile desktop add file:/path/to/dsh-think-flow
```

安装后重启一次 DSH（或在该插件卡片上关→开触发重组），客户端半侧才会加载。

## 设置项

| 字段 | 说明 |
| --- | --- |
| 播报颗粒度 | `关闭` / `简洁` / `标准`（默认）/ `详细`。关闭后完全恢复 DSH 默认行为。 |
| 计划最多几步 | 开始时最多列出的编号步骤数（2–12，默认 6）。 |
| 播报语言 | 跟随用户 / 中文 / English。 |
| 额外要求 | 追加到内置规则末尾的自定义要求，可留空。 |

## 实现

- 宿主半侧：`ctx.systemPrompt.section()` 注册 `think-flow` 段；段文本是 provider，
  每次组装系统提示时读取设置文件，因此改完立即生效。
- 设置路由：`/think-flow/config`（GET 读取，POST 保存），仅接受同源请求。
- 客户端半侧：注册 `plugins.bundle.config` 槽，在插件详情页渲染配置表单。

## 开发

```sh
# 语法自检
node -e 'import("./lib/index.js").then(m => console.log(m.name, m.buildSectionText({ granularity: "standard" }).length))'
```

源码目录里的 `node_modules/@deepseek-ai/schemastery` 只是本地自检用的软链；
安装到 profile 后由宿主提供该 peer 依赖。
