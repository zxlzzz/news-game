# 文档策略

文档只有两种合法状态，按更新机制而非内容分类：

## normative（随代码强制更新）

- 改代码使其失真 → 同 commit 必须更新，CC 任务验收含此项
- 必须极小：能 grep 出来的信息不写（真相源=代码）；
  单文件事实写文件头契约注释，不进独立文档
- 仅限：`contracts/` 下文件 + `CLAUDE.md`
- 硬上限：`contracts/` 新增文件前必须先证明
  "无法用文件头注释 + check-invariants 规则替代"
- 引用代码一律 `file#符号名` 锚点，行号只作括号附注

## snapshot（永不更新正文）

- 设计稿：记录"为什么这么设计"，定稿即冻结；
  实现后文首加一行 `implemented in <commit>`；
  被取代加 `superseded by <doc>`，正文不动
- 审计/基线：文首带日期，过时以新文件替代
- status 头枚举：`draft` / `finalized` / `implemented` / `superseded` / `snapshot`

## 写前判据

三个月后谁读它、它还真吗？
不真且无人被强制更新 → 别写，或写成带日期 snapshot。
plan 的活状态只存在于 roadmap（一条一行只记状态），细节在冻结设计稿。
