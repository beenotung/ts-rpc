import { format_byte } from '@beenotung/tslib/format';
import { base58Letters, Random } from '@beenotung/tslib/random';
import { MINUTE } from '@beenotung/tslib/time';
import { expect } from 'chai';
import { RPCClient, RPCServer } from '../src/base';
import { KB, MB } from '../src/helpers';
import { CallbackWaiter } from '../src/helpers/callback';
import { HttpRPCClient, HttpRPCServer } from '../src/http';
import { NetRPCClient, NetRPCServer } from '../src/net';
import { WebsocketRPCClient, WebsocketRPCServer } from '../src/websocket';
import { MockService } from './mock-service';

function testIfaceSetup(iface: RPCServer, cb: () => void) {
  iface.listen(() => {
    iface.close(cb);
  });
}

let ConcurrentClient = 1000;
let MinReqSize = 100 * KB;
let MaxReqSize = 8 * MB;
let ReqStepSize = 500 * KB;
if ('quick') {
  ConcurrentClient = 100;
  MinReqSize = 10 * KB;
  MaxReqSize = 500 * KB;
  ReqStepSize = 100 * KB;
}
if (!'dev') {
  ConcurrentClient = 2;
  MinReqSize = 5;
  MaxReqSize = 5;
}
if (!'low ram') {
  ConcurrentClient = 20;
  ReqStepSize = 0.8 * MB;
}

function testIFaceConcurrency(
  server: RPCServer,
  client: RPCClient,
  end: () => void,
) {
  server.registerHandler('echo', (call, cb) => {
    const [key] = call.Params;
    cb?.([key]);
  });

  function testKey(key: string, cb: () => void) {
    client.emit(
      {
        Type: 'query',
        Action: 'echo',
        Params: [key],
      },
      (res) => {
        expect(res).deep.equals([key]);
        cb();
      },
    );
  }

  function testConcurrent(keyLength: number, cb: () => void) {
    console.log('testing key length:', format_byte(keyLength));
    const waiter = new CallbackWaiter();
    for (let client = 0; client < ConcurrentClient; client++) {
      const done = waiter.add();
      const key = Random.nextString(keyLength, base58Letters);
      testKey(key, done);
    }
    waiter.waitAll(cb);
  }

  function testKeyLength(keyLength: number, cb: () => void) {
    if (keyLength > MaxReqSize) {
      cb();
      return;
    }
    testConcurrent(keyLength, () => testKeyLength(keyLength + ReqStepSize, cb));
  }

  testKeyLength(MinReqSize, () => client.close(() => server.close(end)));
}

describe('RPC TestSuit', function () {
  it('should start http transport interface', function (cb) {
    const iface = new HttpRPCServer();
    testIfaceSetup(iface, cb);
  });

  it('should start net transport interface', function (cb) {
    const iface = new NetRPCServer();
    testIfaceSetup(iface, cb);
  });

  it('should start websocket transport interface', function (cb) {
    const iface = new WebsocketRPCServer();
    testIfaceSetup(iface, cb);
  });

  it('should set key value', function (cb) {
    const service = new MockService();
    const net = new NetRPCServer();
    service.hook(net);
    net.emit({ Type: 'submit', Action: 'set', Params: ['Life', 42] });
    net.emit({ Type: 'query', Action: 'get', Params: ['Life'] }, (res) => {
      expect(res).to.deep.equals(['Life', 42]);
      cb();
    });
  });

  it('should handle concurrent packages from http transport', function (cb) {
    const server = new HttpRPCServer();
    const client = new HttpRPCClient();
    server.listen(() => {
      client.init('http://127.0.0.1:' + server.port, () => {
        testIFaceConcurrency(server, client, cb);
      });
    });
  }).timeout(10 * MINUTE);

  it('should handle concurrent packages from tcp transport', function (cb) {
    const server = new NetRPCServer();
    const client = new NetRPCClient();
    server.listen(() => {
      client.init('tcp://127.0.0.1:' + server.port, () => {
        testIFaceConcurrency(server, client, cb);
      });
    });
  }).timeout(10 * MINUTE);

  it('should handle concurrent packages from websocket transport', function (cb) {
    const server = new WebsocketRPCServer();
    const client = new WebsocketRPCClient();
    console.log('creating server');
    server.listen(() => {
      console.log('created server');
      console.log('creating socket');
      client.init('ws://127.0.0.1:' + server.port, () => {
        console.log('created socket');
        testIFaceConcurrency(server, client, cb);
      });
    });
  }).timeout(10 * MINUTE);
});
