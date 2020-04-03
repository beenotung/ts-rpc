import Websocket, { Server } from 'ws';
import {
  Call,
  Callback,
  CallInput,
  CallSessionIn,
  CallSessionOut,
  RPCClient,
  RPCServer,
} from './base';

export class WebsocketRPCServer<C extends Call = Call> extends RPCServer<C> {
  static port = 11080;
  port: number = WebsocketRPCServer.port;
  type = 'websocket';
  wss?: Server;

  listen(cb?: () => void): void {
    if (this.wss) {
      throw new Error('already started');
    }
    const wss = new Server({
      port: this.port,
      perMessageDeflate: {
        zlibDeflateOptions: {
          // See zlib defaults.
          chunkSize: 1024,
          memLevel: 7,
          level: 3,
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024,
        },

        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.

        // Below options specified as default values.
        concurrencyLimit: 10, // Limits zlib concurrency for perf.
        threshold: 1024, // Size (in bytes) below which messages should not be compressed.
      },
    });
    this.wss = wss;
    if (cb) {
      wss.on('listening', cb);
    }

    wss.on('connection', (ws) => {
      ws.on('message', (message) => {
        const { Seq, Call: call } = JSON.parse(
          message.toString(),
        ) as CallSessionIn<C>;
        const answer = (response: C['Response']) => {
          const message: CallSessionOut = { Seq, Response: response };
          ws.send(JSON.stringify(message));
        };
        switch (call.Type) {
          case 'query':
            this.emit(call, (result) => {
              answer(result);
            });
            break;
          case 'subscribe':
            this.emit(call, (result) => {
              answer(result);
            });
            break;
          case 'submit':
            this.emit(call);
            break;
        }
      });
    });
  }

  close(cb?: (err?: any) => void) {
    if (!this.wss) {
      throw new Error('not started');
    }
    this.wss.close(cb);
    this.wss = undefined;
  }
}

export class WebsocketRPCClient extends RPCClient {
  type: string = 'websocket-socket';
  ws?: Websocket;
  lastSeq = 0;
  listeners = new Map<number, (Response: any) => void>();

  _init(server: string, cb?: () => void): void {
    if (this.ws) {
      throw new Error('already init');
    }
    const ws = new Websocket(server, { perMessageDeflate: false });
    this.ws = ws;
    if (cb) {
      ws.once('open', cb);
    }
    ws.on('message', (message) => {
      const { Seq, Response } = JSON.parse(
        message.toString(),
      ) as CallSessionOut;
      const cb = this.listeners.get(Seq);
      if (cb) {
        cb(Response);
        this.listeners.delete(Seq);
      }
    });
  }

  close(cb?: () => void) {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    cb?.();
  }

  emit<C extends Call>(call: CallInput<C>, cb?: Callback<C>): void {
    if (!this.ws) {
      throw new Error('socket not started');
    }
    this.lastSeq++;
    const Seq = this.lastSeq;
    const message: CallSessionIn = { Seq, Call: call };
    this.ws.send(JSON.stringify(message));
    if (cb) {
      this.listeners.set(Seq, cb);
    }
  }
}
