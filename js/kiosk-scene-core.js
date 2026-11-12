/* A visual rehearsal inside the kiosk. Inventory belongs to this scene only. */
(function(root){
'use strict';
class Scene {
  constructor(config, snapshot) {
    this.config = config;
    this.initialStock = config.products.map(product => {
      const value = snapshot && snapshot.stock && snapshot.stock[product.id];
      return Number.isFinite(value) && value >= 0 ? Math.floor(value) : product.stock;
    });
    this.reset();
  }
  reset() {
    this.stock = this.initialStock.slice();
    this.target = 0;
    this.held = null;
    this.time = 0;
    this.phaseTime = 0;
    this.reach = 0;
    this.distance = 0;
    this.x = this.config.entry[0][0];
    this.y = this.config.entry[0][1];
    this.direction = 0;
    this.reason = '冷たい飲み物を見に行きます。';
    this.go([...this.config.entry.slice(1), this.shelfPoint()], 'browse');
  }
  shelfPoint() {
    const product = this.config.products[this.target];
    return [product.x, product.y];
  }
  go(points, next) {
    this.path = points.map(point => point.slice());
    this.next = next;
    this.phase = 'walk';
    this.phaseTime = 0;
  }
  enter(phase) {
    this.phase = phase;
    this.phaseTime = 0;
  }
  setStock(index, quantity) {
    if (!Number.isInteger(index) || index < 0 || index >= this.stock.length) return;
    const value = Number(quantity);
    if (!Number.isFinite(value)) return;
    this.stock[index] = Math.max(0, Math.floor(value));
  }
  reselect() {
    const next = this.stock.findIndex((count, index) => count > 0 && index !== this.target);
    if (next < 0) {
      this.reason = '飲み物がどちらも品切れなので、買わずに帰ります。';
      this.go([...this.config.checkout.slice(0, 4), ...this.config.exit], 'done');
      return;
    }
    this.target = next;
    this.reason = this.config.products[next].name + 'を選び直します。';
    this.go([this.shelfPoint()], 'browse');
  }
  step(dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    // Small steps make interruptions and inventory transfers independent of FPS.
    for (let remaining = Math.min(dt, 1); remaining > 1e-8;) {
      const step = Math.min(remaining, 1 / 60);
      this.advance(step);
      remaining -= step;
    }
  }
  advance(dt) {
    this.time += dt;
    this.phaseTime += dt;
    if (this.phase === 'walk') {
      const point = this.path[0];
      if (!point) { this.enter(this.next); return; }
      const dx = point[0] - this.x, dy = point[1] - this.y;
      const length = Math.hypot(dx, dy);
      const move = Math.min(length, this.config.speed * dt);
      if (length > 0) {
        this.x += dx / length * move;
        this.y += dy / length * move;
        this.distance += move;
        this.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 3) : (dy > 0 ? 1 : 0);
      }
      if (length <= move) this.path.shift();
      return;
    }
    if (this.phase === 'browse') {
      this.direction = 0;
      this.reason = this.config.products[this.target].name + 'を見ています。';
      if (this.phaseTime < this.config.browseSeconds) return;
      if (!this.stock[this.target]) { this.reselect(); return; }
      this.reason = '手を伸ばしています。いま品切れにすると、途中で手を戻します。';
      this.enter('reach');
    } else if (this.phase === 'reach') {
      this.reach = Math.min(1, this.phaseTime / this.config.reachSeconds);
      if (!this.stock[this.target]) {
        this.reason = '品切れに気づいて、伸ばしかけた手を戻します。';
        this.enter('retract');
      } else if (this.reach >= 1) {
        this.stock[this.target]--;
        this.held = this.target;
        this.reason = this.config.products[this.target].name + 'を棚から取りました。';
        this.enter('take');
      }
    } else if (this.phase === 'retract') {
      this.reach = Math.max(0, this.reach - dt / 1.2);
      if (!this.reach) this.reselect();
    } else if (this.phase === 'take') {
      if (this.phaseTime < 1.5) return;
      this.reach = 0;
      this.reason = '飲み物を持って、有人レジの列へ向かいます。';
      this.go(this.config.checkout, 'queue');
    } else if (this.phase === 'queue' && this.phaseTime >= 3) {
      this.reason = '前の客の後ろで、会計の順番を待っています。';
      if (this.phaseTime >= 5) {
        this.reason = 'この試作では、レジ前までの買い物を観察できます。';
        this.enter('done');
      }
    }
  }
}
root.KioskScene = Scene;
})(typeof window === 'undefined' ? globalThis : window);
