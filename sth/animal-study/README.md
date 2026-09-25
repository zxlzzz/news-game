# animal-study — 狗步态原型（2026-09-22）

比较两条动物动作来源：视频动捕（MoCapAnything V2）与程序生成步态。路线见根目录
`docs/design_route_animal_motion.md`。

| 文件 | 作用 |
|---|---|
| `dog3d.template.html` | 3D 对比页：左动捕、右程序生成，纯黑剪影，可转镜头。程序步态全部在这个文件里 |
| `build_preview.py` | 把动捕数据注入模板，输出 `D:\mocap-trial\preview\dog3d.html` |
| `export_mocap.py` | MoCapAnything 输出的 BVH → 狗局部 3D 点（前、上、左）+ 由着地脚反推的前进量 |
| `bvh_fk.py` | 最小 BVH 读取 + 正向运动学 |
| `mocap_space.py` | 用官方 HF Space 跑动捕（需 HF token；免费额度约一天一次） |

**动捕数据不进仓库。** 现在用的是 MoCapAnything demo 自带的 Dog 参考骨架（来自 Truebones，
条款禁止再分发），所以 `mocap_dog.json`、BVH、视频都放在 `D:\mocap-trial\work\`。

重建预览：

```sh
python sth/animal-study/export_mocap.py      # 读 D:\mocap-trial\work\out_*\npy\*.bvh
python sth/animal-study/build_preview.py
```

跑新的动捕（依赖 `gradio_client` 同捆的 httpx，可 `pip install --target <临时目录> gradio_client` 后设 PYTHONPATH）：

```sh
python sth/animal-study/mocap_space.py run zoo_side Dog <video.mp4> D:\mocap-trial\work\out_<name>
```
然后在 `export_mocap.py` 的 `CLIPS` 里加一行。
