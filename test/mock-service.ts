import { JsonValue } from '@beenotung/tslib/json';
import { RPCServer } from '../src/base';

type Key = PropertyKey;
type Value = JsonValue;

export class MockService {
  map = new Map<Key, Value>();
  keyListeners = new Map<Key, Array<(value: any) => void>>();

  set(key: Key, value: Value) {
    this.map.set(key, value);
    const listeners = this.keyListeners.get(key);
    if (listeners) {
      listeners.forEach((listener) => listener(value));
    }
  }

  listen(key: Key, listener: (value: any) => void) {
    let listeners = this.keyListeners.get(key);
    if (!listeners) {
      listeners = [];
      this.keyListeners.set(key, listeners);
    }
    listeners.push(listener);
  }

  hook(server: RPCServer) {
    server.registerHandler('set', (call, ack) => {
      const [key, value] = call.Params;
      this.set(key, value);
      ack?.(key);
    });
    server.registerHandler('get', (call, ack) => {
      if (!ack) {
        return;
      }
      const [key] = call.Params;
      const value = this.map.get(key);
      ack([key, value]);
    });
    server.registerHandler('listen', (call, ack) => {
      if (!ack) {
        return;
      }
      const [key] = call.Params;
      this.listen(key, (value) => ack([key, value]));
    });
  }
}
