import { createServer, Server, Socket } from 'net';
import split from 'split';
import {
  Call,
  Callback,
  CallInput,
  CallSessionIn,
  CallSessionOut,
  RPCClient,
  RPCServer,
} from './base';

export class NetRPCServer<C extends Call = Call> extends RPCServer<C> {
  static port = 10080;
  type: string = 'net';
  port: number = NetRPCServer.port;
  server?: Server;

  listen(cb?: () => void): void {
    if (this.server) {
      throw new Error('already listening');
    }
    const server = createServer();
    this.server = server;
    server.on('connection', (socket) => {
      const readStream = socket.pipe(split());
      readStream.on('data', (line: Buffer | string) => {
        line = line?.toString();
        if (!line) {
          return;
        }
        const { Seq, Call: call } = JSON.parse(line) as CallSessionIn<C>;
        const answer = (response: C['Response']) => {
          const message: CallSessionOut = { Seq, Response: response };
          socket.write('\n' + JSON.stringify(message) + '\n');
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
    server.listen(this.port, cb);
  }

  close(cb?: (err?: any) => void) {
    if (!this.server) {
      cb?.('not started');
      return;
    }
    this.server.close(cb);
    this.server = undefined;
  }
}

export class NetRPCClient extends RPCClient {
  type: string = 'tcp-socket';
  socket?: Socket;

  lastSeq = 0;
  listeners = new Map<number, (Response: any) => void>();

  _init(server: string, cb?: () => void): void {
    if (this.socket) {
      throw new Error('ready started socket');
    }
    const socket = new Socket();
    this.socket = socket;
    const [host, port] = server.split('/').pop()!.split(':');
    socket.connect(
      {
        host,
        port: +port,
      },
      cb,
    );
    const readStream = socket.pipe(split());
    readStream.on('data', (line: Buffer | string) => {
      line = line?.toString();
      if (!line) {
        return;
      }
      const { Response, Seq } = JSON.parse(line) as CallSessionOut;
      const cb = this.listeners.get(Seq);
      if (cb) {
        cb(Response);
        this.listeners.delete(Seq);
      }
    });
  }

  close(cb?: (err?: any) => void) {
    if (!this.socket) {
      cb?.('not started');
      return;
    }
    this.socket.end(cb);
    this.socket = undefined;
  }

  emit<C extends Call>(call: CallInput<C>, cb?: Callback<C>): void {
    if (!this.socket) {
      throw new Error('socket not started');
    }
    this.lastSeq++;
    const Seq = this.lastSeq;
    const message: CallSessionIn = { Call: call, Seq };
    this.socket.write('\n' + JSON.stringify(message) + '\n');
    if (cb) {
      this.listeners.set(Seq, cb);
    }
  }
}
