# 街区候选模型（2026-09-19）

这些是经 Blender 打开检查外形、尺寸和可动部件后留下的**源模型**，供以后统一转换画风、确定摆位与人物接触点。尚未接入场景。`quaternius-stylized-nature/` 的 68 件树、灌木、花草、石头和小径，以及 `quaternius-downtown/` 的井盖、排水沟、花箱、路面和楼体构件继续保留；这里不重复下载。抽看自然包实物，`CommonTree_1` 是适合街边的阔叶树，`Pine_1` 有清楚的树冠层次，`Bush_Common` 树叶偏密；`Grass_Common_Short` 是开放薄片，目标画风里不能指望它自身投出实体影子。自然包可用，具体品种仍要按目标镜头挑。

所有新文件均为 CC0，可商用。3DAssets.dev 的模型标注为 AI 辅助制作；这里逐件检查实物，不以网页预览代替检验。所有文件均为自包含 GLB，按米计量，地面接触点约为零，正面朝 +Z。模型的颜色是源素材颜色；后续场景 Look 通过材质名映射，不要把灰度烘入源模型。

| 文件 | 用途 | 来源、原始模型 ID |
| --- | --- | --- |
| `Bus_City.glb` | 普通公交，门与车轮独立；`open` / `close` / `roll` | [Bus Station and City Transit](https://3dassets.dev/packs/bus-station-and-city-transit) `34194` |
| `Bus_Shelter.glb` | 带广告板的候车棚 | 同包 `34221` |
| `Bus_Stop_Pole.glb` | 站牌、时刻信息面板 | 同包 `34220` |
| `Bench_Street.glb` | 街边及车站座椅 | 同包 `34224` |
| `Bin_Street.glb` | 垃圾桶，`open` / `close` | 同包 `34225` |
| `Lamp_Street.glb` | 7 米街灯 | 同包 `34226` |
| `Traffic_Light.glb` | 十字路口信号灯（灯色为静态材料） | 同包 `34229` |
| `Road_Sign_Set.glb` | 路边方向／限制标牌组合，牌面空白 | 同包 `34228` |
| `Car_City.glb` | 小汽车，车门、引擎盖、车轮有独立动作 | [Road Car Showroom Lineup](https://3dassets.dev/packs/road-car-showroom-lineup) `15105` |
| `Bicycle_Quaternius.glb` | 自行车，前后轮、车把、车架分件 | [Quaternius Public Transport](https://quaternius.com/packs/publictransport.html) 官方 `Bicycle.fbx` |
| `Stall_Market.glb` | 顶棚与柜台，卖家／买家可分站两侧 | [Street Food Market and Food Trucks](https://3dassets.dev/packs/street-food-market-and-food-trucks) `34284` |
| `News_Box.glb` | 报刊箱，取报翻盖有 `open` / `close` | [Retro Diner and Roadside Motel](https://3dassets.dev/packs/retro-diner-and-roadside-motel) `37363` |
| `Fire_Hydrant.glb` | 消防栓 | 同包 `37364` |
| `Phonebooth.glb` | 电话亭，两扇门有 `open` / `close` | 同包 `37362` |
| `Vending_Drinks.glb` | 饮料售货机，有商品窗、按键、取货槽 | [Theme Park Rides and Coasters](https://3dassets.dev/assets/theme-park-rides-and-coasters-theme-park-rides-and-coa-5163d777) `28691` |
| `Fountain_Town.glb` | 约 3.44 米八角喷泉 | [Tactical Shooter Hill Town](https://3dassets.dev/assets/tactical-shooter-hill-town-octagonal-fountain-a601c6d9) `27528` |
| `Chess_Table.glb` | 棋桌和两边座位，棋子另配 | [Voxel City Districts](https://3dassets.dev/assets/voxel-city-districts-chess-table-36bc9f7d) `24855` |
| `Bench_Park.glb` | 公园座椅，与街边座椅不同 | [City Park and Playground](https://3dassets.dev/packs/city-park-and-playground) `33673` |

每个 3DAssets.dev 文件可按 `https://cdn.3dassets.dev/assets/<ID>/v1/model.glb` 找回原版。对源文件做过必要修正：`Bicycle_Quaternius.glb` 从 FBX 统一缩放 0.35、旋转到 +Z 前方、将轮胎最低点置于地面；`Car_City.glb` 的整车根节点抬高 0.059 米，使轮胎最低点落在地面，原车门／车轮动作仍在；`Phonebooth.glb` 和 `News_Box.glb` 把原先半透明的 `glass` 材质改成不透明，以符合当前画风约束，开门／翻盖动作仍在。2026-09-23：除自行车外的 17 个文件原本用了 `KHR_mesh_quantization`（顶点存成整数），Godot 4.7 不能导入；已用 `godot/tools/dequantize_glb.mjs` 就地改成浮点顶点，几何、材质、动作不变。

**互动摆位尚需实测**：长椅坐面、棋桌两侧、摊位柜台、售货机按钮／取货口、电话亭门口、公交门口和自行车骑乘位，必须与实际 NPC 动画一起定接触点。GLB 自带的车门、车轮或翻盖动作只能驱动物件，不会自动让 NPC 对位。电话亭改为不透明玻璃后，从外面看不到内部电话，接听镜头若需要看到话机，应再选内景方案。

目前仍缺与现有立柱式 `mailbox` 和挂墙 `sign` 外形匹配的源模型；这次见到的住宅邮箱与独立路牌不是它们的替代品。其他如报纸具体内容、公交站字样、棋子和摊位货品也还没有确定。选中的模型需在目标相机和 Look 下再次检查线密度、贴图退化和阴影；此处只完成源模型筛选。
