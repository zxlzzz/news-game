/**
 * building — 建筑行为模块
 *
 * 独占写入权：_leanLeft、_leanRight 由 EnvironmentQuery 的
 *   nearestFreeWallSpot / releaseWallSpot 负责写入；BuildingEntity 本身不持有这些状态。
 *
 * 出口注册：SceneInitializer 通过 BUILDING_EXIT_XS 注册各楼栋出口（type:'building'），
 *   key 格式为 'building_a/b/c/d'；BuildingEntity 不直接参与出口逻辑。
 */

/** 建筑调色板 — 允许四档之外的灰度以区分楼体，但必须集中定义于此，禁止散落 */
const BP_RESI_WALL   = 0xc6c6c6;
const BP_RESI_ROOF   = 0xb6b6b6;
const BP_OLDMIX_WALL = 0x9c9c9c;
const BP_OLDMIX_ROOF = 0x8c8c8c;
const BP_MODERN_WALL = 0xdadada;
const BP_MODERN_ROOF = 0xcacaca;
const BP_CLINIC_WALL = 0xe2e2e2;
const BP_CLINIC_ROOF = 0xd2d2d2;
const BP_CVS_WALL    = 0xcfcfcf;
const BP_CVS_ROOF    = 0xc0c0c0;
const BP_BOOK_WALL   = 0xbcbcbc;
const BP_BOOK_ROOF   = 0xacacac;

/** 建筑默认内禀尺寸（未缩放，世界单位） */
export const INTRINSIC = { facadeH: 90, bDepth: 70, bWidth: 100 };

/** 建筑原型配置（外观 + 行为参数） */
export const ARCH = {
  resi: {
    wall: BP_RESI_WALL, roof: BP_RESI_ROOF, floorH: 15, groundFrac: 0.24, groundMax: 26,
    style: 'windows', balcony: true,  grille: false, glass: false,
    dirty: 0.0,  laundry: 0.4, acFreq: 0.45, ground: 'shop',      shops: ['convenience', 'fork'],
  },
  oldmix: {
    wall: BP_OLDMIX_WALL, roof: BP_OLDMIX_ROOF, floorH: 16, groundFrac: 0.30, groundMax: 30,
    style: 'grille', balcony: false, grille: true,  glass: false,
    dirty: 0.55, laundry: 0.5, acFreq: 0.6,  ground: 'roller',    shops: ['fork', 'dots'],
  },
  modern: {
    wall: BP_MODERN_WALL, roof: BP_MODERN_ROOF, floorH: 16, groundFrac: 0.26, groundMax: 26,
    style: 'glass',  balcony: false, grille: false, glass: true,
    dirty: 0.0,  laundry: 0.0, acFreq: 0.1,  ground: 'glassshop', shops: ['cup', 'book', 'dumbbell'],
  },
  clinic: {
    wall: BP_CLINIC_WALL, roof: BP_CLINIC_ROOF, floorH: 15, groundFrac: 0.34, groundMax: 24,
    style: 'windows', balcony: false, grille: false, glass: false,
    dirty: 0.0,  laundry: 0.0, acFreq: 0.15, ground: 'clinic',    shops: ['cross'],
  },
  convenience: {
    wall: BP_CVS_WALL, roof: BP_CVS_ROOF, floorH: 14, groundFrac: 0.58, groundMax: 28,
    style: 'windows', balcony: false, grille: false, glass: false,
    dirty: 0.1,  laundry: 0.0, acFreq: 0.3,  ground: 'cvs',       shops: ['dots'],
  },
  bookstore: {
    wall: BP_BOOK_WALL, roof: BP_BOOK_ROOF, floorH: 15, groundFrac: 0.40, groundMax: 26,
    style: 'windows', balcony: false, grille: false, glass: false,
    dirty: 0.25, laundry: 0.0, acFreq: 0.2,  ground: 'bookshop',  shops: ['book'],
  },
  default: {
    wall: BP_RESI_WALL, roof: BP_RESI_ROOF, floorH: 15, groundFrac: 0.26, groundMax: 26,
    style: 'windows', balcony: true,  grille: false, glass: false,
    dirty: 0.1,  laundry: 0.3, acFreq: 0.4,  ground: 'shop',      shops: ['dots'],
  },
};
