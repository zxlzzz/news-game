# 环境美术资源路线

状态：**两个 Quaternius 免费包已全部封装成自包含 GLB**；默认保留原色，但素材库是
可重新下载的工作库，不是不可修改的档案。环境供给采用
“真实 3D 素材 → 自包含 GLB → 使用前按需清理 → Godot 场景级风格处理/真实光影 →
需要时三渲二进入 PixiJS”的链路；GLB 同时保留为未来 Godot 运行时 3D 的可复用资产。
Blender 只是清理与封装中转站，Hsinlung 不需要手工处理模型。

## 目标

保留火柴人和固定斜视角，参考《巴别塔圣歌》的效果处理，但不把当前配色烘进模型：

- 用统一光源和可切换的场景级调色建立可信体积；灰度只是可选 Look；
- 只强调外轮廓、主要转折和必要结构线，不描完整低模网格；
- 追求插画化的空间可信度，不追求照片材质或写实 PBR。

真实方向光阴影的观感已获得初步认可，可以保留为 Godot 场景效果；它不烘进 GLB。
如果最终接入主画面，环境、车辆和 NPC 必须由同一几何与光源解释，不能用脚下圆圈或
粗略压暗区域敷衍真实性。

参考的是它的明暗、线条和阴影组织方式，不复制其配色、具体造型或画面。

## 当前约束

- 当前阶段不考虑视角转动；资源只生成一个固定视图。
- 不预先检查或统一清理全库；模型实际进入场景前逐个检查，发现不适合最终画面的内置
  细节时直接修改素材库中的 GLB。原下载包可重新取得，因此不额外保留项目内备份。
- 相机允许平移、缩放，物体在场景中有远近位置变化，但没有透视式近大远小。
- NPC 继续使用 2D 火柴人；环境资源和动作数据是否使用 3D 是两件独立的事。
- 游戏运行时仍是 PixiJS 2D，不加载 GLB，不加载 Three.js，不做实时 3D 光照。
- 绝大多数建筑和道具优先找可修改的现成 3D 素材；手工建模只负责清理、组合、补缺和
  少数关键造型，不能假设逐个从零建完整场景。
- 保留模型源文件和 Godot 工程，以便以后转成真正的 Godot 3D 游戏；可复用的是模型、
  材质、shader 和场景组合，不代表 PixiJS 的玩法、导航和 UI 会自动迁移。

## 总管线

```text
现成模型 / 自制补件
        ↓
Blender 按需清理、拆件、统一米制尺寸并封装自包含 GLB
（默认保留颜色 / alpha / 法线 / ORM / 几何；明确有害的材质细节按需原地清理）
        ↓
Godot 固定相机 + 统一 shader / 光源 / 可切换 Look 离线出图
        ↓
填色 / 线稿 / 可选阴影三层
        ↓
WebP 图集 + 图集 JSON
        ↓
Pixi 按地面锚点、米制尺寸和 Y 深度显示
```

`.blend` 可以保留为可编辑母版，GLB 是 Blender、Godot 和未来 Web 工具之间的首选交换
格式；WebP 图集才是当前游戏实际加载的画面素材。

### 使用前按需清理

不做全库预扫描。每个模型第一次被场景采用时，先在目标相机和 Look 下检查，再把确认
有害的内容直接写回 `assets/fromgodot/<pack>/` 中的 GLB。清理必须按明确的材质或节点
语义命中，禁止用全材质统一覆盖。

当前三栋样片建筑的 `MI_FakeInterior_1…4` 使用微缩室内照片，在黑白清线 Look 下会变成
无法辨认的亮点和碎线，已用 `tools/blacken_fake_interiors.py` 移除其颜色贴图引用并改为
纯黑。工具会拒绝没有这组材质名的模型，要求先人工检查，不能拿它批量扫全库。

## 素材来源和格式

优先寻找模块化、比例可信、结构清楚、不过分依赖贴图细节的素材。原模型不需要已经是
《巴别塔圣歌》画风；画风主要由统一相机、光源、明暗分档和线条产生。

格式优先级：

1. `.glb` / glTF 2.0：首选交换格式，可直接进 Blender 和 Godot；
2. `.blend`：适合保留可编辑源，但对外交换仍导出 GLB；
3. `.fbx` / `.obj`：可作为输入，经 Blender 检查后转 GLB；
4. Unity `.unitypackage`、Unreal `.uasset`、只有 Godot `.tscn` 而没有可移植网格的素材：
   不作为主要来源。

许可证优先 CC0、MIT；CC BY 可以使用，但必须保留作者和署名要求。禁止使用 NC、来源
不明或许可证不清楚的素材。每次下载都要保留原始链接、作者、许可证和版本；模型进入
项目前再记录实际修改。

### 已核对的候选来源（尚未导入）

- [Quaternius Downtown City MegaKit](https://quaternius.com/packs/downtowncitymegakit.html)：
  当前建筑首选。CC0；免费版含约 60–70% 模型，提供 glTF／FBX／OBJ，已有模块化楼体、
  街道零件和示例建筑。付费 Source 版主要增加剩余模型、`.blend` 和引擎工程，第一张
  样片不需要购买。
- [Kenney City Kit: Commercial](https://kenney.nl/assets/city-kit-commercial)、
  [Suburban](https://kenney.nl/assets/city-kit-suburban)、
  [Roads](https://kenney.nl/assets/city-kit-roads)：全部 CC0，模型干净、体量小、GLB 友好；
  真实性弱于 Quaternius／Poly Haven，但适合补道路、路灯、交通标志和做低风险管线验证。
- [Quaternius Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html)：
  当前树木首选。CC0；免费版提供 glTF／FBX／OBJ，几何清楚、面数适中，比扫描树更适合
  轮廓线和分档明暗测试。
- [Poly Haven 3D Models](https://polyhaven.com/models)：全站模型 CC0，提供 `.blend`、
  glTF、FBX 等格式，真实比例和细节最好。适合选择性补关键模型，例如
  [模块化公寓立面](https://polyhaven.com/a/modular_urban_apartments_facade)、
  [模块化街椅](https://polyhaven.com/a/modular_street_seating) 和
  [街灯](https://polyhaven.com/a/street_lamp_01)；不适合不加筛选地整站导入，因为部分
  扫描树和高精模型面数、贴图体积都过大，线稿也可能产生噪声。

首轮只需 Quaternius Downtown City MegaKit 免费版和 Stylized Nature MegaKit 免费版；
Kenney 与 Poly Haven 先保留为补件来源，不需要一次下载齐全。

## 制作端文件

首批已采用的 3D 交付目录：

```text
assets/fromgodot/
  <pack>/*.glb     # 可直接拖进 Godot、保留原色的自包含模型
  <pack>/LICENSE.txt
```

需要继续编辑的 `.blend` 母版、批量 catalog 和离线出图配置等到实际需要时再增加，
不为首批转换预建空结构。

每个模型必须：

- 使用米作为单位；
- 原点位于地面接触点；
- 按统一坐标轴和固定朝向摆放；
- 记录来源、作者和许可证；
- 允许显式标记必须保留的内部线，如门缝、窗框和招牌边缘。

模型包围盒是视觉物理尺寸的默认真相。旧程序化绘制里由历史屏幕像素迁移出来的
尺寸不得继续作为新素材的标定依据。

## 唯一投影与光源

制作工具和游戏必须消费同一份机器可读配置。当前 `Projection.js` 的
`TILT_DEG=20` / `SHEAR=0.2` 仍是暂定值，不能让烘焙器再独立硬编码一套相机角度。

统一配置至少包含：

- 固定正交相机／投影基向量；
- 左前上方主光方向；
- 弱环境光强度；
- 调色／LUT、可选灰度转换与量化档位；
- 明暗分档阈值；
- 轮廓宽度和折角阈值；
- 落影方向、透明度、硬度和接触影强度。

投影尚未校准前可以继续试验，但不能开始批量出正式资源。

## 每个资源最多三个输出层

### 1. 填色层 `fill`

包含场景 Look 处理后的颜色、自身分面明暗和 AO／凹陷暗部。模型保留原色；灰度、双色调
或有限调色板都在组合场景中生成。五档量化与 0.30–0.88 明度压缩曾吞掉窗格、砖纹等
细节，任何 Look 都必须在组合场景中证明不会丢失这些结构信息。

### 2. 线稿层 `line`

单独输出：

- 固定视角下的外轮廓；
- 超过阈值的主要结构折角；
- 模型显式标记的必要内部线。

线稿独立成层，便于按远近或相机缩放单独调节。禁止用多次偏移 Sprite 的方式给
整张透明图扩边；那会把物体做成贴纸，也无法区分主要轮廓和次要接缝。

### 3. 可选阴影层 `shadow`

模型放在透明接影地面上，单独输出地面落影和更深的接触影。阴影与物体共享地面
锚点，但运行时位于地面层，因此 NPC 和车辆可以正常走在影子上方。是否正式产出这层，
要等组合样片比较后再决定；`art-manifest.json` 必须允许 `shadow` 缺省。

一个资源最终具有三个图集 frame：

```text
tree_oak.fill
tree_oak.line
tree_oak.shadow
```

## 游戏实际携带的文件

```text
assets/art/environment.webp
assets/art/environment.json
assets/art/art-manifest.json
assets/art/render-style.json
```

- `environment.webp`：透明 WebP 图集；规模增长后按 buildings / props / vegetation
  等类别拆分。
- `environment.json`：标准 Pixi 图集帧数据。
- `art-manifest.json`：frame 关系、米制尺寸、地面锚点、默认足迹和许可索引。
- `render-style.json`：制作端与运行时共用的投影和画风配置。

资源条目形状示例：

```json
{
  "id": "tree_oak",
  "frames": {
    "fill": "tree_oak.fill",
    "line": "tree_oak.line",
    "shadow": "tree_oak.shadow"
  },
  "sizeM": [3.2, 3.0, 4.0],
  "groundAnchor": [0.51, 0.96],
  "footprintM": [1.1, 1.0]
}
```

## 视觉和行为分离

`propType` 继续表示实体是什么、能做什么；`assetId` 只表示它长什么样：

```json
{
  "propType": "bench",
  "assetId": "bench_stone_01",
  "x": 1200,
  "y": 2500
}
```

座位、碰撞、affordance、交互槽位和行为仍属于项目数据，不写入图片。视觉足迹默认
从米制模型底面生成；游戏需要时允许显式覆盖，但覆盖值仍必须是米／世界单位，不能
回到裸屏幕像素。

## Pixi 显示结构

现有实体全部重画进一个 `PIXI.Graphics`，无法自然混排持久 Sprite。正式接线需要
形成混合显示层：

```text
worldContainer
  groundContainer       # 地面、路径、所有 shadow Sprite
  entityContainer       # fill + line、NPC、车辆，按 _sortY 排序
  effectContainer       # 必要的前景效果
```

每个导入资源由 `fillSprite + lineSprite` 组成，阴影 Sprite 单独进入地面层。静态资源
创建一次后不再每帧重画；旧程序化 Graphics 可以作为子节点共存，按类别逐步替换，
不做一次性全场重写。

不使用“进入某个大致范围就把 NPC 整体压暗”之类的近似来冒充真实阴影。如果最终要求
NPC 的动态阴影准确投到台阶、墙体和其他物体上，纯离线 Sprite 管线无法完整解决，届时
必须重新评估运行时 3D／混合渲染；在这个决定之前，阴影保持独立且可关闭。

## NPC、车辆、建筑和地面

- NPC 保持火柴人；在阴影方案确定前不额外添加脚下圆圈或假接触影。
- 车辆可先保留现有程序化画法，之后使用同一资源管线，不是首批前置。
- 建筑必须最终进入米制资源体系，因为当前最严重的问题之一就是楼层高度和整体体量
  不可信。建筑的门、窗、楼层和进深应来自真实模型尺寸。
- 道路、公园等地面色带继续数据驱动，不需要烘成一张巨大背景；它们接受建筑和道具
  的阴影层。

## 分辨率和远近

- 每张资源的烘焙分辨率由物理尺寸、游戏最大 zoom 和抗锯齿余量自动计算，不能所有
  资源固定输出 1024×1024。
- 游戏中的远近不改变物理尺寸；远处只减弱线稿、对比和阴影。
- 若宽景下线条消失或近景下线条过粗，可以增加少量线稿 LOD，不重复烘焙填色层。
- WebP 必须保留干净透明边缘，避免有损压缩在线稿和阴影周围产生白边。

## 制作工具

当前制作端先采用：

- **Blender（Steam 最新版即可）**：只负责素材检查、拆件、修复、统一尺寸／坐标和导出
  GLB；Hsinlung 不需要手工承担这些操作。
- **Godot 4.7.2 Standard**：固定相机、灯光、风格 shader、组合样片和离线出图。
- **Sennaar shader demo**：作为可修改的效果起点，不视为已经完成的生产方案。

现有 `sth/asset-import-spike.html` 保留为“GLB → 透明图片 → Pixi 排序”的技术证据，不再
默认把它扩成正式烘焙器。Godot 样片通过后，再把以下能力做成可重复工具：

- 批量读取 GLB 和 catalog；
- 分别生成 fill / line / shadow；
- 自动裁透明边并保持三层共享锚点；
- 按物理尺寸决定分辨率；
- 自动打包 WebP 图集和标准 JSON；
- 提供组合场景预览、来源许可和错误检查。

Godot 只是当前优先候选；不论制作端以后换成 Blender、Godot 或其他工具，图集合同和
Pixi 运行时都不应随之重做。

## 验收方式

不能再用单独一棵树或脱离真实几何的手绘假透视判断路线是否成立。正式风格样片至少
同时包含：

- 一栋按真实楼层和进深制作的建筑；
- 一棵有机形态的树；
- 长椅或售货机；
- 一根细长灯杆；
- 道路、人行道和前后行走的火柴人；
- 同一构图的“无阴影／有阴影”两个版本，用来单独判断阴影是否真的增益。

同一组合样片检查宽景、中景和近景：尺寸、光源、接地、线条层级、阴影、色值分离、
火柴人可读性、透明边缘、排序和遮挡必须同时成立。得到 Hsinlung 的视觉认可之前，
不得批量导入资源。

## 明确不采用

- 不把 GLB、Three.js 或实时 3D 光照带进游戏。
- 不用手写 SVG／2D 多边形拼假三维来冒充资源管线样片；没有真实几何就无法可靠处理
  比例、遮挡和阴影。
- 不用统一扩边制造贴纸式轮廓。
- 不破坏性改写模型的基础颜色；灰度、换色和其他视觉 Look 留在场景渲染阶段。
- 不把填色、线稿、阴影烘死成一个不可分的单层 Sprite。
- 不沿用未经米制校准的旧程序化尺寸作为新素材真相。
- 不把“逐个从零建模”当作场景资源的主要供给方式。
- 不使用脚下圆圈、粗略压暗范围等假阴影来补齐不一致的光照。
- 不在风格样片通过前批量采购、转换或替换现有资产。

## 当前已有证据与未证明部分

`source/tree_oak.glb` 样片目前只证明：GLB 能加载、透明纹理能生成、地面锚点能
自动计算、结果能进入 Pixi 排序。尚未证明：目标线条、分档自身明暗、接触影、真实落影、
组合场景、建筑体量、正式图集和主游戏接线。

已检查的 [Chants of Sennaar Style Shader](https://godotshaders.com/shader/chants-of-sennaar-style-shader/)
和其 [Godot demo](https://github.com/Conlan2/sennaar-style-shader-demo) 证明了更接近目标的
可修改起点：固定／移动相机、深度与法线边缘检测、灰阶／调色板转换、方向光和真实 3D
阴影可以在同一场景里调试。它仍是实验样例，存在错误深度边、低角度伪影和线条控制不足
的可能，不能把演示截图当作最终质量承诺。shader 页面标明代码 CC0；demo 仓库自身没有
明确许可证，因此只把它当作运行参考，复用代码时以 shader 页面的授权范围为准。

已把下载的免费 CC0 素材批量封装为保留原色的自包含 GLB：Downtown City 153 个，
Stylized Nature 68 个，分别位于 `assets/fromgodot/quaternius-downtown/` 和
`assets/fromgodot/quaternius-stylized-nature/`。这一批只生成模型，不生成 Godot 预览
工程或 2D 图片；组合场景、调色、描边、阴影和三渲二出图在后续阶段统一处理。

### 2026-09-01 首张 Godot 样片

本地已取得 Downtown City MegaKit Standard FREE 和 Stylized Nature MegaKit Standard
FREE；两个包内的 `License_Standard.txt` 均明确声明 CC0 1.0。Blender 5.2 LTS 已将
`Building_Small_1.gltf` 与 `CommonTree_1.gltf` 转成自包含 GLB，Godot 4.7.2 Forward+
已在 NVIDIA RTX 4060 Laptop GPU 上实际完成导入、shader 编译和 1280×720 出图。

独立验证工具位于 `sth/asset-import-spike/godot-style-spike/`。A/B/C…G 对照确认：原始
glTF 与 Blender 重封装 GLB 视觉一致；细节损失不是截图或中转造成，而是五档灰阶量化
和明度压缩造成；完整 0–1 连续灰阶可以保留窗格、玻璃和砖纹。现有 2px 深度描边能增强
建筑轮廓，但会把细扶手压成黑块并误勾地平线，因此描边仍是场景级待调效果，不能烘进
单模型。

早期曾把 `Building_Small_1` 的基础颜色按 Rec.709 破坏性转灰，证明技术可行但会永久
丢失色相信息，因此该灰度衍生物及整批 `*-gray` 资产已删除。现正式交付
`assets/fromgodot/quaternius-downtown/Building_Small_1.glb`：Blender 反向导入与源 glTF
均为 1 个网格、13 个材质、9 张颜色贴图，相同包围盒，颜色通道差保持 0.313725；
`CommonTree_1.glb` 同样保持 1 个网格、2 个材质、2 张颜色贴图及原色。全批 221 个 GLB
均通过文件头、数量、命名和非空检查。
