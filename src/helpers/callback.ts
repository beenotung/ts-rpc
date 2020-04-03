export class CallbackWaiter {
  total = 0;
  done = 0;
  callbacks: Array<() => void> = [];

  add() {
    this.total++;
    return () => {
      this.done++;
      if (this.total === this.done) {
        this.callbacks.forEach((cb) => cb());
        this.callbacks = [];
      }
    };
  }

  waitAll(cb: () => void) {
    if (this.total === this.done) {
      cb();
      return;
    }
    this.callbacks.push(cb);
  }
}
