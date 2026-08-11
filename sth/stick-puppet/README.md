# StickPuppet - 火柴人动画工具

## 启动

需要本地服务器（ES模块不支持 file:// 协议）：

```bash
# 方法1：Python
cd stick-puppet
python -m http.server 8080

# 方法2：Node
npx serve .
```

然后打开 http://localhost:8080

## 快捷键

| 按键 | 功能 |
|------|------|
| A | 复制当前帧 |
| ← → | 切换帧 |
| 空格 | 播放/暂停 |
| Ctrl+Z | 撤销 |
| Ctrl+Shift+Z / Ctrl+Y | 重做 |
| L | 切换骨骼锁定/解锁 |
| M | 左右互换 |
| Delete | 删除当前帧 |

## 功能

- **拖拽关节**：锁定模式下绕父关节旋转，解锁模式下自由拉伸
- **左右互换**：一键镜像翻转姿势，做循环动画时很方便
- **补帧插值**：选两个关键帧，自动生成中间过渡帧
- **双人模式**：新建双人 Clip，独立编辑每个角色，实时显示接触距离
- **参照层**：侧栏「参照物 (context)」面板选类型（手持道具/环境物件/对手方角色）+ 引用（下拉取值分别来自 ATTACHMENT_DEFS / propDefaults / skeleton.json 的键名），只写引用名，不抄几何数值；held/prop 画布上显示轮廓，counterpart 只在左上角标文字（无第三档几何渲染规格，纯文档提示）。载入 clip 时面板自动回填当前 context；导出（含 cycle/overlay、duet、variant 三种模式）都会带上
- **JSON 导入/导出**：完整动画数据可保存和加载

## 文件结构

```
stick-puppet/
├── index.html
├── style.css
├── js/
│   ├── app.js        # 主逻辑
│   ├── config.js     # 骨骼配置、常量
│   └── history.js    # 撤销/重做
└── README.md
```
