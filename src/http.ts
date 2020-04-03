import { createServer } from 'http';
import fetch from 'node-fetch';
import {
  Call,
  Callback,
  CallInput,
  DefaultClose,
  RPCClient,
  RPCServer,
} from './base';
import { MaxRequestSize } from './helpers';

export class HttpRPCServer<C extends Call = Call> extends RPCServer<C> {
  static port = 9080;
  port: number = HttpRPCServer.port;
  type = 'http';

  listen(cb?: () => void): void {
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (data) => {
        body += data.toString();
        if (body.length > MaxRequestSize) {
          req.connection.destroy();
        }
      });
      req.on('end', () => {
        const call = JSON.parse(body) as CallInput<C>;
        switch (call.Type) {
          case 'query':
            this.emit(call, (result) => {
              res.setHeader('Content-Type', 'application/json');
              res.writeHead(200);
              res.end(JSON.stringify(result));
            });
            break;
          case 'subscribe':
            res.writeHead(501);
            res.end('Subscribe is not supported in http');
            break;
          case 'submit':
            this.emit(call);
            res.writeHead(201);
            res.end('Received');
            break;
        }
      });
    }).listen(this.port, cb);
    this.close = (cb) => {
      server.close(cb);
      this.close = DefaultClose;
    };
  }

  close(cb?: (err?: any) => void): void {
    cb?.();
  }
}

export class HttpRPCClient extends RPCClient {
  type: string = 'http-client';
  server?: string;

  _init(server: string, cb?: () => void): void {
    this.server = server;
    cb?.();
  }

  close(cb?: () => void) {
    this.server = undefined;
    cb?.();
  }

  emit<C extends Call>(call: CallInput<C>, cb?: Callback<C>): void {
    if (!this.server) {
      throw new Error('server not set');
    }
    const p = fetch(this.server, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(call),
    });
    if (cb) {
      p.then((res) => res.json()).then(cb);
    }
  }
}
