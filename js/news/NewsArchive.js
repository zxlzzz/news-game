/** 文章存档：单一咽喉函数 publishArticle */

export class NewsArchive {
  constructor() {
    this.articles = [];
  }

  /** 唯一写入入口；外部调用后可在此扩展世界反馈逻辑 */
  publishArticle(article) {
    this.articles.push(article);
    console.log('[NewsArchive] 文章已存档', article.id, article.provider);
  }

  makeId() {
    return `art_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }
}
